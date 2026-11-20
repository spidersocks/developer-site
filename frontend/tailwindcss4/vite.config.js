// vite.config.js

import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import {
  AUTH_PATH,
  COOKIE_NAME,
  buildSetCookie,
  gatePageHtml,
  readCookie,
  safeNextPath,
  unlockToken,
} from './lib/clozzz-overlay-gate.js'

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

function sendJson(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body)
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  for (const [k, v] of Object.entries(extraHeaders)) {
    res.setHeader(k, v)
  }
  res.end(payload)
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

/**
 * Local mirror of Vercel edge gate + /api/clozzz-overlay-auth.
 * Password from CLOZZZ_OVERLAY_PASSWORD (.env.local). Unset = no gate.
 */
function clozzzOverlayGate(env) {
  const password = env.CLOZZZ_OVERLAY_PASSWORD || ''

  const attach = (server) => {
    server.middlewares.use(async (req, res, next) => {
      const rawUrl = req.url || '/'
      const host = req.headers.host || 'localhost'
      const url = new URL(rawUrl, `http://${host}`)

      if (url.pathname === AUTH_PATH) {
        if (req.method === 'GET') {
          if (!password) {
            return sendJson(res, 200, { ok: true, unlocked: true, gate: 'off' })
          }
          const expected = await unlockToken(password)
          const cookie = readCookie(req.headers.cookie, COOKIE_NAME)
          return sendJson(res, 200, {
            ok: true,
            unlocked: cookie === expected,
            gate: 'on',
          })
        }

        if (req.method !== 'POST') {
          return sendJson(res, 405, { ok: false, error: 'Method not allowed' })
        }

        const raw = await readRequestBody(req)
        const contentType = req.headers['content-type'] || ''
        let submitted = ''
        let remember = false
        let nextPath = '/clozzz-overlay'

        if (contentType.includes('application/json')) {
          try {
            const body = JSON.parse(raw || '{}')
            submitted = String(body.password ?? '')
            remember = Boolean(body.remember)
            nextPath = safeNextPath(body.next)
          } catch {
            return sendJson(res, 400, { ok: false, error: 'Invalid JSON' })
          }
        } else {
          const params = new URLSearchParams(raw)
          submitted = String(params.get('password') ?? '')
          remember =
            params.get('remember') === '1' ||
            params.get('remember') === 'on' ||
            params.get('remember') === 'true'
          nextPath = safeNextPath(params.get('next'))
        }

        const wantsJson = (req.headers.accept || '').includes('application/json')

        if (!password) {
          return sendJson(res, 200, { ok: true, next: nextPath, gate: 'off' })
        }

        if (submitted !== password) {
          if (wantsJson) {
            return sendJson(res, 401, { ok: false, error: 'Incorrect password' })
          }
          res.statusCode = 401
          res.setHeader('content-type', 'text/html; charset=utf-8')
          res.setHeader('cache-control', 'no-store')
          res.end(gatePageHtml({ nextPath, error: 'Incorrect password' }))
          return
        }

        const token = await unlockToken(password)
        const setCookie = buildSetCookie(token, {
          remember,
          secure: false, // localhost http
        })

        if (wantsJson) {
          return sendJson(
            res,
            200,
            { ok: true, next: nextPath },
            { 'set-cookie': setCookie }
          )
        }

        res.statusCode = 303
        res.setHeader('set-cookie', setCookie)
        res.setHeader('location', nextPath)
        res.end()
        return
      }

      if (!password) {
        return next()
      }

      const isOverlay =
        url.pathname === '/clozzz-overlay' ||
        url.pathname === '/clozzz-overlay/' ||
        url.pathname.startsWith('/clozzz-overlay/')

      if (!isOverlay || req.method !== 'GET') {
        return next()
      }

      const expected = await unlockToken(password)
      const cookie = readCookie(req.headers.cookie, COOKIE_NAME)
      if (cookie === expected) {
        return next()
      }

      const nextUrl = new URL(url.href)
      nextUrl.searchParams.delete('gate_error')
      res.statusCode = 401
      res.setHeader('content-type', 'text/html; charset=utf-8')
      res.setHeader('cache-control', 'no-store')
      res.end(
        gatePageHtml({
          nextPath: `${nextUrl.pathname}${nextUrl.search}`,
          error: url.searchParams.get('gate_error') || '',
        })
      )
    })
  }

  return {
    name: 'clozzz-overlay-gate',
    configureServer(server) {
      attach(server)
    },
    configurePreviewServer(server) {
      attach(server)
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
    // Gate before rewrite so locked visitors never hit the overlay entry.
    plugins: [react(), tailwindcss(), clozzzOverlayGate(env), clozzzOverlayRewrite()],
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
