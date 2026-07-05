import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import viteCompression from 'vite-plugin-compression'

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    // Pre-compress build output — most static hosts (Render, Netlify, etc.)
    // will serve the .gz/.br file directly when present, cutting transfer
    // size drastically for JS/CSS.
    viteCompression({ algorithm: 'gzip', ext: '.gz', threshold: 1024 }),
    viteCompression({ algorithm: 'brotliCompress', ext: '.br', threshold: 1024 }),
  ],

  server: {
    port: 3000,
  },

  build: {
    outDir: 'dist',
    target: 'es2018',
    // esbuild minifier (default) is faster than terser and produces
    // comparably small output for this app's size.
    minify: 'esbuild',
    cssMinify: true,
    sourcemap: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // Split large, rarely-changing vendor libs into their own chunks so
        // the browser can cache them independently of app code, and so a
        // route that doesn't need e.g. recharts/react-window never pays
        // for it.
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-charts': ['recharts'],
          'vendor-realtime': ['@stomp/stompjs', 'sockjs-client'],
          'vendor-http': ['axios'],
        },
      },
    },
  },

  esbuild: {
    // Strip console/debugger statements from production output.
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  },
}))
