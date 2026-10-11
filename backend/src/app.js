import { existsSync } from 'node:fs'
import { join } from 'node:path'
import express from 'express'
import session from 'express-session'
import helmet from 'helmet'
import cors from 'cors'
import morgan from 'morgan'
import { config } from './config/index.js'
import { csrfProtection } from './middleware/csrf.js'
import { loadUser } from './middleware/auth.js'
import { errorHandler, notFoundHandler } from './middleware/error.js'
import { MySQLSessionStore } from './middleware/sessionStore.js'
import routes from './routes/index.js'

export function createApp() {
  const app = express()
  app.set('trust proxy', 1)
  app.disable('x-powered-by')

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'", 'https://app.sandbox.midtrans.com', 'https://app.midtrans.com'],
          'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          'font-src': ["'self'", 'https://fonts.gstatic.com'],
          'img-src': ["'self'", 'data:', 'blob:', 'https://*.tile.openstreetmap.org'],
          'connect-src': ["'self'", 'https://*.midtrans.com'],
          'frame-src': ['https://app.sandbox.midtrans.com', 'https://app.midtrans.com'],
          'media-src': ["'self'", 'blob:'],
          // Hanya di produksi (HTTPS); di http://localhost aturan ini memutus pemuatan aset.
          'upgrade-insecure-requests': config.isProduction ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  )
  app.use(cors({ origin: config.corsOrigins, credentials: true }))
  if (!config.isTest) app.use(morgan(config.isProduction ? 'combined' : 'dev'))
  app.use(express.json({ limit: '200kb' }))

  app.use(
    session({
      name: 'es.sid',
      secret: config.sessionSecret,
      store: new MySQLSessionStore(),
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.isProduction,
        maxAge: config.sessionMaxAgeHours * 3_600_000,
      },
    }),
  )

  app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }))
  app.use('/api', csrfProtection({ exempt: ['/payments/midtrans/notification'] }), loadUser, routes)
  app.use('/api', notFoundHandler)

  app.use('/uploads', express.static(config.uploadDir, { maxAge: '7d', fallthrough: false }))

  // Produksi: layani hasil build React dari satu server yang sama.
  if (existsSync(join(config.frontendDist, 'index.html'))) {
    app.use(express.static(config.frontendDist, { index: false, maxAge: '1h' }))
    app.get(/^\/(?!api|uploads).*/, (_req, res) => res.sendFile(join(config.frontendDist, 'index.html')))
  }

  app.use(errorHandler)
  return app
}
