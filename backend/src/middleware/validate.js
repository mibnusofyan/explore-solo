import { z } from 'zod'
import { unprocessable } from '../utils/httpError.js'

/** Validasi req[part] dengan skema zod; hasil yang sudah dibersihkan menggantikan nilai aslinya. */
export function validate(schema, part = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[part] ?? {})
    if (!result.success) return next(zodToHttp(result.error))
    if (part === 'query') req.validQuery = result.data
    else req[part] = result.data
    next()
  }
}

export function zodToHttp(error, message = 'Periksa kembali data yang diisi.') {
  const fields = {}
  for (const issue of error.issues) {
    const key = issue.path.length ? String(issue.path[0]) : '_'
    fields[key] ??= issue.message
  }
  return unprocessable(message, fields)
}

export { z }
