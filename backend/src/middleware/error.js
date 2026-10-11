import multer from 'multer'
import { HttpError } from '../utils/httpError.js'

export function notFoundHandler(req, _res, next) {
  next(new HttpError(404, `Endpoint ${req.method} ${req.path} tidak ditemukan.`))
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Ukuran file melebihi batas.' : 'Unggahan file tidak valid.'
    return res.status(422).json({ message: msg, fields: { [err.field || 'file']: msg } })
  }
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ message: 'Format JSON tidak valid.' })
  if (err?.type === 'entity.too.large') return res.status(413).json({ message: 'Data yang dikirim terlalu besar.' })
  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message, fields: err.fields, code: err.code })
  }
  console.error(`[${req.method} ${req.originalUrl}]`, err)
  res.status(500).json({ message: 'Terjadi kesalahan pada server. Silakan coba lagi.' })
}

/** Bungkus handler async agar galatnya diteruskan ke errorHandler (Express 5 juga melakukannya). */
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)
