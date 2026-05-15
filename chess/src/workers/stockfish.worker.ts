// Stockfish 16 WASM web worker stub
// Loads the engine, performs UCI handshake, posts 'ready' to main thread.
// Full UCI wrapper (evaluate, bestmove queue) is implemented in src/lib/engine/.

/// <reference lib="webworker" />

// The stockfish npm package ships a self-contained JS/WASM bundle.
// We import it as a URL so Vite treats it as an asset, then load it via
// importScripts — the only reliable way to get Stockfish's emscripten
// module running inside a worker context.
import stockfishUrl from 'stockfish/src/stockfish-nnue-16-single.js?url'

let sf: Worker | null = null

function initEngine() {
  // Stockfish's own JS file is itself a worker script; we load it with
  // importScripts so it runs in THIS worker's global scope.
  // eslint-disable-next-line no-restricted-globals
  importScripts(stockfishUrl)

  // After importScripts, Stockfish registers a global `Stockfish` factory.
  // @ts-expect-error: Stockfish global injected by importScripts
  const engine = Stockfish() as { postMessage: (msg: string) => void; onmessage: ((e: MessageEvent) => void) | null }

  engine.onmessage = (e: MessageEvent) => {
    const line = typeof e === 'string' ? e : (e.data as string)

    if (line === 'uciok') {
      engine.postMessage('isready')
    }

    if (line === 'readyok') {
      postMessage({ type: 'ready' })
    }
  }

  engine.postMessage('uci')
  sf = engine as unknown as Worker
  return engine
}

self.onmessage = (e: MessageEvent) => {
  const msg = e.data as { type: string; payload?: unknown }

  if (msg.type === 'init') {
    initEngine()
  }

  if (msg.type === 'uci' && sf) {
    sf.postMessage(msg.payload as string)
  }
}
