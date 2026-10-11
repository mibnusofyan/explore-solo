import { findUserById } from '../models/userModel.js'
import { forbidden, unauthorized } from '../utils/httpError.js'

/** Memuat pengguna dari sesi di setiap permintaan, agar akun yang dinonaktifkan langsung terputus. */
export async function loadUser(req, _res, next) {
  try {
    if (req.session?.userId) {
      const user = await findUserById(req.session.userId)
      if (user && user.active) req.user = user
      else delete req.session.userId
    }
    next()
  } catch (err) {
    next(err)
  }
}

export function requireAuth(req, _res, next) {
  if (!req.user) return next(unauthorized())
  next()
}

/** Role-Based Access Control: hanya role tertentu yang boleh melanjutkan. */
export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized())
    if (!roles.includes(req.user.role)) return next(forbidden())
    next()
  }
}
