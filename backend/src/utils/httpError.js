/** Galat yang dikirim ke klien sebagai { message, fields?, code? } dengan status HTTP tertentu. */
export class HttpError extends Error {
  constructor(status, message, fields, code) {
    super(message)
    this.status = status
    this.fields = fields
    this.code = code
  }
}

export const badRequest = (msg, fields) => new HttpError(400, msg, fields)
export const unauthorized = (msg = 'Silakan masuk terlebih dahulu.') => new HttpError(401, msg)
export const forbidden = (msg = 'Anda tidak memiliki akses ke fitur ini.') => new HttpError(403, msg)
export const notFound = (msg = 'Data tidak ditemukan.') => new HttpError(404, msg)
export const conflict = (msg) => new HttpError(409, msg)
export const unprocessable = (msg, fields) => new HttpError(422, msg, fields)
