import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Semua panggilan /api diteruskan ke backend FastAPI (Web3.py) di port 8000.
const proxy = { '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true } }

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy },
  preview: { port: 5173, proxy },
})
