import { useEffect } from 'react'
import type React from 'react'
import { useGameStore } from '../../store/gameStore'
import { getPostGameDigest } from '../../lib/llm'
import type { KeyMoment } from '../../store/gameStore'

export default function PostGame() {
  const status = useGameStore((s) => s.status)
  const history = useGameStore((s) => s.history)
  const chess = useGameStore((s) => s.chess)
  const postGame = useGameStore((s) => s.postGame)
  const resetGame = useGameStore((s) => s.resetGame)
  const initPostGame = useGameStore((s) => s.initPostGame)
  const appendDigest = useGameStore((s) => s.appendDigest)
  const finalizeDigest = useGameStore((s) => s.finalizeDigest)

  const resultLabel =
    status === 'checkmate'
      ? history[history.length - 1]?.movedBy === 'w'
        ? 'You win'
        : 'Engine wins'
      : status === 'draw'
      ? 'Draw'
      : 'You resigned'

  // Kick off digest generation once, when postGame is first initialised
  useEffect(() => {
    if (!postGame || postGame.digest !== '' || !postGame.isGenerating) return

    const pgn = chess.pgn()
    ;(async () => {
      try {
        await getPostGameDigest(
          {
            pgn,
            keyMoments: postGame.keyMoments.map((m) => ({
              moveNumber: m.moveNumber,
              san: m.san,
              movedBy: m.movedBy,
              evalBefore: m.evalBefore,
              evalAfter: m.evalAfter,
              delta: m.delta,
            })),
          },
          (chunk) => appendDigest(chunk),
        )
      } catch (err) {
        console.error('[chess] Post-game digest error:', err)
      } finally {
        finalizeDigest()
      }
    })()
  }, [postGame?.isGenerating]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!postGame) return null

  return (
    <div className="flex flex-col w-full h-full overflow-y-auto px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-mono text-text-muted uppercase tracking-widest mb-1">
            Game Over
          </p>
          <h1 className="text-2xl font-semibold text-text-primary">{resultLabel}</h1>
          {status === 'checkmate' && history[history.length - 1]?.movedBy === 'b' && (
            <p className="text-[13px] text-text-muted mt-1">Stockfish never holds back — try easy mode for a fairer fight.</p>
          )}
          {status === 'resigned' && (
            <p className="text-[13px] text-text-muted mt-1">Knowing when to stop is part of it. Try again?</p>
          )}
        </div>
        <button
          onClick={resetGame}
          className="px-4 py-2 rounded bg-accent text-background text-[13px] font-semibold hover:opacity-90 transition-opacity"
        >
          New Game
        </button>
      </div>

      <div className="h-px bg-divider" />

      {/* Key moments */}
      {postGame.keyMoments.length > 0 && (
        <section className="space-y-2">
          <p className="text-[11px] font-mono text-text-muted uppercase tracking-widest">
            Key Moments
          </p>
          <div className="space-y-2">
            {postGame.keyMoments
              .sort((a, b) => a.moveIndex - b.moveIndex)
              .map((m) => (
                <KeyMomentCard key={m.moveIndex} moment={m} />
              ))}
          </div>
        </section>
      )}

      {/* Digest */}
      <section className="space-y-2">
        <p className="text-[11px] font-mono text-text-muted uppercase tracking-widest">
          Analysis
        </p>
        <div className="bg-surface-elevated rounded-lg p-4">
          {postGame.digest ? (
            <div>
              <DigestRenderer text={postGame.digest} />
              {postGame.isGenerating && (
                <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-accent animate-pulse align-middle rounded-sm" />
              )}
            </div>
          ) : (
            <p className="text-[13px] text-text-muted italic">Generating analysis…</p>
          )}
        </div>
      </section>
    </div>
  )
}

function KeyMomentCard({ moment }: { moment: KeyMoment }) {
  const isBlunder = moment.movedBy === 'w'
    ? moment.evalAfter < moment.evalBefore
    : moment.evalAfter > moment.evalBefore

  const moveLabel =
    moment.movedBy === 'w'
      ? `${moment.moveNumber}. ${moment.san}`
      : `${moment.moveNumber}… ${moment.san}`

  const evalBefore = (moment.evalBefore / 100).toFixed(2)
  const evalAfter = (moment.evalAfter / 100).toFixed(2)
  const sign = moment.evalAfter >= 0 ? '+' : ''

  return (
    <div className="flex items-center gap-3 bg-surface-elevated rounded-lg px-3 py-2">
      <div className={`w-1 self-stretch rounded-full ${isBlunder ? 'bg-danger' : 'bg-accent'}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-mono font-semibold text-text-primary">{moveLabel}</span>
          <span className="text-[10px] text-text-muted font-mono">
            {moment.movedBy === 'w' ? 'White' : 'Black'}
          </span>
        </div>
        <p className="text-[11px] text-text-muted font-mono">
          {evalBefore} → {sign}{evalAfter}
        </p>
      </div>
      <span className={`text-[12px] font-mono tabular-nums ${isBlunder ? 'text-danger' : 'text-accent'}`}>
        {isBlunder ? '−' : '+'}{(moment.delta / 100).toFixed(2)}
      </span>
    </div>
  )
}

// Renders a markdown-lite digest: ## headers, paragraphs, square highlights
function DigestRenderer({ text }: { text: string }) {
  const lines = text.split('\n')
  const nodes: React.ReactNode[] = []

  lines.forEach((line, i) => {
    if (/^###\s+/.test(line)) {
      nodes.push(
        <p key={i} className="text-[11px] font-mono text-text-muted uppercase tracking-widest mt-4 mb-1">
          {line.replace(/^###\s+/, '')}
        </p>,
      )
    } else if (/^##\s+/.test(line)) {
      nodes.push(
        <p key={i} className="text-[13px] font-semibold text-text-primary mt-4 mb-1">
          {line.replace(/^##\s+/, '')}
        </p>,
      )
    } else if (/^#\s+/.test(line)) {
      nodes.push(
        <p key={i} className="text-[15px] font-semibold text-text-primary mt-4 mb-1">
          {line.replace(/^#\s+/, '')}
        </p>,
      )
    } else if (line.trim() === '') {
      nodes.push(<div key={i} className="h-2" />)
    } else {
      nodes.push(
        <p key={i} className="text-[13px] text-text-primary leading-relaxed">
          <InlineHighlights text={line} />
        </p>,
      )
    }
  })

  return <>{nodes}</>
}

function InlineHighlights({ text }: { text: string }) {
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
