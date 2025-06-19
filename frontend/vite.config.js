import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
export default defineConfig({
  plugins: [
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/api': { // If the request starts with /api
        target: 'http://localhost:4000', // Forward it to your backend
        changeOrigin: true, // Necessary for virtual hosted sites
        rewrite: (path) => path.replace(/^\/api/, '/api'), // Rewrite /api to /api (or remove if your backend also uses /api)
      },
    },
  },
})