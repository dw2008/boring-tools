import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const coopCoepHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

export default defineConfig({
  plugins: [react()],
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
