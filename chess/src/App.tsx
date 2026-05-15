import { useEffect } from 'react'
import Sidebar from './components/Sidebar/Sidebar'
import Board from './components/Board/Board'
import AssistantPanel from './components/AssistantPanel/AssistantPanel'

export default function App() {
  useEffect(() => {
    const worker = new Worker(
      new URL('./workers/stockfish.worker.ts', import.meta.url),
      { type: 'module' },
    )

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data as { type: string }
      if (msg.type === 'ready') {
        console.log('[Aether] Stockfish worker ready ✓')
      }
    }

    worker.onerror = (err) => {
      console.error('[Aether] Stockfish worker error:', err)
    }

    worker.postMessage({ type: 'init' })

    return () => worker.terminate()
  }, [])

  return (
    <div className="flex h-full bg-background text-text-primary overflow-hidden">
      <Sidebar activeNav="Play" />

      <main className="flex flex-1 items-center justify-center min-w-0 bg-background">
        <Board />
      </main>

      <AssistantPanel />
    </div>
  )
}
