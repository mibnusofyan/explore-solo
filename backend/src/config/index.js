// Seluruh konfigurasi dibaca dari variabel lingkungan (lihat .env.example).
const env = process.env

function bool(v, fallback = false) {
  if (v == null || v === '') return fallback
  return ['1', 'true', 'yes'].includes(String(v).toLowerCase())
}

const isProduction = env.NODE_ENV === 'production'
const midtransServerKey = env.MIDTRANS_SERVER_KEY || ''

export const config = {
  env: env.NODE_ENV || 'development',
  isProduction,
  isTest: env.NODE_ENV === 'test',
  port: Number(env.PORT || 4000),
  appUrl: (env.APP_URL || 'http://localhost:5173').replace(/\/$/, ''),
  corsOrigins: (env.CORS_ORIGIN || env.APP_URL || 'http://localhost:5173').split(',').map((s) => s.trim()),
  sessionSecret: env.SESSION_SECRET || (isProduction ? '' : 'dev-only-secret-ganti-di-produksi'),
  sessionMaxAgeHours: Number(env.SESSION_MAX_AGE_HOURS || 24 * 7),
  db: {
    host: env.DB_HOST || '127.0.0.1',
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USER || 'explore_solo',
    password: env.DB_PASSWORD || '',
    database: env.DB_NAME || 'explore_solo',
  },
  uploadDir: env.UPLOAD_DIR || new URL('../../uploads/', import.meta.url).pathname,
  frontendDist: env.FRONTEND_DIST || new URL('../../../frontend/dist/', import.meta.url).pathname,
  paymentWindowMinutes: Number(env.PAYMENT_WINDOW_MINUTES || 60),
  midtrans: {
    serverKey: midtransServerKey,
    clientKey: env.MIDTRANS_CLIENT_KEY || '',
    isProduction: bool(env.MIDTRANS_IS_PRODUCTION),
    enabled: Boolean(midtransServerKey),
  },
  // Simulasi pembayaran hanya aktif bila Midtrans belum dikonfigurasi dan bukan produksi.
  paymentSimulation: bool(env.PAYMENT_SIMULATION, !midtransServerKey && !isProduction),
  mail: {
    host: env.SMTP_HOST || '',
    port: Number(env.SMTP_PORT || 587),
    secure: bool(env.SMTP_SECURE),
    user: env.SMTP_USER || '',
    pass: env.SMTP_PASS || '',
    from: env.MAIL_FROM || 'Explore Solo <no-reply@exploresolo.id>',
  },
}

if (isProduction && !config.sessionSecret) {
  throw new Error('SESSION_SECRET wajib diisi di produksi.')
}
