import { unlink } from 'node:fs/promises'
import { join } from 'node:path'
import bcrypt from 'bcryptjs'
import { config } from '../config/index.js'
import { ensureCsrfToken } from '../middleware/csrf.js'
import { destroyUserSessions } from '../middleware/sessionStore.js'
import { publicUploadUrl } from '../middleware/upload.js'
import { createUser, emailTaken, findUserAuthByEmail, findUserById, getPasswordHash, updateUser, verifyEmailByToken } from '../models/userModel.js'
import { sendMail } from '../services/mailer.js'
import { newId, token } from '../utils/ids.js'
import { forbidden, unauthorized, unprocessable } from '../utils/httpError.js'

const BCRYPT_COST = config.isTest ? 4 : 10
// Hash pembanding agar waktu respons login sama untuk email terdaftar maupun tidak.
const DUMMY_HASH = bcrypt.hashSync('explore-solo-dummy', BCRYPT_COST)

export function csrf(req, res) {
  res.json({ csrfToken: ensureCsrfToken(req) })
}

export function me(req, res) {
  res.json({ user: req.user || null, csrfToken: ensureCsrfToken(req) })
}

/** SRS 3.2 Registrasi: akun Wisatawan + email verifikasi. */
export async function register(req, res) {
  const { name, email, phone, password } = req.body
  if (await emailTaken(email)) throw unprocessable('Periksa kembali data Anda.', { email: 'Email sudah terdaftar.' })
  const verifyToken = token(24)
  const user = await createUser({
    id: newId('usr'),
    name,
    email,
    phone,
    passwordHash: await bcrypt.hash(password, BCRYPT_COST),
    role: 'wisatawan',
    verifyToken,
  })
  const link = `${config.appUrl}/api/auth/verify-email?token=${verifyToken}`
  await sendMail({
    to: email,
    subject: 'Verifikasi email akun Explore Solo',
    text: `Halo ${name},\n\nTerima kasih telah mendaftar di Explore Solo. Konfirmasi alamat email Anda melalui tautan berikut:\n${link}\n\nAbaikan email ini bila Anda tidak merasa mendaftar.`,
  })
  res.status(201).json({ user })
}

/** SRS 3.1 Login: verifikasi email, password, dan status akun. */
export async function login(req, res) {
  const { email, password } = req.body
  const found = await findUserAuthByEmail(email)
  const ok = await bcrypt.compare(password, found?.passwordHash || DUMMY_HASH)
  if (!found || !ok) throw unauthorized('Email atau password salah.')
  if (!found.active) throw forbidden('Akun Anda tidak aktif. Hubungi admin Explore Solo.')
  // Ganti ID sesi setelah login untuk mencegah session fixation.
  await new Promise((resolve, reject) => req.session.regenerate((err) => (err ? reject(err) : resolve())))
  req.session.userId = found.id
  const user = await findUserById(found.id)
  res.json({ user, csrfToken: ensureCsrfToken(req) })
}

export async function logout(req, res) {
  await new Promise((resolve) => req.session.destroy(() => resolve()))
  res.clearCookie('es.sid')
  res.status(204).end()
}

export async function verifyEmail(req, res) {
  const ok = typeof req.query.token === 'string' && (await verifyEmailByToken(req.query.token))
  res.redirect(`${config.appUrl}/masuk?verifikasi=${ok ? 'berhasil' : 'gagal'}`)
}

/** SRS 3.12 Profile Page. */
export async function updateProfile(req, res) {
  await updateUser(req.user.id, { name: req.body.name, phone: req.body.phone })
  res.json({ user: await findUserById(req.user.id) })
}

export async function changePassword(req, res) {
  const { oldPassword, newPassword } = req.body
  const ok = await bcrypt.compare(oldPassword, await getPasswordHash(req.user.id))
  if (!ok) throw unprocessable('Password lama salah.', { oldPassword: 'Password lama salah.' })
  await updateUser(req.user.id, { passwordHash: await bcrypt.hash(newPassword, BCRYPT_COST) })
  await destroyUserSessions(req.user.id, req.sessionID)
  res.status(204).end()
}

export async function uploadAvatar(req, res) {
  if (!req.file) throw unprocessable('Pilih foto profil.', { avatar: 'Pilih foto profil.' })
  const old = req.user.avatar
  await updateUser(req.user.id, { avatar: publicUploadUrl('avatars', req.file.filename) })
  if (old?.startsWith('/uploads/avatars/')) await unlink(join(config.uploadDir, old.replace('/uploads/', ''))).catch(() => {})
  res.json({ user: await findUserById(req.user.id) })
}
