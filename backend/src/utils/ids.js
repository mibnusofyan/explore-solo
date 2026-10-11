import { randomBytes, randomInt } from 'node:crypto'

const ALNUM = 'abcdefghijklmnopqrstuvwxyz0123456789'

/** ID string berprefiks, mis. usr_k3j9x2m1q0ab. */
export function newId(prefix) {
  let s = ''
  for (let i = 0; i < 12; i++) s += ALNUM[randomInt(ALNUM.length)]
  return `${prefix}_${s}`
}

/** Kode booking ES-XXXXXX tanpa huruf/angka yang mudah tertukar (O/0, I/1). */
export function bookingCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 6; i++) s += chars[randomInt(chars.length)]
  return `ES-${s}`
}

export function token(bytes = 24) {
  return randomBytes(bytes).toString('hex')
}

export function slugify(name) {
  const base = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .slice(0, 120)
  return `${base}-${randomBytes(2).toString('hex')}`
}
