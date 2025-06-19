import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/', // Changed from '/studiora/' to '/'
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Optimize for GitHub Pages
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          utils: ['lodash', 'papaparse']
        }
      }
    }
  },
  // Development server configuration
  server: {
    port: 3000,
    open: true
  },
  // Preview server configuration
  preview: {
    port: 4173,
    open: true
  }
})
