import bcrypt from 'bcryptjs'
import { config } from '../config/index.js'
import { pool, transaction } from '../db/pool.js'
import { destroyUserSessions } from '../middleware/sessionStore.js'
import { emailTaken, findUserById, listUsers, setManagedDestinations } from '../models/userModel.js'
import { newId } from '../utils/ids.js'
import { forbidden, notFound, unprocessable } from '../utils/httpError.js'

const BCRYPT_COST = config.isTest ? 4 : 10

async function checkDestinations(ids) {
  if (!ids.length) return
  const [rows] = await pool.query('SELECT id FROM destinations WHERE id IN (?)', [ids])
  if (rows.length !== new Set(ids).size) throw unprocessable('Destinasi tidak valid.', { destinationIds: 'Ada destinasi yang tidak dikenal.' })
}

/** SRS 3.13 Kelola Pengguna. */
export async function list(_req, res) {
  res.json({ users: await listUsers() })
}

export async function create(req, res) {
  const { name, email, phone, role, password, destinationIds } = req.body
  const fields = {}
  if (!password) fields.password = 'Password awal minimal 8 karakter.'
  if (role === 'pengelola' && !destinationIds.length) fields.destinationIds = 'Tautkan minimal satu destinasi.'
  if (await emailTaken(email)) fields.email = 'Email sudah terdaftar.'
  if (Object.keys(fields).length) throw unprocessable('Data pengguna belum lengkap.', fields)
  await checkDestinations(destinationIds)
  const id = newId('usr')
  await transaction(async (c) => {
    await c.query(
      `INSERT INTO users (id, name, email, phone, password_hash, role, email_verified_at) VALUES (?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
      [id, name, email, phone, await bcrypt.hash(password, BCRYPT_COST), role],
    )
    if (role === 'pengelola') await setManagedDestinations(c, id, [...new Set(destinationIds)])
  })
  res.status(201).json({ user: await findUserById(id) })
}

export async function update(req, res) {
  const target = await findUserById(req.params.id)
  if (!target) throw notFound('Pengguna tidak ditemukan.')
  const { name, email, phone, role, destinationIds } = req.body
  if (target.id === req.user.id && role !== target.role) throw forbidden('Anda tidak dapat mengubah peran akun sendiri.')
  const fields = {}
  if (role === 'pengelola' && !destinationIds.length) fields.destinationIds = 'Tautkan minimal satu destinasi.'
  if (await emailTaken(email, target.id)) fields.email = 'Email sudah terdaftar.'
  if (Object.keys(fields).length) throw unprocessable('Data pengguna belum lengkap.', fields)
  await checkDestinations(destinationIds)
  await transaction(async (c) => {
    await c.query('UPDATE users SET name = ?, email = ?, phone = ?, role = ? WHERE id = ?', [name, email, phone, role, target.id])
    await setManagedDestinations(c, target.id, role === 'pengelola' ? [...new Set(destinationIds)] : [])
  })
  res.json({ user: await findUserById(target.id) })
}

/** Nonaktifkan / aktifkan akun. Akun nonaktif langsung keluar dari semua sesi. */
export async function setActive(req, res) {
  const target = await findUserById(req.params.id)
  if (!target) throw notFound('Pengguna tidak ditemukan.')
  if (target.id === req.user.id) throw forbidden('Anda tidak dapat menonaktifkan akun sendiri.')
  const active = req.body?.active === true
  await pool.query('UPDATE users SET active = ? WHERE id = ?', [active ? 1 : 0, target.id])
  if (!active) await destroyUserSessions(target.id)
  res.json({ user: await findUserById(target.id) })
}
