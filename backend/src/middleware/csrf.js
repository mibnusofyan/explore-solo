import { timingSafeEqual } from 'node:crypto'
import { token } from '../utils/ids.js'
import { HttpError } from '../utils/httpError.js'

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS'])

export function ensureCsrfToken(req) {
  if (!req.session.csrfToken) req.session.csrfToken = token(24)
  return req.session.csrfToken
}

/**
 * Proteksi CSRF (SRS 2.5) dengan synchronizer token: token disimpan di sesi dan wajib
 * dikirim ulang lewat header X-CSRF-Token pada setiap permintaan yang mengubah data.
 */
export function csrfProtection({ exempt = [] } = {}) {
  return (req, _res, next) => {
    if (SAFE.has(req.method) || exempt.some((p) => req.path.startsWith(p))) return next()
    const expected = req.session?.csrfToken
    const got = req.get('x-csrf-token') || ''
    const ok =
      expected && got.length === expected.length && timingSafeEqual(Buffer.from(got), Buffer.from(expected))
    if (!ok) return next(new HttpError(403, 'Sesi formulir kedaluwarsa. Muat ulang halaman lalu coba lagi.', undefined, 'CSRF'))
    next()
  }
}
