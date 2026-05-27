import { useRef, useState, useEffect } from 'react'
import { useGameStore } from '../../store/gameStore'
import type { MoveRecord } from '../../store/gameStore'
import { getChatResponse } from '../../lib/llm'

const MATE_SENTINEL = 10_000

type Tab = 'commentary' | 'chat'

export default function AssistantPanel({ isOpen = false, onClose }: { isOpen?: boolean; onClose?: () => void } = {}) {
  const engine = useGameStore((s) => s.engine)
  const history = useGameStore((s) => s.history)
  const status = useGameStore((s) => s.status)
  const fen = useGameStore((s) => s.fen)
  const resignGame = useGameStore((s) => s.resignGame)
  const takebackMove = useGameStore((s) => s.takebackMove)
  const flashBestMove = useGameStore((s) => s.flashBestMove)
  const bestMoveVisible = useGameStore((s) => s.bestMoveVisible)
  const hasBestMove = useGameStore((s) => !!s.engine.bestMove && s.engine.bestMove !== '(none)')
  const chat = useGameStore((s) => s.chat)
  const addUserMessage = useGameStore((s) => s.addUserMessage)
  const addAssistantMessage = useGameStore((s) => s.addAssistantMessage)
  const appendChatChunk = useGameStore((s) => s.appendChatChunk)
  const finalizeChatMessage = useGameStore((s) => s.finalizeChatMessage)

  const isAnalyzing = engine.isThinking
  const evalLabel = formatEval(engine.evalCp, engine.isMate, engine.mateIn)

  const [tab, setTab] = useState<Tab>('commentary')
  const [chatInput, setChatInput] = useState('')
  const [chatBusy, setChatBusy] = useState(false)
  const feedRef = useRef<HTMLDivElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Auto-switch to chat tab when a new user message is sent
  // Scroll commentary feed to bottom on new moves
  useEffect(() => {
    const el = feedRef.current
    if (el?.scrollTo) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [history.length])

  // Scroll chat to bottom on new chunks
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat])

  async function sendChat() {
    const text = chatInput.trim()
    if (!text || chatBusy) return
    setChatInput('')
    setChatBusy(true)
    setTab('chat')

    addUserMessage(text)
    const assistantId = addAssistantMessage()

    try {
      const recentMoves = history.slice(-6).map((m) => m.san)
      await getChatResponse(
        { fen, engineEval: engine.evalCp, recentMoves, question: text },
        (chunk) => appendChatChunk(assistantId, chunk),
      )
    } catch (err) {
      console.error('[chess] Chat error:', err)
      appendChatChunk(assistantId, '(error — check console)')
    } finally {
      finalizeChatMessage(assistantId)
      setChatBusy(false)
    }
  }

  return (
    <aside
      className={`flex flex-col bg-surface border-l border-divider
        fixed inset-y-0 right-0 h-full w-[90%] max-w-[400px] z-50
        transition-transform duration-300 ease-out
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        lg:static lg:w-[380px] lg:max-w-none lg:shrink-0 lg:translate-x-0 lg:transition-none lg:z-auto`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-divider shrink-0">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isAnalyzing ? 'bg-accent animate-pulse' : 'bg-text-muted'}`} />
          <span className="text-[13px] font-semibold text-text-primary">Chess Assistant</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-text-muted font-mono">
            {isAnalyzing ? '• Analyzing...' : evalLabel ? `• ${evalLabel}` : '• Ready'}
          </span>
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden text-text-muted hover:text-text-primary text-[16px] leading-none"
              aria-label="Close assistant"
            >
              ✕
            </button>
          )}
        </div>
      </div>


      {/* Tabs */}
      <div className="flex border-b border-divider shrink-0">
        <TabButton label="Commentary" active={tab === 'commentary'} onClick={() => setTab('commentary')}
          badge={history.length > 0 ? history.length : undefined} />
        <TabButton label="Ask AI" active={tab === 'chat'} onClick={() => setTab('chat')}
          badge={chat.filter((m) => m.role === 'user').length || undefined} />
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {tab === 'commentary' ? (
          <div ref={feedRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
            {history.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-[12px] text-text-muted text-center">
                  Move commentary will appear here after each move.
                </p>
              </div>
            ) : (
              history.map((move, i) => <CommentaryCard key={i} move={move} moveIndex={i} />)
            )}
            {(status === 'checkmate' || status === 'draw' || status === 'resigned') && (
              <div className="bg-surface-elevated border border-accent/30 rounded p-3 text-center mt-2">
                <p className="text-[13px] text-accent font-semibold">
                  {status === 'checkmate' ? 'Checkmate' : status === 'draw' ? 'Draw' : 'Resigned'}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {chat.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-[12px] text-text-muted text-center">
                  Ask anything about the position — threats, plans, why a move is good or bad.
                </p>
              </div>
            ) : (
              chat.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center mr-2 mt-0.5 shrink-0">
                      <span className="text-[9px] text-accent font-bold">A</span>
                    </div>
                  )}
                  <div className={`max-w-[82%] rounded-xl px-3 py-2 text-[12px] leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-accent/15 text-text-primary rounded-tr-sm'
                      : 'bg-surface-elevated text-text-primary rounded-tl-sm'
                  }`}>
                    <SquareHighlighted text={msg.text} />
                    {msg.streaming && (
                      <span className="inline-block w-1 h-3 ml-0.5 bg-accent animate-pulse align-middle rounded-sm" />
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      {/* Bottom bar — always visible */}
      <div className="px-4 py-3 border-t border-divider shrink-0">
        <div className="flex items-center gap-2 bg-surface-elevated rounded px-3 py-2">
          <input
            className="flex-1 bg-transparent text-[13px] text-text-primary placeholder-text-muted outline-none"
            placeholder="Ask about the position..."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') sendChat() }}
            onFocus={() => setTab('chat')}
            disabled={chatBusy}
          />
          <button
            className="text-accent disabled:opacity-30"
            onClick={sendChat}
            disabled={chatBusy || !chatInput.trim()}
          >
            ▶
          </button>
        </div>
        <div className="flex gap-3 mt-2 justify-center">
          <button
            className="text-[11px] font-mono rounded px-2 py-1 transition-colors border disabled:opacity-30 disabled:cursor-not-allowed"
            style={bestMoveVisible
              ? { color: '#34D8C8', borderColor: '#34D8C8', backgroundColor: 'rgba(52,216,200,0.12)' }
              : { color: '#34D8C8', borderColor: 'rgba(52,216,200,0.4)' }
            }
            onClick={flashBestMove}
            disabled={!hasBestMove}
          >
            Best Move?
          </button>
          <button
            className="text-[11px] text-text-muted hover:text-danger font-mono border border-divider rounded px-2 py-1 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            onClick={resignGame}
            disabled={history.length === 0}
          >
            Resign
          </button>
          <button
            className="text-[11px] text-text-muted hover:text-text-primary font-mono border border-divider rounded px-2 py-1 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            onClick={takebackMove}
            disabled={history.length === 0}
          >
            Takeback
          </button>
        </div>
      </div>
    </aside>
  )
}

function TabButton({ label, active, onClick, badge }: {
  label: string; active: boolean; onClick: () => void; badge?: number
}) {
  return (
    <button
      className={`flex-1 py-2 text-[12px] font-mono transition-colors relative ${
        active
          ? 'text-text-primary border-b-2 border-accent -mb-px'
          : 'text-text-muted hover:text-text-primary border-b-2 border-transparent -mb-px'
      }`}
      onClick={onClick}
    >
      {label}
      {badge !== undefined && (
        <span className="ml-1.5 text-[10px] bg-surface-elevated text-text-muted rounded-full px-1.5 py-0.5">
          {badge}
        </span>
      )}
    </button>
  )
}


function CommentaryCard({ move, moveIndex }: { move: MoveRecord; moveIndex: number }) {
  const fullMoveNumber = Math.floor(moveIndex / 2) + 1
  const isWhite = move.movedBy === 'w'
  const moveLabel = isWhite ? `${fullMoveNumber}. ${move.san}` : `${fullMoveNumber}... ${move.san}`
  const evalLabel = formatEval(move.evalCp, move.isMate, move.mateIn)

  return (
    <div className="bg-surface-elevated rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-divider/50">
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${isWhite ? 'bg-white' : 'bg-[#3a3a3a] border border-white/20'}`} />
          <span className="text-[12px] font-mono font-semibold text-text-primary">{moveLabel}</span>
          <span className="text-[10px] text-text-muted font-mono">{isWhite ? 'White' : 'Black'}</span>
        </div>
        {evalLabel && (
          <span className={`text-[11px] font-mono tabular-nums ${
            move.evalCp !== null && move.evalCp > 0 ? 'text-accent'
            : move.evalCp !== null && move.evalCp < 0 ? 'text-danger'
            : 'text-text-muted'
          }`}>
            {evalLabel}
          </span>
        )}
      </div>
      <div className="px-3 py-2">
        {move.commentary ? (
          <p className="text-[12px] text-text-primary leading-relaxed">
            <SquareHighlighted text={move.commentary} />
            {move.commentaryStreaming && (
              <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-accent animate-pulse align-middle rounded-sm" />
            )}
          </p>
        ) : (
          <p className="text-[12px] text-text-muted italic">Analyzing…</p>
        )}
      </div>
    </div>
  )
}

function SquareHighlighted({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|\b[a-h][1-8]\b)/g)
  return (
    <>
      {parts.map((part, i) => {
        if (/^\*\*[^*]+\*\*$/.test(part))
          return <strong key={i} className="font-semibold text-text-primary">{part.slice(2, -2)}</strong>
        if (/^\*[^*]+\*$/.test(part))
          return <em key={i} className="italic">{part.slice(1, -1)}</em>
        if (/^[a-h][1-8]$/.test(part))
          return <span key={i} className="text-accent font-mono">{part}</span>
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

function formatEval(evalCp: number | null, isMate: boolean, mateIn: number | null): string {
  if (evalCp === null) return ''
  if (isMate && mateIn !== null) return mateIn > 0 ? `M${mateIn}` : `-M${Math.abs(mateIn)}`
  if (Math.abs(evalCp) >= MATE_SENTINEL) return evalCp > 0 ? '+M' : '-M'
  const sign = evalCp >= 0 ? '+' : ''
  return `${sign}${(evalCp / 100).toFixed(2)}`
}
