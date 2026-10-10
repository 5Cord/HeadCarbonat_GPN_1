import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  build: {
    sourcemap: false,
  },
  esbuild: {
    drop: command === 'build' ? ['console', 'debugger'] : [],
  },
}))
