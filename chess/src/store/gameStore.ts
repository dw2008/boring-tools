import { create } from 'zustand'
import { Chess } from 'chess.js'
import type { Square } from 'chess.js'

export type GameStatus = 'idle' | 'playing' | 'checkmate' | 'draw' | 'resigned'
export type Difficulty = 'easy' | 'medium' | 'hard'

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

export type ClockState = {
  elapsed: number  // seconds the player has spent thinking (counts up)
  running: boolean
}

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  streaming: boolean
}

type GameStore = {
  chess: Chess
  fen: string
  history: MoveRecord[]
  status: GameStatus
  difficulty: Difficulty
  playerColor: 'w' | 'b'
  engine: EngineState
  postGame: PostGameState | null
  bestMoveVisible: boolean
  clock: ClockState
  chat: ChatMessage[]

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
  setDifficulty: (d: Difficulty) => void
  // Clock
  tickClock: () => void
  // Chat
  addUserMessage: (text: string) => string
  addAssistantMessage: () => string
  appendChatChunk: (id: string, chunk: string) => void
  finalizeChatMessage: (id: string) => void
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

const initialClock: ClockState = {
  elapsed: 0,
  running: false,
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
  return moments.sort((a, b) => b.delta - a.delta).slice(0, 6)
}

let msgCounter = 0
function nextId() { return String(++msgCounter) }

export const useGameStore = create<GameStore>((set, get) => ({
  chess: new Chess(),
  fen: new Chess().fen(),
  history: [],
  status: 'idle',
  difficulty: 'medium',
  playerColor: 'w',
  engine: initialEngineState,
  postGame: null,
  bestMoveVisible: false,
  clock: initialClock,
  chat: [],

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
        // Run player clock only when it's the player's (white's) turn
        clock: {
          ...state.clock,
          running: status === 'playing' && sideToMove === 'w',
        },
      }))

      return true
    } catch {
      return false
    }
  },

  resignGame: () => {
    set((state) => ({
      status: 'resigned',
      clock: { ...state.clock, running: false },
    }))
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
      clock: initialClock,
      chat: [],
    })
  },

  takebackMove: () => {
    const { chess, history } = get()
    if (history.length === 0) return
    const movesToUndo = history[history.length - 1].movedBy === 'b' ? 2 : 1
    const count = Math.min(movesToUndo, history.length)
    for (let i = 0; i < count; i++) chess.undo()
    const sideToMove = chess.fen().split(' ')[1] as 'w' | 'b'
    set((state) => ({
      fen: chess.fen(),
      history: state.history.slice(0, -count),
      status: 'playing',
      engine: { ...initialEngineState },
      clock: { ...state.clock, running: sideToMove === 'w' },
    }))
  },

  flashBestMove: () => {
    set({ bestMoveVisible: true })
    setTimeout(() => set({ bestMoveVisible: false }), 3000)
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
    set((state) => ({
      postGame: { keyMoments, digest: '', isGenerating: true },
      clock: { ...state.clock, running: false },
    }))
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

  setDifficulty: (d) => set({ difficulty: d }),

  tickClock: () => {
    set((state) => {
      if (!state.clock.running || state.status !== 'playing') return state
      return { clock: { ...state.clock, elapsed: state.clock.elapsed + 1 } }
    })
  },

  addUserMessage: (text) => {
    const id = nextId()
    set((state) => ({
      chat: [...state.chat, { id, role: 'user', text, streaming: false }],
    }))
    return id
  },

  addAssistantMessage: () => {
    const id = nextId()
    set((state) => ({
      chat: [...state.chat, { id, role: 'assistant', text: '', streaming: true }],
    }))
    return id
  },

  appendChatChunk: (id, chunk) => {
    set((state) => ({
      chat: state.chat.map((m) =>
        m.id === id ? { ...m, text: m.text + chunk } : m,
      ),
    }))
  },

  finalizeChatMessage: (id) => {
    set((state) => ({
      chat: state.chat.map((m) =>
        m.id === id ? { ...m, streaming: false } : m,
      ),
    }))
  },
}))
