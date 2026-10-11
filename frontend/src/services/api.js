// Klien REST untuk backend Express (backend/). Sesi memakai cookie httpOnly; setiap
// permintaan yang mengubah data membawa header X-CSRF-Token (SRS 2.5).

export const PAYMENT_WINDOW_MIN = 60
export const REVIEW_MAX_CHARS = 500

export const STATUS = {
  PENDING: 'MENUNGGU_PEMBAYARAN',
  PAID: 'LUNAS',
  USED: 'SUDAH_DIGUNAKAN',
  CANCELLED: 'DIBATALKAN',
}

export const DEST_STATUS = {
  ACTIVE: 'AKTIF',
  PENDING: 'MENUNGGU_VERIFIKASI',
  REJECTED: 'DITOLAK',
  INACTIVE: 'NONAKTIF',
}

export class ApiError extends Error {
  constructor(message, status = 400, fields, code) {
    super(message)
    this.status = status
    this.fields = fields
    this.code = code
  }
}

const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
let csrfToken = null

export function setCsrfToken(t) {
  if (t) csrfToken = t
}

async function fetchCsrf() {
  const res = await fetch(`${BASE}/api/auth/csrf`, { credentials: 'include' })
  csrfToken = (await res.json()).csrfToken
}

function qs(params = {}) {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') sp.set(k, v)
  const s = sp.toString()
  return s ? `?${s}` : ''
}

async function request(method, path, { body, form, retry = true } = {}) {
  const unsafe = method !== 'GET'
  if (unsafe && !csrfToken) await fetchCsrf()
  const headers = {}
  if (unsafe) headers['X-CSRF-Token'] = csrfToken
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  let res
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method,
      credentials: 'include',
      headers,
      body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
    })
  } catch {
    throw new ApiError('Tidak dapat terhubung ke server. Periksa koneksi internet Anda.', 0)
  }
  if (res.status === 204) return null
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    // Token CSRF basi (mis. sesi berganti di tab lain): ambil yang baru lalu ulangi sekali.
    if (res.status === 403 && data.code === 'CSRF' && retry) {
      await fetchCsrf()
      return request(method, path, { body, form, retry: false })
    }
    throw new ApiError(data.message || 'Terjadi kesalahan. Coba lagi.', res.status, data.fields, data.code)
  }
  return data
}

const get = (path) => request('GET', path)
const post = (path, body) => request('POST', path, { body })
const put = (path, body) => request('PUT', path, { body })
const patch = (path, body) => request('PATCH', path, { body })
const upload = (path, field, file) => {
  const form = new FormData()
  form.append(field, file)
  return request('POST', path, { form })
}

/** Unduh berkas dari API (PDF/Excel) memakai cookie sesi, lalu simpan di perangkat. */
export async function downloadFile(path, filename) {
  const res = await fetch(`${BASE}/api${path}`, { credentials: 'include' })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new ApiError(data.message || 'Gagal mengunduh berkas.', res.status)
  }
  const url = URL.createObjectURL(await res.blob())
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/* ------------------------------------------------------------------ */
/* Autentikasi & profil (SRS 3.1, 3.2, 3.12)                           */
/* ------------------------------------------------------------------ */

export const auth = {
  async me() {
    const data = await get('/auth/me')
    setCsrfToken(data.csrfToken)
    return data.user
  },
  async login(email, password) {
    const data = await post('/auth/login', { email, password })
    setCsrfToken(data.csrfToken)
    return data.user
  },
  async logout() {
    await post('/auth/logout')
    csrfToken = null
  },
  async register(form) {
    return (await post('/auth/register', form)).user
  },
  async updateProfile(_id, { name, phone }) {
    return (await patch('/me', { name, phone })).user
  },
  async uploadAvatar(file) {
    return (await upload('/me/avatar', 'avatar', file)).user
  },
  async changePassword(_id, oldPassword, newPassword, confirm) {
    await put('/me/password', { oldPassword, newPassword, confirm })
  },
}

/* ------------------------------------------------------------------ */
/* Destinasi                                                           */
/* ------------------------------------------------------------------ */

export const destinations = {
  /** SRS 3.3. Dengan date/guests, tiap hasil membawa `availability`. */
  async search({ q, category, minPrice, maxPrice, minRating, sort, date, guests } = {}) {
    const sortParam = sort && sort !== 'rekomendasi' ? sort : undefined
    return (await get(`/destinations${qs({ q, category, minPrice, maxPrice, minRating, sort: sortParam, date, guests })}`)).items
  },
  async get(slug) {
    return (await get(`/destinations/${encodeURIComponent(slug)}`)).destination
  },
  async availability(slug, date) {
    return (await get(`/destinations/${encodeURIComponent(slug)}/availability${qs({ date })}`)).availability
  },

  // Pengelola Destinasi (SRS 3.9)
  async listManaged() {
    return (await get('/manager/destinations')).destinations
  },
  async getManaged(_user, id) {
    return (await get(`/manager/destinations/${id}`)).destination
  },
  async save(_user, data) {
    const res = data.id ? await put(`/manager/destinations/${data.id}`, data) : await post('/manager/destinations', data)
    return res.destination
  },
  async uploadPhoto(file) {
    return (await upload('/manager/uploads/photo', 'photo', file)).photo
  },

  // Admin
  async listAll() {
    return (await get('/admin/destinations')).destinations
  },
  async verify(id, approve, note = '') {
    return (await post(`/admin/destinations/${id}/verify`, { approve, note })).destination
  },
  async setActive(id, active) {
    return (await patch(`/admin/destinations/${id}/status`, { active })).destination
  },
}

/* ------------------------------------------------------------------ */
/* Reservasi, pembayaran, check-in, laporan (SRS 3.5 – 3.10)           */
/* ------------------------------------------------------------------ */

export const reservations = {
  /**
   * Ringkasan sebelum konfirmasi, dihitung di klien dari ketersediaan yang diambil dari server.
   * Server tetap memvalidasi ulang saat reservasi dibuat. `avail` null berarti masih dimuat.
   */
  quote(destination, date, quantities, avail) {
    const errors = []
    const items = destination.tickets
      .map((t) => ({ ticketId: t.id, name: t.name, price: t.price, qty: quantities[t.id] || 0 }))
      .filter((i) => i.qty > 0)
    const totalQty = items.reduce((s, i) => s + i.qty, 0)
    const total = items.reduce((s, i) => s + i.qty * i.price, 0)
    if (!date) errors.push('Pilih tanggal kunjungan.')
    else if (avail && !avail.open) errors.push(avail.reason)
    else if (avail && totalQty > avail.remaining)
      errors.push(`Kuota tidak mencukupi. Sisa kuota ${avail.remaining} tiket pada tanggal tersebut.`)
    if (!totalQty) errors.push('Pilih minimal 1 tiket.')
    if (totalQty > 20) errors.push('Maksimal 20 tiket per reservasi.')
    return { items, totalQty, total, avail, errors }
  },
  async create(_user, { destinationId, date, quantities, contact }) {
    return (await post('/reservations', { destinationId, date, quantities, contact })).reservation
  },
  async get(_user, id) {
    return (await get(`/reservations/${encodeURIComponent(id)}`)).reservation
  },
  async listMine() {
    return (await get('/reservations')).reservations
  },
  async cancel(_user, id) {
    return (await post(`/reservations/${id}/cancel`)).reservation
  },
  /** Mulai pembayaran: { mode: 'midtrans' | 'simulation' | 'paid', token?, clientKey?, snapUrl? }. */
  async startPayment(id) {
    return post(`/reservations/${id}/payment`)
  },
  /** Simulasi sandbox (hanya bila Midtrans belum dikonfigurasi di server). */
  async pay(_user, id, method, outcome = 'success') {
    return (await post(`/reservations/${id}/payment/simulate`, { method, outcome })).reservation
  },
  async syncPayment(id) {
    return (await post(`/reservations/${id}/payment/sync`)).reservation
  },
  downloadTicket(r) {
    return downloadFile(`/reservations/${r.id}/ticket.pdf`, `e-tiket-${r.code}.pdf`)
  },
  async checkIn(_user, code) {
    return post('/manager/check-in', { code })
  },
  async report(_user, { from, to, status, destinationId } = {}) {
    return get(`/reports/reservations${qs({ from, to, status, destinationId })}`)
  },
  downloadReport({ from, to, status, destinationId }, format) {
    return downloadFile(
      `/reports/reservations${qs({ from, to, status, destinationId, format })}`,
      `laporan-reservasi-${from}-${to}.${format}`,
    )
  },
}

/* ------------------------------------------------------------------ */
/* Ulasan (SRS 3.11)                                                   */
/* ------------------------------------------------------------------ */

export const reviews = {
  async forDestination(destinationId) {
    return (await get(`/destinations/${destinationId}/reviews`)).reviews
  },
  async create(_user, reservationId, { rating, comment }) {
    return (await post(`/reservations/${reservationId}/review`, { rating, comment })).review
  },
  async forManager() {
    return (await get('/manager/reviews')).reviews
  },
  async reply(_user, reviewId, text) {
    return (await post(`/manager/reviews/${reviewId}/reply`, { text })).review
  },
}

/* ------------------------------------------------------------------ */
/* Kelola pengguna (SRS 3.13)                                          */
/* ------------------------------------------------------------------ */

export const users = {
  async list() {
    return (await get('/admin/users')).users
  },
  async save({ id, password, ...data }) {
    const body = { ...data, ...(password ? { password } : {}) }
    return (id ? await put(`/admin/users/${id}`, body) : await post('/admin/users', body)).user
  },
  async setActive(id, active) {
    return (await patch(`/admin/users/${id}/status`, { active })).user
  },
}
