import { query } from '../db/pool.js'
import { ms } from '../utils/time.js'

const COLS = 'id, name, email, phone, role, active, avatar_url, email_verified_at, created_at'

function toUser(row, destinationIds = []) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    active: Boolean(row.active),
    avatar: row.avatar_url,
    emailVerified: Boolean(row.email_verified_at),
    destinationIds,
    createdAt: ms(row.created_at),
  }
}

async function managedIds(userId) {
  const rows = await query('SELECT destination_id FROM destination_managers WHERE user_id = ? ORDER BY destination_id', [userId])
  return rows.map((r) => r.destination_id)
}

export async function findUserById(id) {
  const [row] = await query(`SELECT ${COLS} FROM users WHERE id = ?`, [id])
  if (!row) return null
  return toUser(row, row.role === 'pengelola' ? await managedIds(id) : [])
}

/** Untuk login: termasuk hash password. */
export async function findUserAuthByEmail(email) {
  const [row] = await query(`SELECT ${COLS}, password_hash FROM users WHERE email = ?`, [email.toLowerCase()])
  return row ? { ...toUser(row), passwordHash: row.password_hash } : null
}

export async function getPasswordHash(id) {
  const [row] = await query('SELECT password_hash FROM users WHERE id = ?', [id])
  return row?.password_hash
}

export async function emailTaken(email, exceptId = '') {
  const [row] = await query('SELECT id FROM users WHERE email = ? AND id <> ?', [email.toLowerCase(), exceptId])
  return Boolean(row)
}

export async function createUser({ id, name, email, phone, passwordHash, role, verifyToken = null, verified = false }) {
  await query(
    `INSERT INTO users (id, name, email, phone, password_hash, role, verify_token, email_verified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, name, email.toLowerCase(), phone, passwordHash, role, verifyToken, verified ? new Date() : null],
  )
  return findUserById(id)
}

export async function updateUser(id, fields) {
  const map = { name: 'name', email: 'email', phone: 'phone', role: 'role', active: 'active', avatar: 'avatar_url', passwordHash: 'password_hash' }
  const sets = []
  const params = []
  for (const [k, col] of Object.entries(map)) {
    if (fields[k] !== undefined) {
      sets.push(`${col} = ?`)
      params.push(k === 'email' ? fields[k].toLowerCase() : fields[k])
    }
  }
  if (sets.length) await query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, [...params, id])
}

export async function verifyEmailByToken(tokenValue) {
  const res = await query(
    'UPDATE users SET email_verified_at = UTC_TIMESTAMP(), verify_token = NULL WHERE verify_token = ?',
    [tokenValue],
  )
  return res.affectedRows > 0
}

export async function setManagedDestinations(conn, userId, destinationIds) {
  await conn.query('DELETE FROM destination_managers WHERE user_id = ?', [userId])
  if (destinationIds.length) {
    await conn.query('INSERT INTO destination_managers (user_id, destination_id) VALUES ?', [destinationIds.map((d) => [userId, d])])
  }
}

export async function listUsers() {
  const rows = await query(`SELECT ${COLS} FROM users ORDER BY created_at DESC`)
  const links = await query('SELECT user_id, destination_id FROM destination_managers')
  const byUser = {}
  for (const l of links) (byUser[l.user_id] ??= []).push(l.destination_id)
  return rows.map((r) => toUser(r, byUser[r.id] || []))
}
