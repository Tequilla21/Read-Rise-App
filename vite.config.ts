import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // 👇 important for GitHub Pages (project page)
  base: '/Read-Rise-App/', // replace with your repo name
})
