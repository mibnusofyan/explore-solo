import request from 'supertest'
import { createApp } from '../src/app.js'
import { migrate } from '../src/db/migrate.js'
import { seed } from '../src/db/seed.js'
import { pool } from '../src/db/pool.js'
import { outbox } from '../src/services/mailer.js'

export const app = createApp()
export { pool, outbox }

export async function resetDatabase() {
  await migrate({ fresh: true })
  await seed({ log: () => {} })
  outbox.length = 0
}

/** Agen dengan cookie jar + token CSRF otomatis untuk permintaan yang mengubah data. */
export async function agent(email, password) {
  const a = request.agent(app)
  let csrf = (await a.get('/api/auth/csrf')).body.csrfToken
  const wrap = (method) => (url) => a[method](url).set('X-CSRF-Token', csrf)
  const client = {
    get: (url) => a.get(url),
    post: wrap('post'),
    put: wrap('put'),
    patch: wrap('patch'),
    delete: wrap('delete'),
    upload: (url, field, buffer, opts) => a.post(url).set('X-CSRF-Token', csrf).attach(field, buffer, opts),
    async login(e, p) {
      const res = await client.post('/api/auth/login').send({ email: e, password: p })
      if (res.body.csrfToken) csrf = res.body.csrfToken
      return res
    },
  }
  if (email) {
    const res = await client.login(email, password)
    if (res.status !== 200) throw new Error(`Login ${email} gagal: ${res.status} ${JSON.stringify(res.body)}`)
  }
  return client
}

export const ACCOUNTS = {
  wisatawan: ['wisatawan@exploresolo.id', 'wisata123'],
  pengelola: ['pengelola@exploresolo.id', 'pengelola123'],
  pengelola2: ['mangkunegaran@exploresolo.id', 'pengelola123'],
  admin: ['admin@exploresolo.id', 'admin12345'],
}

export const todayWIB = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
export function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
/** Tanggal berikutnya (mulai besok) yang jatuh pada hari tertentu (0 = Minggu). */
export function nextWeekday(day) {
  let d = addDays(todayWIB(), 1)
  while (new Date(`${d}T00:00:00Z`).getUTCDay() !== day) d = addDays(d, 1)
  return d
}
/** Tanggal mendatang yang bukan hari tutup tertentu. */
export function nextOpenDay(closedDays = []) {
  let d = addDays(todayWIB(), 1)
  while (closedDays.includes(new Date(`${d}T00:00:00Z`).getUTCDay())) d = addDays(d, 1)
  return d
}
