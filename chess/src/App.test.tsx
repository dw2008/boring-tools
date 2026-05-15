import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import App from './App'

// Stockfish worker can't run in jsdom — stub it out
vi.stubGlobal(
  'Worker',
  class {
    onmessage: null = null
    onerror: null = null
    postMessage() {}
    terminate() {}
  },
)

// react-chessboard uses ResizeObserver — stub it
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
)

describe('App', () => {
  it('renders without crashing and mounts the board', () => {
    render(<App />)
    // Sidebar nav item
    expect(screen.getByText('Play')).toBeInTheDocument()
    // Assistant panel header
    expect(screen.getByText('Aether Assistant')).toBeInTheDocument()
  })
})
