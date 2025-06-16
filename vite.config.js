// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages deployment configuration
  base: process.env.NODE_ENV === 'production' ? '/studiora/' : '/',
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
