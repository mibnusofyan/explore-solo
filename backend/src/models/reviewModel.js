import { query } from '../db/pool.js'
import { ms } from '../utils/time.js'

function toReview(r) {
  return {
    id: r.id,
    reservationId: r.reservation_id,
    destinationId: r.destination_id,
    userId: r.user_id,
    rating: r.rating,
    comment: r.comment,
    visitDate: r.visit_date,
    createdAt: ms(r.created_at),
    reply: r.reply_text ? { text: r.reply_text, by: r.reply_by, createdAt: ms(r.replied_at) } : null,
    user: { id: r.user_id, name: r.user_name, avatar: r.user_avatar },
    ...(r.destination_name ? { destination: { id: r.destination_id, name: r.destination_name, slug: r.destination_slug } } : {}),
  }
}

const SELECT = `
  SELECT rv.*, u.name AS user_name, u.avatar_url AS user_avatar, d.name AS destination_name, d.slug AS destination_slug
  FROM reviews rv JOIN users u ON u.id = rv.user_id JOIN destinations d ON d.id = rv.destination_id`

export async function reviewsForDestination(destinationId) {
  const rows = await query(`${SELECT} WHERE rv.destination_id = ? ORDER BY rv.created_at DESC`, [destinationId])
  return rows.map(toReview)
}

/** destinationIds = null untuk semua (Admin). */
export async function reviewsForDestinations(destinationIds) {
  if (destinationIds && !destinationIds.length) return []
  const rows = destinationIds
    ? await query(`${SELECT} WHERE rv.destination_id IN (?) ORDER BY rv.created_at DESC`, [destinationIds])
    : await query(`${SELECT} ORDER BY rv.created_at DESC`)
  return rows.map(toReview)
}

export async function findReview(id) {
  const [row] = await query(`${SELECT} WHERE rv.id = ?`, [id])
  return row ? toReview(row) : null
}

export async function insertReview({ id, reservationId, destinationId, userId, rating, comment, visitDate }) {
  await query(
    'INSERT INTO reviews (id, reservation_id, destination_id, user_id, rating, comment, visit_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, reservationId, destinationId, userId, rating, comment, visitDate],
  )
  return findReview(id)
}

export async function setReply(id, text, by) {
  await query('UPDATE reviews SET reply_text = ?, reply_by = ?, replied_at = UTC_TIMESTAMP() WHERE id = ?', [text, by, id])
  return findReview(id)
}
