import { pool, query } from '../db/pool.js'
import { ms } from '../utils/time.js'
import { findDestination, listDestinationsByIds } from './destinationModel.js'

export const STATUS = {
  PENDING: 'MENUNGGU_PEMBAYARAN',
  PAID: 'LUNAS',
  USED: 'SUDAH_DIGUNAKAN',
  CANCELLED: 'DIBATALKAN',
}

/**
 * Batalkan reservasi yang melewati batas waktu pembayaran; kuotanya otomatis kembali karena
 * kuota dihitung dari reservasi yang belum dibatalkan. Dipanggil berkala dan sebelum membaca data.
 */
export async function expireStaleReservations() {
  const res = await query(
    `UPDATE reservations SET status = 'DIBATALKAN', cancel_reason = 'Batas waktu pembayaran terlewati'
     WHERE status = 'MENUNGGU_PEMBAYARAN' AND expires_at <= UTC_TIMESTAMP()`,
  )
  if (res.affectedRows) {
    await query(
      `UPDATE payments p JOIN reservations r ON r.id = p.reservation_id
       SET p.status = 'GAGAL' WHERE p.status = 'PENDING' AND r.status = 'DIBATALKAN'`,
    )
  }
  return res.affectedRows
}

function toReservation(r, items, payment) {
  return {
    id: r.id,
    code: r.code,
    userId: r.user_id,
    destinationId: r.destination_id,
    date: r.visit_date,
    items: items.map((i) => ({ ticketId: i.ticket_type_id, name: i.name, price: i.price, qty: i.qty })),
    totalQty: r.total_qty,
    total: r.total_amount,
    contact: { name: r.contact_name, email: r.contact_email, phone: r.contact_phone },
    status: r.status,
    payment: payment
      ? { method: payment.method, provider: payment.provider, paidAt: ms(payment.paid_at), transactionId: payment.transaction_id }
      : null,
    cancelReason: r.cancel_reason,
    createdAt: ms(r.created_at),
    updatedAt: ms(r.updated_at),
    expiresAt: ms(r.expires_at),
    checkedInAt: ms(r.checked_in_at),
  }
}

/** Lengkapi baris reservasi dengan item, pembayaran terakhir, destinasi, dan ulasan. */
export async function hydrateReservations(rows, { withDestination = true, withReview = true } = {}) {
  if (!rows.length) return []
  const ids = rows.map((r) => r.id)
  const [items, payments, reviews, destinations] = await Promise.all([
    query('SELECT * FROM reservation_items WHERE reservation_id IN (?) ORDER BY id', [ids]),
    query(
      `SELECT * FROM payments WHERE reservation_id IN (?) AND status = 'BERHASIL'`,
      [ids],
    ),
    withReview ? query('SELECT * FROM reviews WHERE reservation_id IN (?)', [ids]) : [],
    withDestination ? listDestinationsByIds([...new Set(rows.map((r) => r.destination_id))]) : [],
  ])
  const group = (list, key) => list.reduce((m, x) => ((m[x[key]] ??= []).push(x), m), {})
  const itemsBy = group(items, 'reservation_id')
  const payBy = Object.fromEntries(payments.map((p) => [p.reservation_id, p]))
  const reviewBy = Object.fromEntries(reviews.map((rv) => [rv.reservation_id, rv]))
  const destBy = Object.fromEntries(destinations.map((d) => [d.id, d]))
  return rows.map((r) => {
    const out = toReservation(r, itemsBy[r.id] || [], payBy[r.id])
    if (withDestination) out.destination = destBy[r.destination_id] || null
    if (withReview) {
      const rv = reviewBy[r.id]
      out.review = rv
        ? {
            id: rv.id,
            rating: rv.rating,
            comment: rv.comment,
            createdAt: ms(rv.created_at),
            reply: rv.reply_text ? { text: rv.reply_text, by: rv.reply_by, createdAt: ms(rv.replied_at) } : null,
          }
        : null
    }
    return out
  })
}

export async function findReservation({ id, code }, conn = pool) {
  const [rows] = await conn.query(`SELECT * FROM reservations WHERE ${id ? 'id = ?' : 'code = ?'}`, [id || code])
  return rows[0] || null
}

export async function getReservationView(id) {
  const row = await findReservation({ id })
  return row ? (await hydrateReservations([row]))[0] : null
}

export async function listReservationsForUser(userId) {
  const rows = await query('SELECT * FROM reservations WHERE user_id = ? ORDER BY created_at DESC', [userId])
  return hydrateReservations(rows)
}

/** Laporan (SRS 3.10). destinationIds = null berarti semua destinasi (Admin). */
export async function reportRows({ destinationIds, from, to, status, destinationId }) {
  const where = ['1 = 1']
  const params = []
  if (destinationIds) {
    if (!destinationIds.length) return []
    where.push('destination_id IN (?)')
    params.push(destinationIds)
  }
  if (destinationId) {
    where.push('destination_id = ?')
    params.push(destinationId)
  }
  if (from) {
    where.push('visit_date >= ?')
    params.push(from)
  }
  if (to) {
    where.push('visit_date <= ?')
    params.push(to)
  }
  if (status) {
    where.push('status = ?')
    params.push(status)
  }
  const rows = await query(
    `SELECT * FROM reservations WHERE ${where.join(' AND ')} ORDER BY visit_date DESC, created_at DESC`,
    params,
  )
  return hydrateReservations(rows, { withReview: false })
}

export function summarize(rows) {
  const settled = rows.filter((r) => r.status === STATUS.PAID || r.status === STATUS.USED)
  return {
    reservations: rows.length,
    visitors: rows.filter((r) => r.status === STATUS.USED).reduce((s, r) => s + r.totalQty, 0),
    ticketsSold: settled.reduce((s, r) => s + r.totalQty, 0),
    revenue: settled.reduce((s, r) => s + r.total, 0),
  }
}

export { findDestination }
