import { create } from 'zustand'
import { Chess } from 'chess.js'
import type { Square } from 'chess.js'

export type GameStatus = 'idle' | 'playing' | 'checkmate' | 'draw' | 'resigned'

export type MoveRecord = {
  san: string
  fen: string
  movedBy: 'w' | 'b'
  evalCp: number | null
  isMate: boolean
  mateIn: number | null
  commentary: string
  commentaryStreaming: boolean
}

export type KeyMoment = {
  moveIndex: number
  moveNumber: number
  san: string
  movedBy: 'w' | 'b'
  evalBefore: number
  evalAfter: number
  delta: number
}

export type PostGameState = {
  keyMoments: KeyMoment[]
  digest: string
  isGenerating: boolean
}

export type EngineState = {
  evalCp: number | null
  bestMove: string | null
  pv: string[]
  depth: number
  isMate: boolean
  mateIn: number | null
  isThinking: boolean
}

type GameStore = {
  chess: Chess
  fen: string
  history: MoveRecord[]
  status: GameStatus
  playerColor: 'w' | 'b'
  engine: EngineState
  postGame: PostGameState | null

  bestMoveVisible: boolean

  applyMove: (args: { from: Square; to: Square; promotion?: string }) => boolean
  resignGame: () => void
  resetGame: () => void
  takebackMove: () => void
  flashBestMove: () => void
  setEngineResult: (result: Partial<EngineState>) => void
  setEngineThinking: (isThinking: boolean) => void
  appendMoveCommentary: (chunk: string, moveIndex: number) => void
  finalizeMoveCommentary: (moveIndex: number) => void
  setMoveCommentaryStreaming: (streaming: boolean, moveIndex: number) => void
  getCommentaryForFen: (fen: string) => string | undefined
  initPostGame: () => void
  appendDigest: (chunk: string) => void
  finalizeDigest: () => void
}

const initialEngineState: EngineState = {
  evalCp: null,
  bestMove: null,
  pv: [],
  depth: 0,
  isMate: false,
  mateIn: null,
  isThinking: false,
}

function extractKeyMoments(history: MoveRecord[]): KeyMoment[] {
  const moments: KeyMoment[] = []

  for (let i = 1; i < history.length; i++) {
    const before = history[i - 1].evalCp
    const after = history[i].evalCp
    if (before === null || after === null) continue

    const delta = Math.abs(after - before)
    if (delta < 100) continue

    moments.push({
      moveIndex: i,
      moveNumber: Math.floor(i / 2) + 1,
      san: history[i].san,
      movedBy: history[i].movedBy,
      evalBefore: before,
      evalAfter: after,
      delta,
    })
  }

  // Sort by largest swing, cap at 6
  return moments.sort((a, b) => b.delta - a.delta).slice(0, 6)
}

export const useGameStore = create<GameStore>((set, get) => ({
  chess: new Chess(),
  fen: new Chess().fen(),
  history: [],
  status: 'idle',
  playerColor: 'w',
  engine: initialEngineState,
  postGame: null,
  bestMoveVisible: false,

  applyMove: ({ from, to, promotion }) => {
    const { chess } = get()
    try {
      const move = chess.move({ from, to, promotion })
      if (!move) return false

      const sideToMove = chess.fen().split(' ')[1] as 'w' | 'b'
      const movedBy: 'w' | 'b' = sideToMove === 'w' ? 'b' : 'w'

      const record: MoveRecord = {
        san: move.san,
        fen: chess.fen(),
        movedBy,
        evalCp: null,
        isMate: false,
        mateIn: null,
        commentary: '',
        commentaryStreaming: false,
      }

      let status: GameStatus = 'playing'
      if (chess.isCheckmate()) status = 'checkmate'
      else if (chess.isDraw()) status = 'draw'

      set((state) => ({
        fen: chess.fen(),
        history: [...state.history, record],
        status,
        engine: { ...initialEngineState },
      }))

      return true
    } catch {
      return false
    }
  },

  resignGame: () => {
    set({ status: 'resigned' })
  },

  takebackMove: () => {
    const { chess, history } = get()
    if (history.length === 0) return

    // Undo black's response + white's move, or just white's if engine hasn't replied yet
    const movesToUndo = history[history.length - 1].movedBy === 'b' ? 2 : 1
    const count = Math.min(movesToUndo, history.length)

    for (let i = 0; i < count; i++) chess.undo()

    set((state) => ({
      fen: chess.fen(),
      history: state.history.slice(0, -count),
      status: 'playing',
      engine: { ...initialEngineState },
    }))
  },

  flashBestMove: () => {
    set({ bestMoveVisible: true })
    setTimeout(() => set({ bestMoveVisible: false }), 3000)
  },

  resetGame: () => {
    const chess = new Chess()
    set({
      chess,
      fen: chess.fen(),
      history: [],
      status: 'idle',
      engine: initialEngineState,
      postGame: null,
      bestMoveVisible: false,
    })
  },

  setEngineResult: (result) => {
    set((state) => ({
      engine: { ...state.engine, ...result, isThinking: false },
    }))
    const { history } = get()
    if (history.length > 0) {
      const last = history[history.length - 1]
      const updated: MoveRecord = {
        ...last,
        evalCp: result.evalCp ?? last.evalCp,
        isMate: result.isMate ?? last.isMate,
        mateIn: result.mateIn ?? last.mateIn,
      }
      set((state) => ({
        history: [...state.history.slice(0, -1), updated],
      }))
    }
  },

  setEngineThinking: (isThinking) => {
    set((state) => ({ engine: { ...state.engine, isThinking } }))
  },

  appendMoveCommentary: (chunk, moveIndex) => {
    set((state) => {
      if (moveIndex >= state.history.length) return state
      const history = [...state.history]
      const entry = history[moveIndex]
      history[moveIndex] = { ...entry, commentary: entry.commentary + chunk }
      return { history }
    })
  },

  finalizeMoveCommentary: (moveIndex) => {
    set((state) => {
      if (moveIndex >= state.history.length) return state
      const history = [...state.history]
      history[moveIndex] = { ...history[moveIndex], commentaryStreaming: false }
      return { history }
    })
  },

  setMoveCommentaryStreaming: (streaming, moveIndex) => {
    set((state) => {
      if (moveIndex >= state.history.length) return state
      const history = [...state.history]
      history[moveIndex] = { ...history[moveIndex], commentaryStreaming: streaming }
      return { history }
    })
  },

  getCommentaryForFen: (fen) => {
    return get().history.find((m) => m.fen === fen)?.commentary
  },

  initPostGame: () => {
    const { history } = get()
    const keyMoments = extractKeyMoments(history)
    set({ postGame: { keyMoments, digest: '', isGenerating: true } })
  },

  appendDigest: (chunk) => {
    set((state) => {
      if (!state.postGame) return state
      return { postGame: { ...state.postGame, digest: state.postGame.digest + chunk } }
    })
  },

  finalizeDigest: () => {
    set((state) => {
      if (!state.postGame) return state
      return { postGame: { ...state.postGame, isGenerating: false } }
    })
  },
}))
