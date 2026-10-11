// Lapisan API tiruan. Setiap fungsi async dan melempar ApiError seperti respons
// HTTP dari backend Express nanti, sehingga halaman tidak perlu diubah saat
// sumber data diganti (cukup ganti isi berkas ini dengan fetch ke /api/...).
import { db, commit, uid } from './db'
import { todayISO, weekdayOf } from '../lib/format'

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
  constructor(message, status = 400, fields) {
    super(message)
    this.status = status
    this.fields = fields
  }
}

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms))

/** Destinasi yang dikelola, dibaca dari tabel users (bukan objek sesi yang bisa basi). */
function managedIds(user) {
  return db().users.find((u) => u.id === user.id)?.destinationIds || []
}

function publicUser(u) {
  if (!u) return null
  // eslint-disable-next-line no-unused-vars
  const { password, ...rest } = u
  return structuredClone(rest)
}

/* ------------------------------------------------------------------ */
/* Reservasi kedaluwarsa: kuota dikembalikan setelah 60 menit          */
/* ------------------------------------------------------------------ */

function expireStale() {
  const now = Date.now()
  let changed = false
  for (const r of db().reservations) {
    if (r.status === STATUS.PENDING && r.expiresAt < now) {
      r.status = STATUS.CANCELLED
      r.cancelReason = 'Batas waktu pembayaran terlewati'
      r.updatedAt = now
      changed = true
    }
  }
  if (changed) commit()
}

/* ------------------------------------------------------------------ */
/* Autentikasi                                                         */
/* ------------------------------------------------------------------ */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const auth = {
  async login(email, password) {
    await delay()
    const u = db().users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase())
    if (!u || u.password !== password) throw new ApiError('Email atau password salah.', 401)
    if (!u.active) throw new ApiError('Akun Anda tidak aktif. Hubungi admin Explore Solo.', 403)
    return publicUser(u)
  },

  async register({ name, email, phone, password, confirm }) {
    await delay()
    const fields = {}
    if (!name?.trim()) fields.name = 'Nama lengkap wajib diisi.'
    if (!EMAIL_RE.test(email || '')) fields.email = 'Format email tidak valid.'
    if (!/^(\+62|0)8\d{7,12}$/.test((phone || '').replace(/[\s-]/g, '')))
      fields.phone = 'Nomor HP tidak valid (contoh: 0812xxxxxxx).'
    if ((password || '').length < 8) fields.password = 'Password minimal 8 karakter.'
    if (password !== confirm) fields.confirm = 'Konfirmasi password tidak sama.'
    if (!fields.email && db().users.some((x) => x.email.toLowerCase() === email.toLowerCase()))
      fields.email = 'Email sudah terdaftar.'
    if (Object.keys(fields).length) throw new ApiError('Periksa kembali data Anda.', 422, fields)
    const user = {
      id: uid('usr'),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      password,
      role: 'wisatawan',
      active: true,
      avatar: null,
      destinationIds: [],
      createdAt: Date.now(),
    }
    db().users.push(user)
    commit()
    return publicUser(user)
  },

  async me(id) {
    const u = db().users.find((x) => x.id === id)
    return u && u.active ? publicUser(u) : null
  },

  async updateProfile(id, { name, phone, avatar }) {
    await delay()
    const fields = {}
    if (!name?.trim()) fields.name = 'Nama wajib diisi.'
    if (!/^(\+62|0)8\d{7,12}$/.test((phone || '').replace(/[\s-]/g, '')))
      fields.phone = 'Nomor HP tidak valid.'
    if (Object.keys(fields).length) throw new ApiError('Data profil tidak valid.', 422, fields)
    const u = db().users.find((x) => x.id === id)
    Object.assign(u, { name: name.trim(), phone: phone.trim(), avatar: avatar ?? u.avatar })
    commit()
    return publicUser(u)
  },

  async changePassword(id, oldPassword, newPassword, confirm) {
    await delay()
    const u = db().users.find((x) => x.id === id)
    if (u.password !== oldPassword)
      throw new ApiError('Password lama salah.', 422, { oldPassword: 'Password lama salah.' })
    if ((newPassword || '').length < 8)
      throw new ApiError('Password baru terlalu pendek.', 422, { newPassword: 'Minimal 8 karakter.' })
    if (newPassword !== confirm)
      throw new ApiError('Konfirmasi tidak sama.', 422, { confirm: 'Konfirmasi password tidak sama.' })
    u.password = newPassword
    commit()
  },
}

/* ------------------------------------------------------------------ */
/* Destinasi                                                           */
/* ------------------------------------------------------------------ */

function ratingOf(destinationId) {
  const rs = db().reviews.filter((r) => r.destinationId === destinationId)
  if (!rs.length) return { rating: 0, reviewCount: 0 }
  const avg = rs.reduce((s, r) => s + r.rating, 0) / rs.length
  return { rating: Math.round(avg * 100) / 100, reviewCount: rs.length }
}

function decorate(d) {
  const minPrice = d.tickets.length ? Math.min(...d.tickets.map((t) => t.price)) : 0
  return { ...d, ...ratingOf(d.id), minPrice }
}

export const destinations = {
  /** Pencarian publik (SRS 3.3): nama, kategori, rentang harga, rating, urutan. */
  async search({ q = '', category = '', minPrice, maxPrice, minRating, sort = 'rekomendasi' } = {}) {
    await delay(200)
    const term = q.trim().toLowerCase()
    let list = db()
      .destinations.filter((d) => d.status === DEST_STATUS.ACTIVE)
      .map(decorate)
      .filter((d) => !term || d.name.toLowerCase().includes(term) || d.area.toLowerCase().includes(term))
      .filter((d) => !category || d.category === category)
      .filter((d) => minPrice == null || d.minPrice >= minPrice)
      .filter((d) => maxPrice == null || d.minPrice <= maxPrice)
      .filter((d) => !minRating || d.rating >= minRating)
    const sorters = {
      rekomendasi: (a, b) => b.rating * Math.log(b.reviewCount + 2) - a.rating * Math.log(a.reviewCount + 2),
      nama: (a, b) => a.name.localeCompare(b.name, 'id'),
      'harga-terendah': (a, b) => a.minPrice - b.minPrice,
      'harga-tertinggi': (a, b) => b.minPrice - a.minPrice,
      rating: (a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount,
    }
    return list.sort(sorters[sort] || sorters.rekomendasi)
  },

  async get(slug) {
    await delay(200)
    const d = db().destinations.find((x) => x.slug === slug || x.id === slug)
    if (!d || d.status !== DEST_STATUS.ACTIVE)
      throw new ApiError('Destinasi tidak tersedia atau sudah dinonaktifkan.', 404)
    return decorate(d)
  },

  /** Ketersediaan kuota dan jam buka untuk satu tanggal (SRS 3.4 dan 3.5). */
  availability(destination, date) {
    expireStale()
    const d = db().destinations.find((x) => x.id === destination.id) || destination
    if (!date) return null
    if (date < todayISO()) return { open: false, reason: 'Tanggal sudah lewat.', remaining: 0, quota: d.dailyQuota }
    if (d.closedDays.includes(weekdayOf(date)))
      return { open: false, reason: 'Destinasi tutup pada hari tersebut.', remaining: 0, quota: d.dailyQuota }
    if (d.holidays.includes(date))
      return { open: false, reason: 'Destinasi libur pada tanggal tersebut.', remaining: 0, quota: d.dailyQuota }
    const booked = db()
      .reservations.filter(
        (r) => r.destinationId === d.id && r.date === date && r.status !== STATUS.CANCELLED,
      )
      .reduce((s, r) => s + r.totalQty, 0)
    return { open: true, quota: d.dailyQuota, booked, remaining: Math.max(0, d.dailyQuota - booked) }
  },

  /* ---------- Pengelola Destinasi (SRS 3.9) ---------- */

  async listManaged(user) {
    await delay(150)
    return db()
      .destinations.filter((d) => managedIds(user).includes(d.id))
      .map(decorate)
  },

  async getManaged(user, id) {
    await delay(150)
    const d = db().destinations.find((x) => x.id === id)
    if (!d || !managedIds(user).includes(d.id)) throw new ApiError('Destinasi tidak ditemukan.', 404)
    return structuredClone(d)
  },

  async save(user, data) {
    await delay(400)
    const fields = validateDestination(data)
    if (Object.keys(fields).length) throw new ApiError('Data destinasi belum lengkap.', 422, fields)
    const now = Date.now()
    if (data.id) {
      const d = db().destinations.find((x) => x.id === data.id)
      if (!d || !managedIds(user).includes(d.id)) throw new ApiError('Akses ditolak.', 403)
      const payload = cleanDestination(data)
      if (d.status === DEST_STATUS.ACTIVE) {
        // Perubahan menunggu verifikasi Admin; halaman publik tetap memakai data lama.
        d.pendingChanges = payload
        d.reviewNote = null
      } else {
        Object.assign(d, payload, { status: DEST_STATUS.PENDING, reviewNote: null })
      }
      d.updatedAt = now
      commit()
      return structuredClone(d)
    }
    const d = {
      id: uid('dst'),
      slug: slugify(data.name),
      ...cleanDestination(data),
      status: DEST_STATUS.PENDING,
      pendingChanges: null,
      reviewNote: null,
      createdAt: now,
      updatedAt: now,
    }
    db().destinations.push(d)
    db().users.find((u) => u.id === user.id).destinationIds.push(d.id)
    commit()
    return structuredClone(d)
  },

  /* ---------- Admin: verifikasi (SRS 3.9) ---------- */

  async listAll() {
    await delay(150)
    return db().destinations.map((d) => ({
      ...decorate(d),
      managers: db().users.filter((u) => u.destinationIds.includes(d.id)).map((u) => u.name),
    }))
  },

  async verify(id, approve, note = '') {
    await delay(300)
    const d = db().destinations.find((x) => x.id === id)
    if (!approve && !note.trim()) throw new ApiError('Catatan penolakan wajib diisi.', 422, { note: 'Wajib diisi.' })
    if (d.pendingChanges) {
      if (approve) Object.assign(d, d.pendingChanges)
      d.pendingChanges = null
      d.reviewNote = approve ? null : note.trim()
    } else {
      d.status = approve ? DEST_STATUS.ACTIVE : DEST_STATUS.REJECTED
      d.reviewNote = approve ? null : note.trim()
    }
    d.updatedAt = Date.now()
    commit()
    return structuredClone(d)
  },

  async setActive(id, active) {
    await delay(200)
    const d = db().destinations.find((x) => x.id === id)
    d.status = active ? DEST_STATUS.ACTIVE : DEST_STATUS.INACTIVE
    commit()
    return structuredClone(d)
  },
}

function validateDestination(d) {
  const f = {}
  if (!d.name?.trim()) f.name = 'Nama destinasi wajib diisi.'
  if (!d.category) f.category = 'Pilih kategori.'
  if ((d.description || '').trim().length < 30) f.description = 'Deskripsi minimal 30 karakter.'
  if (!d.address?.trim()) f.address = 'Alamat wajib diisi.'
  if (!Number.isFinite(+d.lat) || !Number.isFinite(+d.lng) || !+d.lat || !+d.lng)
    f.location = 'Tentukan titik koordinat lokasi.'
  if (!d.photos?.length) f.photos = 'Unggah minimal satu foto.'
  if (!d.hours?.open || !d.hours?.close || d.hours.open >= d.hours.close)
    f.hours = 'Jam buka harus lebih awal dari jam tutup.'
  if (!d.tickets?.length || d.tickets.some((t) => !t.name.trim() || !(t.price >= 0)))
    f.tickets = 'Isi nama dan harga setiap jenis tiket.'
  if (!(+d.dailyQuota > 0)) f.dailyQuota = 'Kuota harian harus lebih dari 0.'
  return f
}

function cleanDestination(d) {
  return {
    name: d.name.trim(),
    category: d.category,
    area: d.area?.trim() || 'Surakarta',
    short: d.short?.trim() || '',
    description: d.description.trim(),
    address: d.address.trim(),
    lat: +d.lat,
    lng: +d.lng,
    photos: d.photos,
    facilities: d.facilities,
    hours: d.hours,
    closedDays: d.closedDays,
    holidays: d.holidays,
    tickets: d.tickets.map((t) => ({ ...t, id: t.id || uid('tkt'), price: +t.price })),
    dailyQuota: +d.dailyQuota,
  }
}

export function slugify(s) {
  return (
    s
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/[\s_]+/g, '-') +
    '-' +
    Math.random().toString(36).slice(2, 6)
  )
}

/* ------------------------------------------------------------------ */
/* Reservasi dan pembayaran (SRS 3.5 – 3.8)                            */
/* ------------------------------------------------------------------ */

function bookingCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return `ES-${s}`
}

function withDestination(r) {
  const d = db().destinations.find((x) => x.id === r.destinationId)
  const review = db().reviews.find((x) => x.reservationId === r.id) || null
  return { ...r, destination: d ? decorate(d) : null, review }
}

export const reservations = {
  /** Validasi + hitung total tanpa menyimpan (ringkasan sebelum konfirmasi). */
  quote(destination, date, quantities) {
    const errors = []
    const items = destination.tickets
      .map((t) => ({ ticketId: t.id, name: t.name, price: t.price, qty: quantities[t.id] || 0 }))
      .filter((i) => i.qty > 0)
    const totalQty = items.reduce((s, i) => s + i.qty, 0)
    const total = items.reduce((s, i) => s + i.qty * i.price, 0)
    const avail = destinations.availability(destination, date)
    if (!date) errors.push('Pilih tanggal kunjungan.')
    else if (!avail.open) errors.push(avail.reason)
    else if (totalQty > avail.remaining)
      errors.push(`Kuota tidak mencukupi. Sisa kuota ${avail.remaining} tiket pada tanggal tersebut.`)
    if (!totalQty) errors.push('Pilih minimal 1 tiket.')
    if (totalQty > 20) errors.push('Maksimal 20 tiket per reservasi.')
    return { items, totalQty, total, avail, errors }
  },

  async create(user, { destinationId, date, quantities, contact }) {
    await delay(400)
    expireStale()
    const d = db().destinations.find((x) => x.id === destinationId && x.status === DEST_STATUS.ACTIVE)
    if (!d) throw new ApiError('Destinasi tidak tersedia.', 404)
    const q = reservations.quote(d, date, quantities)
    if (q.errors.length) throw new ApiError(q.errors[0], 409)
    if (!contact?.name?.trim() || !EMAIL_RE.test(contact?.email || '') || !contact?.phone?.trim())
      throw new ApiError('Lengkapi data pemesan.', 422)
    const now = Date.now()
    const r = {
      id: uid('rsv'),
      code: bookingCode(),
      userId: user.id,
      destinationId: d.id,
      date,
      items: q.items,
      totalQty: q.totalQty,
      total: q.total,
      contact,
      status: q.total === 0 ? STATUS.PAID : STATUS.PENDING,
      payment: q.total === 0 ? { method: 'gratis', paidAt: now } : null,
      createdAt: now,
      updatedAt: now,
      expiresAt: now + PAYMENT_WINDOW_MIN * 60_000,
      checkedInAt: null,
    }
    db().reservations.push(r)
    commit()
    return withDestination(r)
  },

  async get(user, id) {
    await delay(150)
    expireStale()
    const r = db().reservations.find((x) => x.id === id || x.code === id)
    if (!r || (r.userId !== user.id && user.role === 'wisatawan'))
      throw new ApiError('Reservasi tidak ditemukan.', 404)
    return withDestination(r)
  },

  async listMine(user) {
    await delay(200)
    expireStale()
    return db()
      .reservations.filter((r) => r.userId === user.id)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(withDestination)
  },

  async cancel(user, id) {
    await delay(300)
    const r = db().reservations.find((x) => x.id === id && x.userId === user.id)
    if (!r) throw new ApiError('Reservasi tidak ditemukan.', 404)
    if (r.status !== STATUS.PENDING) throw new ApiError('Hanya reservasi yang belum dibayar yang dapat dibatalkan.', 409)
    r.status = STATUS.CANCELLED
    r.cancelReason = 'Dibatalkan oleh wisatawan'
    r.updatedAt = Date.now()
    commit()
    return withDestination(r)
  },

  /**
   * Simulasi Midtrans Snap (sandbox). `outcome` = 'success' | 'failure'.
   * Backend nanti menerima notifikasi webhook Midtrans lalu menjalankan logika yang sama.
   */
  async pay(user, id, method, outcome = 'success') {
    await delay(1200)
    expireStale()
    const r = db().reservations.find((x) => x.id === id && x.userId === user.id)
    if (!r) throw new ApiError('Reservasi tidak ditemukan.', 404)
    if (r.status === STATUS.CANCELLED)
      throw new ApiError(r.cancelReason || 'Reservasi sudah dibatalkan.', 410)
    if (r.status !== STATUS.PENDING) return withDestination(r)
    const now = Date.now()
    if (outcome === 'success') {
      r.status = STATUS.PAID
      r.payment = { method, paidAt: now, transactionId: `MT-${now.toString(36).toUpperCase()}` }
    } else {
      r.status = STATUS.CANCELLED
      r.cancelReason = 'Pembayaran ditolak oleh payment gateway'
      r.payment = { method, failedAt: now }
    }
    r.updatedAt = now
    commit()
    return withDestination(r)
  },

  /** Verifikasi e-tiket oleh Pengelola (SRS 3.8). */
  async checkIn(user, rawCode) {
    await delay(400)
    expireStale()
    const code = rawCode.trim().toUpperCase()
    const r = db().reservations.find((x) => x.code === code)
    const fail = (reason, res) => ({ valid: false, reason, reservation: res ? withDestination(res) : null })
    if (!r) return fail('Kode booking tidak ditemukan.')
    if (user.role === 'pengelola' && !managedIds(user).includes(r.destinationId))
      return fail('Tiket ini bukan untuk destinasi yang Anda kelola.', r)
    if (r.status === STATUS.USED)
      return fail(`Tiket sudah digunakan pada ${new Date(r.checkedInAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB.`, r)
    if (r.status === STATUS.PENDING) return fail('Tiket belum lunas.', r)
    if (r.status === STATUS.CANCELLED) return fail('Reservasi sudah dibatalkan.', r)
    if (r.date !== todayISO()) return fail('Tanggal kunjungan tidak sesuai dengan hari ini.', r)
    r.status = STATUS.USED
    r.checkedInAt = Date.now()
    r.checkedInBy = user.id
    r.updatedAt = r.checkedInAt
    commit()
    return { valid: true, reservation: withDestination(r) }
  },

  /** Daftar + rekap untuk Pengelola (destinasinya) atau Admin (semua), SRS 3.10. */
  async report(user, { from, to, status = '', destinationId = '' } = {}) {
    await delay(250)
    expireStale()
    const allowed = user.role === 'admin' ? null : new Set(managedIds(user))
    const rows = db()
      .reservations.filter((r) => !allowed || allowed.has(r.destinationId))
      .filter((r) => !destinationId || r.destinationId === destinationId)
      .filter((r) => (!from || r.date >= from) && (!to || r.date <= to))
      .filter((r) => !status || r.status === status)
      .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : b.date.localeCompare(a.date)))
      .map(withDestination)
    const settled = rows.filter((r) => r.status === STATUS.PAID || r.status === STATUS.USED)
    return {
      rows,
      summary: {
        reservations: rows.length,
        visitors: rows.filter((r) => r.status === STATUS.USED).reduce((s, r) => s + r.totalQty, 0),
        ticketsSold: settled.reduce((s, r) => s + r.totalQty, 0),
        revenue: settled.reduce((s, r) => s + r.total, 0),
      },
    }
  },
}

/* ------------------------------------------------------------------ */
/* Rating dan ulasan (SRS 3.11)                                        */
/* ------------------------------------------------------------------ */

export const reviews = {
  async forDestination(destinationId) {
    await delay(150)
    return db()
      .reviews.filter((r) => r.destinationId === destinationId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((r) => ({ ...r, user: publicUser(db().users.find((u) => u.id === r.userId)) }))
  },

  async create(user, reservationId, { rating, comment }) {
    await delay(300)
    const r = db().reservations.find((x) => x.id === reservationId && x.userId === user.id)
    if (!r) throw new ApiError('Reservasi tidak ditemukan.', 404)
    if (r.status !== STATUS.USED)
      throw new ApiError('Ulasan hanya dapat diberikan setelah tiket digunakan (berstatus "Sudah Digunakan").', 409)
    if (db().reviews.some((x) => x.reservationId === r.id))
      throw new ApiError('Reservasi ini sudah pernah diulas.', 409)
    if (!(rating >= 1 && rating <= 5)) throw new ApiError('Beri rating 1 sampai 5 bintang.', 422, { rating: 'Wajib.' })
    if ((comment || '').length > REVIEW_MAX_CHARS)
      throw new ApiError(`Ulasan maksimal ${REVIEW_MAX_CHARS} karakter.`, 422, { comment: 'Terlalu panjang.' })
    const review = {
      id: uid('rvw'),
      reservationId: r.id,
      destinationId: r.destinationId,
      userId: user.id,
      rating,
      comment: (comment || '').trim(),
      visitDate: r.date,
      createdAt: Date.now(),
      reply: null,
    }
    db().reviews.push(review)
    commit()
    return review
  },

  async forManager(user) {
    await delay(200)
    const ids = user.role === 'admin' ? null : new Set(managedIds(user))
    return db()
      .reviews.filter((r) => !ids || ids.has(r.destinationId))
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((r) => ({
        ...r,
        user: publicUser(db().users.find((u) => u.id === r.userId)),
        destination: db().destinations.find((d) => d.id === r.destinationId),
      }))
  },

  async reply(user, reviewId, text) {
    await delay(250)
    const r = db().reviews.find((x) => x.id === reviewId)
    if (!r || !managedIds(user).includes(r.destinationId)) throw new ApiError('Akses ditolak.', 403)
    if (!text.trim()) throw new ApiError('Balasan tidak boleh kosong.', 422)
    r.reply = { text: text.trim(), by: user.name, createdAt: Date.now() }
    commit()
    return r
  },
}

/* ------------------------------------------------------------------ */
/* Kelola pengguna (SRS 3.13)                                          */
/* ------------------------------------------------------------------ */

export const users = {
  async list() {
    await delay(200)
    return db().users.map(publicUser).sort((a, b) => b.createdAt - a.createdAt)
  },

  async save(data) {
    await delay(300)
    const fields = {}
    if (!data.name?.trim()) fields.name = 'Nama wajib diisi.'
    if (!EMAIL_RE.test(data.email || '')) fields.email = 'Format email tidak valid.'
    else if (db().users.some((u) => u.email.toLowerCase() === data.email.toLowerCase() && u.id !== data.id))
      fields.email = 'Email sudah terdaftar.'
    if (!data.phone?.trim()) fields.phone = 'Nomor HP wajib diisi.'
    if (!data.id && (data.password || '').length < 8) fields.password = 'Password awal minimal 8 karakter.'
    if (data.role === 'pengelola' && !data.destinationIds?.length)
      fields.destinationIds = 'Tautkan minimal satu destinasi.'
    if (Object.keys(fields).length) throw new ApiError('Data pengguna belum lengkap.', 422, fields)
    if (data.id) {
      const u = db().users.find((x) => x.id === data.id)
      Object.assign(u, {
        name: data.name.trim(),
        email: data.email.trim().toLowerCase(),
        phone: data.phone.trim(),
        role: data.role,
        destinationIds: data.role === 'pengelola' ? data.destinationIds : [],
      })
      commit()
      return publicUser(u)
    }
    const u = {
      id: uid('usr'),
      name: data.name.trim(),
      email: data.email.trim().toLowerCase(),
      phone: data.phone.trim(),
      password: data.password,
      role: data.role,
      active: true,
      avatar: null,
      destinationIds: data.role === 'pengelola' ? data.destinationIds : [],
      createdAt: Date.now(),
    }
    db().users.push(u)
    commit()
    return publicUser(u)
  },

  async setActive(id, active) {
    await delay(200)
    const u = db().users.find((x) => x.id === id)
    u.active = active
    commit()
    return publicUser(u)
  },
}
