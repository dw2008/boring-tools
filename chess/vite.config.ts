import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const coopCoepHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'wasm-mime',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.endsWith('.wasm')) {
            res.setHeader('Content-Type', 'application/wasm')
          }
          next()
        })
      },
    },
  ],
  worker: {
    format: 'es',
  },
  server: {
    headers: coopCoepHeaders,
  },
  preview: {
    headers: coopCoepHeaders,
  },
})
