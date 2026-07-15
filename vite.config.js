import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import viteCompression from 'vite-plugin-compression'

// Chrome assigns <script type="module"> a *Low* fetch priority by default —
// the browser doesn't know it's the entry point until it starts parsing, so
// it doesn't compete well against other early requests (fonts, preconnects).
// Since everything on screen depends on this chunk executing, bumping it to
// fetchpriority="high" gets it downloaded sooner, which shortens the JS
// path to LCP/TTI for the whole SPA. Same reasoning for the two vendor
// chunks that are modulepreloaded alongside it (react + http client) —
// they block first paint just as much as the entry chunk does.
// This only adds an HTML attribute; it changes no runtime behavior.
function fetchPriorityHints() {
  return {
    name: 'fetch-priority-hints',
    transformIndexHtml(html) {
      return html
        .replace(
          /(<script type="module"[^>]*src="[^"]+"[^>]*)(><\/script>)/,
          '$1 fetchpriority="high"$2'
        )
        .replace(
          /(<link rel="modulepreload"[^>]*>)/g,
          (tag) => tag.replace('>', ' fetchpriority="high">')
        );
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    fetchPriorityHints(),
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
