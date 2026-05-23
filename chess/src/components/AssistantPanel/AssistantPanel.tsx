import { useEffect, useRef } from 'react'
import { useGameStore } from '../../store/gameStore'
import type { MoveRecord } from '../../store/gameStore'

const MATE_SENTINEL = 10_000

export default function AssistantPanel() {
  const engine = useGameStore((s) => s.engine)
  const history = useGameStore((s) => s.history)
  const status = useGameStore((s) => s.status)
  const resetGame = useGameStore((s) => s.resetGame)
  const resignGame = useGameStore((s) => s.resignGame)

  const isAnalyzing = engine.isThinking
  const evalLabel = formatEval(engine.evalCp, engine.isMate, engine.mateIn)

  const feedRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom when new content arrives
  useEffect(() => {
    const el = feedRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [history])

  return (
    <aside className="flex flex-col w-[380px] shrink-0 bg-surface border-l border-divider h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-divider">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isAnalyzing ? 'bg-accent animate-pulse' : 'bg-text-muted'}`} />
          <span className="text-[13px] font-semibold text-text-primary">Aether Assistant</span>
        </div>
        <span className="text-[11px] text-text-muted font-mono">
          {isAnalyzing ? '• Analyzing...' : evalLabel ? `• ${evalLabel}` : '• Ready'}
        </span>
      </div>

      {/* Feed */}
      <div ref={feedRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {history.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[12px] text-text-muted text-center">
              Strategic insights will appear here after each move.
            </p>
          </div>
        ) : (
          history.map((move, i) => (
            <CommentaryCard key={i} move={move} moveIndex={i} />
          ))
        )}

        {/* Game over banner */}
        {(status === 'checkmate' || status === 'draw' || status === 'resigned') && (
          <div className="bg-surface-elevated border border-accent/30 rounded p-3 text-center mt-2">
            <p className="text-[13px] text-accent font-semibold">
              {status === 'checkmate' ? 'Checkmate' : status === 'draw' ? 'Draw' : 'Resigned'}
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 py-3 border-t border-divider">
        <div className="flex items-center gap-2 bg-surface-elevated rounded px-3 py-2">
          <input
            className="flex-1 bg-transparent text-[13px] text-text-primary placeholder-text-muted outline-none"
            placeholder="Ask for advice or suggest a move..."
            disabled
          />
          <button className="text-accent">▶</button>
        </div>
        <div className="flex gap-3 mt-2 justify-center">
          <button className="text-[11px] text-accent border border-accent/40 hover:bg-accent/10 font-mono rounded px-2 py-1 transition-colors">
            Best Move?
          </button>
          <button
            className="text-[11px] text-text-muted hover:text-danger font-mono border border-divider rounded px-2 py-1 transition-colors"
            onClick={resignGame}
            disabled={history.length === 0}
          >
            Resign
          </button>
          <button className="text-[11px] text-text-muted hover:text-text-primary font-mono border border-divider rounded px-2 py-1 transition-colors">
            Takeback
          </button>
        </div>
      </div>
    </aside>
  )
}

function CommentaryCard({ move, moveIndex }: { move: MoveRecord; moveIndex: number }) {
  const fullMoveNumber = Math.floor(moveIndex / 2) + 1
  const isWhite = move.movedBy === 'w'
  const moveLabel = isWhite
    ? `${fullMoveNumber}. ${move.san}`
    : `${fullMoveNumber}... ${move.san}`

  const evalLabel = formatEval(move.evalCp, move.isMate, move.mateIn)

  return (
    <div className="bg-surface-elevated rounded-lg overflow-hidden">
      {/* Move header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-divider/50">
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${isWhite ? 'bg-[#E6EEF5]' : 'bg-[#141B22] border border-text-muted'}`} />
          <span className="text-[12px] font-mono font-semibold text-text-primary">{moveLabel}</span>
          <span className="text-[10px] text-text-muted font-mono">{isWhite ? 'White' : 'Black'}</span>
        </div>
        {evalLabel && (
          <span className={`text-[11px] font-mono tabular-nums ${
            move.evalCp !== null && move.evalCp > 0
              ? 'text-[#E6EEF5]'
              : move.evalCp !== null && move.evalCp < 0
              ? 'text-danger'
              : 'text-text-muted'
          }`}>
            {evalLabel}
          </span>
        )}
      </div>

      {/* Commentary body */}
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
  const parts = text.split(/\b([a-h][1-8])\b/g)
  return (
    <>
      {parts.map((part, i) =>
        /^[a-h][1-8]$/.test(part) ? (
          <span key={i} className="text-accent font-mono">{part}</span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  )
}

function formatEval(
  evalCp: number | null,
  isMate: boolean,
  mateIn: number | null,
): string {
  if (evalCp === null) return ''
  if (isMate && mateIn !== null) return mateIn > 0 ? `M${mateIn}` : `-M${Math.abs(mateIn)}`
  if (Math.abs(evalCp) >= MATE_SENTINEL) return evalCp > 0 ? '+M' : '-M'
  const sign = evalCp >= 0 ? '+' : ''
  return `${sign}${(evalCp / 100).toFixed(2)}`
}
