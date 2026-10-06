import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

const proxy = { '/api': { target: 'http://127.0.0.1:5000', changeOrigin: true } };
export default defineConfig({
  envDir: '../server',
  plugins: [react(), tailwindcss()],
  server: { proxy, fs: { allow: ['..'] } },
  preview: { proxy },
})
