import { query } from '../db/pool.js'
import { newId } from '../utils/ids.js'
import { ms, todayWIB, weekdayOf } from '../utils/time.js'

export const DEST_STATUS = {
  ACTIVE: 'AKTIF',
  PENDING: 'MENUNGGU_VERIFIKASI',
  REJECTED: 'DITOLAK',
  INACTIVE: 'NONAKTIF',
}

const BASE_SELECT = `
  SELECT d.*, COALESCE(rv.avg_rating, 0) AS rating, COALESCE(rv.review_count, 0) AS review_count,
         COALESCE(tk.min_price, 0) AS min_price
  FROM destinations d
  LEFT JOIN (SELECT destination_id, AVG(rating) AS avg_rating, COUNT(*) AS review_count
             FROM reviews GROUP BY destination_id) rv ON rv.destination_id = d.id
  LEFT JOIN (SELECT destination_id, MIN(price) AS min_price
             FROM ticket_types WHERE active = 1 GROUP BY destination_id) tk ON tk.destination_id = d.id`

function toTicket(t) {
  return { id: t.id, name: t.name, price: t.price, desc: t.description }
}

function toDestination(row, tickets = []) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    area: row.area,
    short: row.short,
    description: row.description,
    address: row.address,
    lat: Number(row.lat),
    lng: Number(row.lng),
    photos: row.photos,
    facilities: row.facilities,
    hours: { open: row.hours_open, close: row.hours_close },
    closedDays: row.closed_days,
    holidays: row.holidays,
    tickets,
    dailyQuota: row.daily_quota,
    status: row.status,
    pendingChanges: row.pending_changes,
    reviewNote: row.review_note,
    rating: Math.round(Number(row.rating || 0) * 100) / 100,
    reviewCount: Number(row.review_count || 0),
    minPrice: Number(row.min_price || 0),
    createdAt: ms(row.created_at),
    updatedAt: ms(row.updated_at),
  }
}

async function ticketsFor(ids) {
  if (!ids.length) return {}
  const rows = await query(
    'SELECT * FROM ticket_types WHERE destination_id IN (?) AND active = 1 ORDER BY position, name',
    [ids],
  )
  const out = {}
  for (const t of rows) (out[t.destination_id] ??= []).push(toTicket(t))
  return out
}

async function hydrate(rows) {
  const tickets = await ticketsFor(rows.map((r) => r.id))
  return rows.map((r) => toDestination(r, tickets[r.id] || []))
}

const SORTS = {
  rekomendasi: 'COALESCE(rv.avg_rating, 0) * LOG(COALESCE(rv.review_count, 0) + 2) DESC',
  nama: 'd.name ASC',
  'harga-terendah': 'min_price ASC, d.name',
  'harga-tertinggi': 'min_price DESC, d.name',
  rating: 'rating DESC, review_count DESC',
}

/** Pencarian publik (SRS 3.3). */
export async function searchDestinations({ q, category, minPrice, maxPrice, minRating, sort }) {
  const where = ['d.status = ?']
  const params = [DEST_STATUS.ACTIVE]
  if (q) {
    where.push('(d.name LIKE ? OR d.area LIKE ?)')
    params.push(`%${q}%`, `%${q}%`)
  }
  if (category) {
    where.push('d.category = ?')
    params.push(category)
  }
  if (minPrice != null) {
    where.push('COALESCE(tk.min_price, 0) >= ?')
    params.push(minPrice)
  }
  if (maxPrice != null) {
    where.push('COALESCE(tk.min_price, 0) <= ?')
    params.push(maxPrice)
  }
  if (minRating) {
    where.push('COALESCE(rv.avg_rating, 0) >= ?')
    params.push(minRating)
  }
  const rows = await query(`${BASE_SELECT} WHERE ${where.join(' AND ')} ORDER BY ${SORTS[sort] || SORTS.rekomendasi}`, params)
  return hydrate(rows)
}

export async function findDestination({ id, slug }) {
  const rows = await query(`${BASE_SELECT} WHERE ${id ? 'd.id = ?' : 'd.slug = ?'}`, [id || slug])
  return rows[0] ? (await hydrate(rows))[0] : null
}

export async function listDestinationsByIds(ids) {
  if (!ids.length) return []
  return hydrate(await query(`${BASE_SELECT} WHERE d.id IN (?) ORDER BY d.name`, [ids]))
}

export async function listAllDestinations() {
  const rows = await query(`${BASE_SELECT} ORDER BY d.updated_at DESC`)
  const list = await hydrate(rows)
  const links = await query(
    'SELECT dm.destination_id, u.name FROM destination_managers dm JOIN users u ON u.id = dm.user_id ORDER BY u.name',
  )
  const byDest = {}
  for (const l of links) (byDest[l.destination_id] ??= []).push(l.name)
  return list.map((d) => ({ ...d, managers: byDest[d.id] || [] }))
}

/* ------------------------------------------------------------------ */
/* Kuota & ketersediaan                                                */
/* ------------------------------------------------------------------ */

/** Tiket yang memakan kuota: semua kecuali yang dibatalkan atau pembayarannya kedaluwarsa. */
export const QUOTA_CONDITION = `status <> 'DIBATALKAN' AND NOT (status = 'MENUNGGU_PEMBAYARAN' AND expires_at <= UTC_TIMESTAMP())`

export async function bookedCounts(conn, destinationIds, date) {
  if (!destinationIds.length) return {}
  const [rows] = await conn.query(
    `SELECT destination_id, COALESCE(SUM(total_qty), 0) AS booked FROM reservations
     WHERE destination_id IN (?) AND visit_date = ? AND ${QUOTA_CONDITION} GROUP BY destination_id`,
    [destinationIds, date],
  )
  return Object.fromEntries(rows.map((r) => [r.destination_id, Number(r.booked)]))
}

/** Hitung ketersediaan satu tanggal. `booked` = tiket yang sudah memakan kuota. */
export function availabilityFor(d, date, booked = 0) {
  const quota = d.dailyQuota
  if (!date) return null
  if (date < todayWIB()) return { open: false, reason: 'Tanggal kunjungan sudah lewat.', quota, booked, remaining: 0 }
  if (d.closedDays.includes(weekdayOf(date)))
    return { open: false, reason: 'Destinasi tutup pada hari tersebut.', quota, booked, remaining: 0 }
  if (d.holidays.includes(date))
    return { open: false, reason: 'Destinasi libur pada tanggal tersebut.', quota, booked, remaining: 0 }
  return { open: true, quota, booked, remaining: Math.max(0, quota - booked) }
}

/* ------------------------------------------------------------------ */
/* Pengelola & Admin (SRS 3.9)                                         */
/* ------------------------------------------------------------------ */

export async function isManager(userId, destinationId) {
  const [row] = await query('SELECT 1 AS ok FROM destination_managers WHERE user_id = ? AND destination_id = ?', [userId, destinationId])
  return Boolean(row)
}

/** Bentuk data yang bisa diubah pengelola (dipakai juga sebagai isi pending_changes). */
export function editablePayload(input, existingTicketIds = new Set()) {
  return {
    name: input.name,
    category: input.category,
    area: input.area || 'Surakarta',
    short: input.short || '',
    description: input.description,
    address: input.address,
    lat: input.lat,
    lng: input.lng,
    photos: input.photos,
    facilities: input.facilities,
    hours: input.hours,
    closedDays: [...new Set(input.closedDays)].sort(),
    holidays: [...new Set(input.holidays)].sort(),
    tickets: input.tickets.map((t) => ({
      // ID tiket dari klien hanya dipakai bila memang milik destinasi ini.
      id: t.id && existingTicketIds.has(t.id) ? t.id : newId('tkt'),
      name: t.name,
      price: t.price,
      desc: t.desc || '',
    })),
    dailyQuota: input.dailyQuota,
  }
}

const columnValues = (p) => [
  p.name, p.category, p.area, p.short, p.description, p.address, p.lat, p.lng,
  JSON.stringify(p.photos), JSON.stringify(p.facilities), p.hours.open, p.hours.close,
  JSON.stringify(p.closedDays), JSON.stringify(p.holidays), p.dailyQuota,
]

export async function allTicketIds(conn, destinationId) {
  const [rows] = await conn.query('SELECT id FROM ticket_types WHERE destination_id = ?', [destinationId])
  return new Set(rows.map((r) => r.id))
}

/** Terapkan payload ke kolom destinasi dan sinkronkan jenis tiket (tiket lama dinonaktifkan, bukan dihapus). */
export async function applyPayload(conn, destinationId, p) {
  await conn.query(
    `UPDATE destinations SET name = ?, category = ?, area = ?, short = ?, description = ?, address = ?, lat = ?, lng = ?,
       photos = ?, facilities = ?, hours_open = ?, hours_close = ?, closed_days = ?, holidays = ?, daily_quota = ?
     WHERE id = ?`,
    [...columnValues(p), destinationId],
  )
  const existing = await allTicketIds(conn, destinationId)
  for (const [i, t] of p.tickets.entries()) {
    if (existing.has(t.id)) {
      await conn.query('UPDATE ticket_types SET name = ?, price = ?, description = ?, position = ?, active = 1 WHERE id = ?', [
        t.name, t.price, t.desc, i, t.id,
      ])
    } else {
      await conn.query(
        'INSERT INTO ticket_types (id, destination_id, name, price, description, position) VALUES (?, ?, ?, ?, ?, ?)',
        [t.id, destinationId, t.name, t.price, t.desc, i],
      )
    }
  }
  const keep = p.tickets.map((t) => t.id)
  await conn.query('UPDATE ticket_types SET active = 0 WHERE destination_id = ? AND id NOT IN (?)', [destinationId, keep])
}

export async function insertDestination(conn, id, slug, p) {
  await conn.query(
    `INSERT INTO destinations (id, slug, name, category, area, short, description, address, lat, lng, photos, facilities,
       hours_open, hours_close, closed_days, holidays, daily_quota, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, slug, ...columnValues(p), DEST_STATUS.PENDING],
  )
  await conn.query(
    'INSERT INTO ticket_types (id, destination_id, name, price, description, position) VALUES ?',
    [p.tickets.map((t, i) => [t.id, id, t.name, t.price, t.desc, i])],
  )
}
