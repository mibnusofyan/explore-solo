import { mkdirSync } from 'node:fs'
import { extname, join } from 'node:path'
import multer from 'multer'
import { config } from '../config/index.js'
import { newId } from '../utils/ids.js'
import { unprocessable } from '../utils/httpError.js'

const TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }

/** Unggahan gambar JPG/PNG/WebP ke folder uploads/<sub>, dengan batas ukuran (MB). */
export function imageUpload(sub, maxMb) {
  const dir = join(config.uploadDir, sub)
  mkdirSync(dir, { recursive: true })
  return multer({
    storage: multer.diskStorage({
      destination: dir,
      filename: (_req, file, cb) => cb(null, `${newId('img')}${TYPES[file.mimetype] || extname(file.originalname)}`),
    }),
    limits: { fileSize: maxMb * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (TYPES[file.mimetype]) cb(null, true)
      else cb(unprocessable('Format foto harus JPG, PNG, atau WebP.', { [file.fieldname]: 'Format tidak didukung.' }))
    },
  })
}

export const publicUploadUrl = (sub, filename) => `/uploads/${sub}/${filename}`
