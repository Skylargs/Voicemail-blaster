import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    proxy: {
      '/auth': 'http://localhost:3000',
      '/campaigns': 'http://localhost:3000',
      '/call-logs': 'http://localhost:3000',
      '/settings': 'http://localhost:3000',
      '/billing': 'http://localhost:3000',
      '/voicemail-audio': 'http://localhost:3000',
      '/media': 'http://localhost:3000',
      '/onboarding': 'http://localhost:3000',
    },
  },
})