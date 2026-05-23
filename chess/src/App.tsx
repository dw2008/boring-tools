import { useEffect, useRef } from 'react'
import Board from './components/Board/Board'
import PostGame from './components/PostGame/PostGame'
import AssistantPanel from './components/AssistantPanel/AssistantPanel'
import { useGameStore } from './store/gameStore'

export default function App() {
  const status = useGameStore((s) => s.status)
  const postGame = useGameStore((s) => s.postGame)
  const initPostGame = useGameStore((s) => s.initPostGame)
  const tickClock = useGameStore((s) => s.tickClock)

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

      <AssistantPanel />
    </div>
  )
}
