// vite.config.js

import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Same path as production (vercel.json). Default → live SAE so local UI works
// without uvicorn. For a local backend:
//   BRIGHTNEST_API_PROXY_TARGET=http://127.0.0.1:8000
const brightnestProxy = (env) => {
  const target =
    env.BRIGHTNEST_API_PROXY_TARGET ||
    env.VITE_BRIGHTNEST_API_PROXY_TARGET ||
    'http://47.242.157.72:8000'
  return {
    '/brightnest-api': {
      target,
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/brightnest-api/, ''),
    },
  }
}

/**
 * Dev/preview: map /clozzz-overlay and /clozzz-overlay/:session to the MPA
 * directory entry (dist/clozzz-overlay/index.html). Vite's SPA fallback would
 * otherwise steal these paths to /index.html (plaza).
 */
function clozzzOverlayRewrite() {
  const rewrite = (req, _res, next) => {
    const url = req.url || ''
    const qIndex = url.indexOf('?')
    const path = qIndex >= 0 ? url.slice(0, qIndex) : url
    const query = qIndex >= 0 ? url.slice(qIndex) : ''
    if (path === '/clozzz-overlay' || path === '/clozzz-overlay/') {
      req.url = `/clozzz-overlay/index.html${query}`
    } else if (path.startsWith('/clozzz-overlay/')) {
      // Keep deep session URLs on the overlay entry (not plaza SPA).
      req.url = `/clozzz-overlay/index.html${query}`
    }
    next()
  }
  return {
    name: 'clozzz-overlay-rewrite',
    configureServer(server) {
      server.middlewares.use(rewrite)
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewrite)
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss(), clozzzOverlayRewrite()],
    server: {
      proxy: brightnestProxy(env),
    },
    preview: {
      proxy: brightnestProxy(env),
    },
    build: {
      rollupOptions: {
        input: {
          main: 'index.html',
          calculatorEn: 'calculator-en.html',
          calculatorZh: 'calculator-zh.html',
          poke: 'poke-team-predictor.html',
          podcast: 'podcast-project.html',
          littleScholarsBot: 'little-scholars-bot.html',
          comp6708A3Demo: 'comp6708-a3-demo.html',
          clozzzOverlay: 'clozzz-overlay/index.html',
        }
      }
    }
  }
})