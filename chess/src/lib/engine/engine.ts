export type EvalResult = {
  evalCp: number
  bestMove: string
  pv: string[]
  depth: number
  isMate: boolean
  mateIn: number | null
}

type PendingEval = {
  fen: string
  depth: number
  resolve: (r: EvalResult) => void
  reject: (e: Error) => void
}

const MATE_SENTINEL = 10_000

export class StockfishEngine {
  private worker: Worker | null = null
  private ready = false
  private pending: PendingEval | null = null
  private partialResult: Partial<EvalResult> = {}
  // Tracks the side to move for perspective normalisation
  private fenSideToMove: 'w' | 'b' = 'w'

  private initPromise: Promise<void> | null = null

  init(): Promise<void> {
    if (this.initPromise) return this.initPromise

    this.initPromise = new Promise<void>((resolve, reject) => {
      const worker = new Worker(`${import.meta.env.BASE_URL}stockfish.js`)
      this.worker = worker

      const timeout = setTimeout(() => {
        reject(new Error('Stockfish init timed out'))
      }, 15_000)

      worker.onerror = (e) => {
        clearTimeout(timeout)
        reject(new Error(`Stockfish worker error: ${e.message}`))
      }

      worker.onmessage = (e: MessageEvent<string>) => {
        const line = e.data
        if (line === 'uciok') {
          worker.postMessage('isready')
        } else if (line === 'readyok') {
          clearTimeout(timeout)
          this.ready = true
          worker.onmessage = (ev: MessageEvent<string>) => this.handleMessage(ev.data)
          resolve()
        }
      }

      worker.postMessage('uci')
    })

    return this.initPromise
  }

  async evaluate(fen: string, options: { depth?: number } = {}): Promise<EvalResult> {
    await this.init()
    const depth = options.depth ?? 18

    // If a search is running, stop it first.
    if (this.pending) {
      this.worker!.postMessage('stop')
      this.pending.reject(new Error('Superseded by newer evaluate call'))
      this.pending = null
    }

    this.fenSideToMove = fen.split(' ')[1] === 'b' ? 'b' : 'w'
    this.partialResult = {}

    return new Promise<EvalResult>((resolve, reject) => {
      this.pending = { fen, depth, resolve, reject }
      this.worker!.postMessage(`position fen ${fen}`)
      this.worker!.postMessage(`go depth ${depth}`)
    })
  }

  destroy() {
    if (this.pending) {
      this.pending.reject(new Error('Engine destroyed'))
      this.pending = null
    }
    this.worker?.terminate()
    this.worker = null
    this.ready = false
    this.initPromise = null
  }

  private handleMessage(line: string) {
    if (line.startsWith('info')) {
      this.parseInfo(line)
    } else if (line.startsWith('bestmove')) {
      this.parseBestMove(line)
    }
  }

  private parseInfo(line: string) {
    const depthMatch = line.match(/\bdepth (\d+)/)
    const cpMatch = line.match(/\bscore cp (-?\d+)/)
    const mateMatch = line.match(/\bscore mate (-?\d+)/)
    const pvMatch = line.match(/\bpv (.+)/)

    if (!depthMatch) return

    const depth = parseInt(depthMatch[1], 10)
    let evalCp: number
    let isMate = false
    let mateIn: number | null = null

    if (mateMatch) {
      const m = parseInt(mateMatch[1], 10)
      isMate = true
      mateIn = m
      // Positive mate = winning for side to move; negative = losing
      evalCp = m > 0 ? MATE_SENTINEL : -MATE_SENTINEL
    } else if (cpMatch) {
      evalCp = parseInt(cpMatch[1], 10)
    } else {
      return
    }

    // Normalise to white's perspective
    if (this.fenSideToMove === 'b') {
      evalCp = -evalCp
      if (mateIn !== null) mateIn = -mateIn
    }

    const pv = pvMatch ? pvMatch[1].trim().split(' ').slice(0, 3) : []

    this.partialResult = { evalCp, depth, isMate, mateIn, pv }
  }

  private parseBestMove(line: string) {
    const match = line.match(/^bestmove (\S+)/)
    const bestMove = match?.[1] ?? ''

    const pending = this.pending
    this.pending = null

    if (!pending) return

    const result: EvalResult = {
      evalCp: this.partialResult.evalCp ?? 0,
      bestMove,
      pv: this.partialResult.pv ?? [],
      depth: this.partialResult.depth ?? 0,
      isMate: this.partialResult.isMate ?? false,
      mateIn: this.partialResult.mateIn ?? null,
    }

    pending.resolve(result)
  }
}

// Singleton for app-wide use
let _engine: StockfishEngine | null = null

export function getEngine(): StockfishEngine {
  if (!_engine) _engine = new StockfishEngine()
  return _engine
}
