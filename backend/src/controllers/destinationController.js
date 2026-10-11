import { pool, transaction } from '../db/pool.js'
import { zodToHttp } from '../middleware/validate.js'
import { publicUploadUrl } from '../middleware/upload.js'
import {
  DEST_STATUS,
  allTicketIds,
  applyPayload,
  availabilityFor,
  bookedCounts,
  editablePayload,
  findDestination,
  insertDestination,
  isManager,
  listAllDestinations,
  listDestinationsByIds,
  searchDestinations,
} from '../models/destinationModel.js'
import { expireStaleReservations } from '../models/reservationModel.js'
import { reviewsForDestination } from '../models/reviewModel.js'
import { newId, slugify } from '../utils/ids.js'
import { destinationSchema, isoDate } from '../utils/schemas.js'
import { forbidden, notFound, unprocessable } from '../utils/httpError.js'

/* ---------------------------- Publik ---------------------------- */

/** SRS 3.3 Pencarian Destinasi. Dengan ?date=&guests= setiap hasil membawa ketersediaannya. */
export async function search(req, res) {
  const { date, guests, ...filters } = req.validQuery
  const items = await searchDestinations(filters)
  if (date) {
    await expireStaleReservations()
    const booked = await bookedCounts(pool, items.map((d) => d.id), date)
    for (const d of items) {
      const a = availabilityFor(d, date, booked[d.id] || 0)
      d.availability = { ...a, ok: a.open && a.remaining >= Math.max(1, guests || 0) }
    }
  }
  res.json({ items })
}

/** SRS 3.4 Tampil Informasi Destinasi. */
export async function show(req, res) {
  const d = await findDestination({ slug: req.params.slug })
  if (!d || d.status !== DEST_STATUS.ACTIVE) throw notFound('Destinasi tidak tersedia atau sudah dinonaktifkan.')
  delete d.pendingChanges
  delete d.reviewNote
  res.json({ destination: d })
}

export async function availability(req, res) {
  const d = await findDestination({ slug: req.params.slug })
  if (!d || d.status !== DEST_STATUS.ACTIVE) throw notFound('Destinasi tidak tersedia.')
  const parsed = isoDate.safeParse(req.query.date)
  if (!parsed.success) throw unprocessable('Pilih tanggal kunjungan yang valid.', { date: parsed.error.issues[0].message })
  await expireStaleReservations()
  const booked = await bookedCounts(pool, [d.id], parsed.data)
  res.json({ availability: availabilityFor(d, parsed.data, booked[d.id] || 0) })
}

export async function reviews(req, res) {
  const d = await findDestination({ id: req.params.id })
  if (!d || d.status !== DEST_STATUS.ACTIVE) throw notFound('Destinasi tidak tersedia.')
  res.json({ reviews: await reviewsForDestination(d.id) })
}

/* ------------------------ Pengelola (3.9) ------------------------ */

function parseDestination(body) {
  const result = destinationSchema.safeParse(body)
  if (result.success) return result.data
  const err = zodToHttp(result.error, 'Data destinasi belum lengkap.')
  // Frontend menampilkan galat koordinat pada satu kolom "location".
  if (err.fields.lat || err.fields.lng) err.fields.location = err.fields.lat || err.fields.lng
  throw err
}

export async function listManaged(req, res) {
  res.json({ destinations: await listDestinationsByIds(req.user.destinationIds) })
}

async function getOwned(req) {
  const d = await findDestination({ id: req.params.id })
  if (!d || !(await isManager(req.user.id, d.id))) throw notFound('Destinasi tidak ditemukan.')
  return d
}

export async function showManaged(req, res) {
  res.json({ destination: await getOwned(req) })
}

export async function create(req, res) {
  const input = parseDestination(req.body)
  const id = newId('dst')
  await transaction(async (c) => {
    await insertDestination(c, id, slugify(input.name), editablePayload(input))
    await c.query('INSERT INTO destination_managers (user_id, destination_id) VALUES (?, ?)', [req.user.id, id])
  })
  res.status(201).json({ destination: await findDestination({ id }) })
}

/**
 * Perubahan destinasi AKTIF disimpan sebagai pending_changes sampai disetujui Admin,
 * sehingga halaman publik tetap memakai data lama. Destinasi yang belum aktif diubah langsung
 * dan kembali berstatus MENUNGGU_VERIFIKASI.
 */
export async function update(req, res) {
  const d = await getOwned(req)
  const input = parseDestination(req.body)
  await transaction(async (c) => {
    const payload = editablePayload(input, await allTicketIds(c, d.id))
    if (d.status === DEST_STATUS.ACTIVE) {
      await c.query('UPDATE destinations SET pending_changes = ?, review_note = NULL WHERE id = ?', [JSON.stringify(payload), d.id])
    } else {
      await applyPayload(c, d.id, payload)
      await c.query(`UPDATE destinations SET status = 'MENUNGGU_VERIFIKASI', review_note = NULL, pending_changes = NULL WHERE id = ?`, [d.id])
    }
  })
  res.json({ destination: await findDestination({ id: d.id }) })
}

export function uploadPhoto(req, res) {
  if (!req.file) throw unprocessable('Pilih foto destinasi.', { photo: 'Pilih foto destinasi.' })
  res.status(201).json({ photo: { src: publicUploadUrl('destinations', req.file.filename), credit: 'Unggahan pengelola', source: '' } })
}

/* -------------------------- Admin (3.9) -------------------------- */

export async function listAll(_req, res) {
  res.json({ destinations: await listAllDestinations() })
}

export async function verify(req, res) {
  const approve = req.body?.approve === true
  const note = String(req.body?.note || '').trim().slice(0, 500)
  if (!approve && !note) throw unprocessable('Catatan penolakan wajib diisi.', { note: 'Tuliskan alasan penolakan.' })
  const d = await findDestination({ id: req.params.id })
  if (!d) throw notFound('Destinasi tidak ditemukan.')
  await transaction(async (c) => {
    if (d.pendingChanges) {
      if (approve) await applyPayload(c, d.id, d.pendingChanges)
      await c.query('UPDATE destinations SET pending_changes = NULL, review_note = ? WHERE id = ?', [approve ? null : note, d.id])
    } else if (d.status === DEST_STATUS.PENDING || d.status === DEST_STATUS.REJECTED) {
      await c.query('UPDATE destinations SET status = ?, review_note = ? WHERE id = ?', [
        approve ? DEST_STATUS.ACTIVE : DEST_STATUS.REJECTED,
        approve ? null : note,
        d.id,
      ])
    } else {
      throw unprocessable('Tidak ada pengajuan yang menunggu verifikasi untuk destinasi ini.')
    }
  })
  res.json({ destination: await findDestination({ id: d.id }) })
}

export async function setStatus(req, res) {
  const d = await findDestination({ id: req.params.id })
  if (!d) throw notFound('Destinasi tidak ditemukan.')
  if (![DEST_STATUS.ACTIVE, DEST_STATUS.INACTIVE].includes(d.status))
    throw forbidden('Destinasi yang belum diverifikasi tidak dapat diaktifkan langsung.')
  const active = req.body?.active === true
  await pool.query('UPDATE destinations SET status = ? WHERE id = ?', [active ? DEST_STATUS.ACTIVE : DEST_STATUS.INACTIVE, d.id])
  res.json({ destination: await findDestination({ id: d.id }) })
}
