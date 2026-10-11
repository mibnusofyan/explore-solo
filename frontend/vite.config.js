import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Saat pengembangan, /api dan /uploads diteruskan ke backend Express sehingga cookie sesi
// berada di origin yang sama dengan halaman.
const backend = process.env.VITE_BACKEND_URL || 'http://localhost:4000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': backend,
      '/uploads': backend,
    },
  },
})
