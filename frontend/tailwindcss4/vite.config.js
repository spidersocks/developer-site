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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss()],
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
          comp6708A3Demo: 'comp6708-a3-demo.html'
        }
      }
    }
  }
})