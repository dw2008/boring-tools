import { useEffect, useRef, useState } from 'react'
import Board from './components/Board/Board'
import PostGame from './components/PostGame/PostGame'
import AssistantPanel from './components/AssistantPanel/AssistantPanel'
import { useGameStore } from './store/gameStore'

export default function App() {
  const status = useGameStore((s) => s.status)
  const postGame = useGameStore((s) => s.postGame)
  const initPostGame = useGameStore((s) => s.initPostGame)
  const tickClock = useGameStore((s) => s.tickClock)
  const isAnalyzing = useGameStore((s) => s.engine.isThinking)

  const [assistantOpen, setAssistantOpen] = useState(false)

  const isGameOver =
    status === 'checkmate' ||
    status === 'draw' ||
    status === 'resigned'

  // Trigger post-game digest once when the game ends
  useEffect(() => {
    if (isGameOver && !postGame) initPostGame()
  }, [isGameOver]) // eslint-disable-line react-hooks/exhaustive-deps

  // Game clock — tick every second
  const tickRef = useRef(tickClock)
  tickRef.current = tickClock
  useEffect(() => {
    const id = setInterval(() => tickRef.current(), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex h-full bg-background text-text-primary overflow-hidden">
      <main className="flex flex-1 items-center justify-center min-w-0 bg-background overflow-hidden">
        {isGameOver ? <PostGame /> : <Board />}
      </main>

      {/* Backdrop — mobile only, when drawer is open */}
      {assistantOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setAssistantOpen(false)}
        />
      )}

      <AssistantPanel isOpen={assistantOpen} onClose={() => setAssistantOpen(false)} />

      {/* Floating button to open assistant on mobile */}
      {!assistantOpen && (
        <button
          onClick={() => setAssistantOpen(true)}
          className="lg:hidden fixed bottom-4 right-4 z-30 flex items-center gap-2 bg-accent text-background rounded-full px-4 py-3 shadow-lg font-mono text-[12px] font-semibold"
          aria-label="Open assistant"
        >
          <span className={`w-2 h-2 rounded-full bg-current ${isAnalyzing ? 'animate-pulse' : ''}`} />
          Assistant
        </button>
      )}
    </div>
  )
}
