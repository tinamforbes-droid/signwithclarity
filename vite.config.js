import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { mockDecodePlugin } from './scripts/mockDecodePlugin.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    process.env.SWC_MOCK === '1' ? mockDecodePlugin() : null,
  ].filter(Boolean),
})
