import { useCallback, useEffect, useRef } from 'react'
import { Chessboard } from 'react-chessboard'
import type { Square } from 'chess.js'
import type { PieceDropHandlerArgs } from 'react-chessboard'
import { useGameStore } from '../../store/gameStore'
import { getEngine } from '../../lib/engine/engine'
import { getCommentary } from '../../lib/llm'
import EvalBar from './EvalBar'

const ENGINE_COLOR = 'b'
const ENGINE_DEPTH = 14

export default function Board() {
  const fen = useGameStore((s) => s.fen)
  const history = useGameStore((s) => s.history)
  const status = useGameStore((s) => s.status)
  const applyMove = useGameStore((s) => s.applyMove)
  const setEngineResult = useGameStore((s) => s.setEngineResult)
  const setEngineThinking = useGameStore((s) => s.setEngineThinking)
  const appendMoveCommentary = useGameStore((s) => s.appendMoveCommentary)
  const finalizeMoveCommentary = useGameStore((s) => s.finalizeMoveCommentary)
  const setMoveCommentaryStreaming = useGameStore((s) => s.setMoveCommentaryStreaming)
  const getCommentaryForFen = useGameStore((s) => s.getCommentaryForFen)
  const engineEval = useGameStore((s) => s.engine.evalCp)
  const bestMove = useGameStore((s) => s.engine.bestMove)
  const bestMoveVisible = useGameStore((s) => s.bestMoveVisible)
  const clock = useGameStore((s) => s.clock)

  const historyRef = useRef(history)
  historyRef.current = history

  // Whether it's the engine's turn to move
  const isEngineTurn = history.length > 0
    && fen.split(' ')[1] === ENGINE_COLOR
    && status === 'playing'

  useEffect(() => {
    if (history.length === 0) return
    if (status === 'checkmate' || status === 'draw' || status === 'resigned') return

    const currentFen = fen
    const sideToMove = currentFen.split(' ')[1] as 'w' | 'b'
    const movedBy: 'w' | 'b' = sideToMove === 'w' ? 'b' : 'w'
    const engineTurn = sideToMove === ENGINE_COLOR

    // --- Engine evaluation (always) + play if it's the engine's turn ---
    setEngineThinking(true)
    getEngine()
      .evaluate(currentFen, { depth: ENGINE_DEPTH })
      .then((result) => {
        setEngineResult({
          evalCp: result.evalCp,
          bestMove: result.bestMove,
          pv: result.pv,
          depth: result.depth,
          isMate: result.isMate,
          mateIn: result.mateIn,
        })

        if (engineTurn && result.bestMove && result.bestMove !== '(none)') {
          setTimeout(() => {
            if (useGameStore.getState().status !== 'playing') return
            const from = result.bestMove.slice(0, 2) as Square
            const to = result.bestMove.slice(2, 4) as Square
            const promotion = result.bestMove[4] ?? undefined
            useGameStore.getState().applyMove({ from, to, promotion })
          }, 1500)
        }
      })
      .catch((err) => {
        console.error('[chess] Engine error:', err)
        setEngineThinking(false)
      })

    // --- Commentary ---
    // Capture the move index now — history may grow while the async work runs
    const moveIndex = historyRef.current.length - 1

    if (getCommentaryForFen(currentFen)) return

    const lastMove = historyRef.current[moveIndex]
    const prevEval =
      moveIndex >= 1 ? (historyRef.current[moveIndex - 1].evalCp ?? 0) : 0

    setMoveCommentaryStreaming(true, moveIndex)
    ;(async () => {
      // Safety timeout — clears the streaming indicator if the API call hangs
      const safetyTimer = setTimeout(() => {
        console.warn('[chess] Commentary timed out for move', moveIndex)
        finalizeMoveCommentary(moveIndex)
      }, 20_000)

      try {
        const engineState = useGameStore.getState().engine
        console.log('[chess] Requesting commentary for move', moveIndex, lastMove?.san)
        await getCommentary(
          {
            fen: currentFen,
            lastMoveSan: lastMove?.san ?? '',
            engineEval: engineState.evalCp ?? 0,
            bestMove: engineState.bestMove ?? '',
            pv: engineState.pv ?? [],
            evalDelta: (engineState.evalCp ?? 0) - prevEval,
            movedBy,
          },
          (chunk) => appendMoveCommentary(chunk, moveIndex),
        )
        console.log('[chess] Commentary done for move', moveIndex)
      } catch (err) {
        console.error('[chess] LLM error for move', moveIndex, err)
      } finally {
        clearTimeout(safetyTimer)
        finalizeMoveCommentary(moveIndex)
      }
    })()
  }, [fen]) // eslint-disable-line react-hooks/exhaustive-deps

  const onPieceDrop = useCallback(
    ({ piece, sourceSquare, targetSquare }: PieceDropHandlerArgs) => {
      if (targetSquare === null) return false
      // Block moves when it's not the player's turn
      if (useGameStore.getState().fen.split(' ')[1] === ENGINE_COLOR) return false

      const isPawn = piece.pieceType[1]?.toUpperCase() === 'P'
      const isPromotionRank = targetSquare[1] === '8' || targetSquare[1] === '1'

      return applyMove({
        from: sourceSquare as Square,
        to: targetSquare as Square,
        promotion: isPawn && isPromotionRank ? 'q' : undefined,
      })
    },
    [applyMove],
  )

  return (
    <div className="flex flex-col items-center justify-center w-full h-full px-4">
      <div className="flex items-center justify-between w-full max-w-[720px] mb-3 px-1">
        <span className="text-[12px] text-text-muted font-mono uppercase tracking-widest">
          MATCH: <span className="text-text-primary">You vs boring engine</span>
        </span>
        <span className="text-[12px] text-text-muted font-mono">
          {(status === 'playing' || status === 'idle') && (
            isEngineTurn ? '⏳ Engine thinking...' : `⏱ ${formatElapsed(clock.elapsed)}`
          )}
        </span>
      </div>

      <div className="flex gap-3 w-full max-w-[720px]">
        <EvalBar evalCp={engineEval} />
        <div className="flex-1 aspect-square">
          <Chessboard
            options={{
              position: fen,
              onPieceDrop,
              darkSquareStyle: { backgroundColor: '#1E2D3D' },
              lightSquareStyle: { backgroundColor: '#3B5268' },
              dropSquareStyle: { backgroundColor: '#34D8C8', opacity: 0.35 },
              arrows: bestMoveVisible && bestMove && bestMove !== '(none)'
                ? [{ startSquare: bestMove.slice(0, 2), endSquare: bestMove.slice(2, 4), color: '#34D8C8' }]
                : [],
            }}
          />
        </div>
      </div>
    </div>
  )
}

function formatElapsed(seconds: number): string {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0')
  const secs = (seconds % 60).toString().padStart(2, '0')
  return `${mins}:${secs}`
}
