import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { StockfishEngine } from './engine'

// Simulate Stockfish UCI message flow with a controllable fake worker
class FakeWorker {
  onmessage: ((e: MessageEvent<string>) => void) | null = null
  onerror: ((e: ErrorEvent) => void) | null = null

  private _lines: string[] = []

  postMessage(msg: string) {
    if (msg === 'uci') {
      this._emit('uciok')
    } else if (msg === 'isready') {
      this._emit('readyok')
    } else if (msg.startsWith('go depth')) {
      const depth = parseInt(msg.split(' ')[2], 10)
      // Emit asynchronously so a superseding evaluate() can run first
      Promise.resolve().then(() => {
        this._emit(`info depth 1 seldepth 1 score cp 23 nodes 100 pv e2e4`)
        this._emit(`info depth ${depth} seldepth ${depth} score cp 30 nodes 5000 pv e2e4 e7e5 g1f3`)
        this._emit('bestmove e2e4 ponder e7e5')
      })
    } else if (msg === 'stop') {
      // Immediate stop ack
      Promise.resolve().then(() => this._emit('bestmove (none)'))
    }
  }

  terminate() {}

  _emit(line: string) {
    this.onmessage?.({ data: line } as MessageEvent<string>)
  }

  _lines_sent = this._lines
}

beforeEach(() => {
  vi.stubGlobal('Worker', FakeWorker)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('StockfishEngine', () => {
  it('initialises and becomes ready', async () => {
    const engine = new StockfishEngine()
    await engine.init()
    // No error thrown = ready
    engine.destroy()
  })

  it('evaluates a FEN and returns an EvalResult', async () => {
    const engine = new StockfishEngine()
    const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    const result = await engine.evaluate(startFen, { depth: 5 })

    expect(result.bestMove).toBe('e2e4')
    expect(result.depth).toBe(5)
    expect(typeof result.evalCp).toBe('number')
    expect(Array.isArray(result.pv)).toBe(true)
    expect(result.isMate).toBe(false)

    engine.destroy()
  })

  it('normalises eval to white perspective when black to move', async () => {
    const engine = new StockfishEngine()
    // FEN with black to move — fake worker always returns cp 30
    const blackToMoveFen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'
    const result = await engine.evaluate(blackToMoveFen, { depth: 5 })

    // cp 30 from black's POV → white is at -30
    expect(result.evalCp).toBe(-30)

    engine.destroy()
  })

  it('supersedes a pending evaluate with a newer call', async () => {
    const engine = new StockfishEngine()
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

    const first = engine.evaluate(fen, { depth: 5 })
    const second = engine.evaluate(fen, { depth: 5 })

    await expect(first).rejects.toThrow('Superseded')
    await expect(second).resolves.toBeDefined()

    engine.destroy()
  })
})
