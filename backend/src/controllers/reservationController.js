import { config } from '../config/index.js'
import { pool, transaction } from '../db/pool.js'
import { DEST_STATUS, availabilityFor, bookedCounts, findDestination, isManager } from '../models/destinationModel.js'
import {
  STATUS,
  expireStaleReservations,
  getReservationView,
  listReservationsForUser,
  reportRows,
  summarize,
} from '../models/reservationModel.js'
import { insertReview } from '../models/reviewModel.js'
import { createSnapTransaction, fetchTransactionStatus, outcomeOf, snapScriptUrl, verifySignature } from '../services/midtrans.js'
import { markFailed, markPaid, sendTicketEmail } from '../services/paymentService.js'
import { renderTicketPdf } from '../services/ticketPdf.js'
import { renderReportPdf, renderReportXlsx } from '../services/reportExport.js'
import { bookingCode, newId } from '../utils/ids.js'
import { addDays, formatDateID, formatDateTimeWIB, todayWIB } from '../utils/time.js'
import { HttpError, badRequest, conflict, forbidden, notFound, unprocessable } from '../utils/httpError.js'

const MAX_TICKETS = 20

/** Muat reservasi yang boleh dilihat pengguna ini: pemiliknya, pengelola destinasinya, atau Admin. */
async function loadVisible(req) {
  await expireStaleReservations()
  const r = await getReservationView(req.params.id)
  if (!r) throw notFound('Reservasi tidak ditemukan.')
  const u = req.user
  const allowed = r.userId === u.id || u.role === 'admin' || (u.role === 'pengelola' && u.destinationIds.includes(r.destinationId))
  if (!allowed) throw notFound('Reservasi tidak ditemukan.')
  return r
}

async function loadOwn(req) {
  const r = await loadVisible(req)
  if (r.userId !== req.user.id) throw notFound('Reservasi tidak ditemukan.')
  return r
}

/** SRS 3.5 Reservasi Tiket: validasi tanggal & kuota, simpan dengan status Menunggu Pembayaran. */
export async function create(req, res) {
  const { destinationId, date, quantities, contact } = req.body
  await expireStaleReservations()
  const d = await findDestination({ id: destinationId })
  if (!d || d.status !== DEST_STATUS.ACTIVE) throw notFound('Destinasi tidak tersedia atau sudah dinonaktifkan.')

  const lines = d.tickets.map((t) => ({ ticket: t, qty: quantities[t.id] || 0 })).filter((l) => l.qty > 0)
  const unknown = Object.entries(quantities).some(([id, n]) => n > 0 && !d.tickets.some((t) => t.id === id))
  if (unknown) throw unprocessable('Jenis tiket tidak valid untuk destinasi ini.')
  const totalQty = lines.reduce((s, l) => s + l.qty, 0)
  if (!totalQty) throw unprocessable('Pilih minimal 1 tiket.')
  if (totalQty > MAX_TICKETS) throw unprocessable(`Maksimal ${MAX_TICKETS} tiket per reservasi.`)
  const total = lines.reduce((s, l) => s + l.qty * l.ticket.price, 0)

  const id = newId('rsv')
  const free = total === 0
  await transaction(async (c) => {
    // Kunci baris destinasi agar dua pemesan pada saat bersamaan tidak melampaui kuota.
    await c.query('SELECT id FROM destinations WHERE id = ? FOR UPDATE', [d.id])
    const booked = (await bookedCounts(c, [d.id], date))[d.id] || 0
    const a = availabilityFor(d, date, booked)
    if (!a.open) throw conflict(a.reason)
    if (totalQty > a.remaining) throw conflict(`Kuota tidak mencukupi. Sisa kuota ${a.remaining} tiket pada tanggal tersebut.`)

    let code
    for (let i = 0; i < 5 && !code; i++) {
      const candidate = bookingCode()
      const [[exists]] = await c.query('SELECT 1 AS x FROM reservations WHERE code = ?', [candidate])
      if (!exists) code = candidate
    }
    const expiresAt = new Date(Date.now() + config.paymentWindowMinutes * 60_000)
    await c.query(
      `INSERT INTO reservations (id, code, user_id, destination_id, visit_date, total_qty, total_amount, status,
         contact_name, contact_email, contact_phone, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, code, req.user.id, d.id, date, totalQty, total, free ? STATUS.PAID : STATUS.PENDING, contact.name, contact.email, contact.phone, expiresAt],
    )
    await c.query('INSERT INTO reservation_items (reservation_id, ticket_type_id, name, price, qty) VALUES ?', [
      lines.map((l) => [id, l.ticket.id, l.ticket.name, l.ticket.price, l.qty]),
    ])
    if (free) {
      await c.query(
        `INSERT INTO payments (id, reservation_id, order_id, provider, method, status, gross_amount, paid_at)
         VALUES (?, ?, ?, 'gratis', 'gratis', 'BERHASIL', 0, UTC_TIMESTAMP())`,
        [newId('pay'), id, `${code}-0`],
      )
    }
  })
  if (free) await sendTicketEmail(id)
  res.status(201).json({ reservation: await getReservationView(id) })
}

export async function listMine(req, res) {
  await expireStaleReservations()
  res.json({ reservations: await listReservationsForUser(req.user.id) })
}

export async function show(req, res) {
  res.json({ reservation: await loadVisible(req) })
}

/** Wisatawan membatalkan reservasi yang belum dibayar (SRS 3.7). */
export async function cancel(req, res) {
  const r = await loadOwn(req)
  if (r.status !== STATUS.PENDING) throw conflict('Hanya reservasi yang belum dibayar yang dapat dibatalkan.')
  await transaction(async (c) => {
    await c.query(`UPDATE reservations SET status = 'DIBATALKAN', cancel_reason = 'Dibatalkan oleh wisatawan' WHERE id = ? AND status = 'MENUNGGU_PEMBAYARAN'`, [r.id])
    await c.query(`UPDATE payments SET status = 'GAGAL' WHERE reservation_id = ? AND status = 'PENDING'`, [r.id])
  })
  res.json({ reservation: await getReservationView(r.id) })
}

/* --------------------------- Pembayaran (3.6) --------------------------- */

/**
 * Mulai pembayaran. Dengan Midtrans: buat transaksi Snap (atau pakai ulang token yang masih berlaku).
 * Tanpa Midtrans (pengembangan): kembalikan mode "simulation" untuk halaman simulasi.
 */
export async function startPayment(req, res) {
  const r = await loadOwn(req)
  if (r.status === STATUS.CANCELLED) throw new HttpError(410, r.cancelReason || 'Reservasi sudah dibatalkan.')
  if (r.status !== STATUS.PENDING) return res.json({ mode: 'paid', reservation: r })

  if (!config.midtrans.enabled) {
    if (!config.paymentSimulation) throw new HttpError(503, 'Pembayaran belum dikonfigurasi. Hubungi admin.')
    return res.json({ mode: 'simulation', reservation: r })
  }

  const minutesLeft = Math.floor((r.expiresAt - Date.now()) / 60_000)
  const [[existing]] = await pool.query(
    `SELECT * FROM payments WHERE reservation_id = ? AND provider = 'midtrans' AND status = 'PENDING'
     ORDER BY created_at DESC LIMIT 1`,
    [r.id],
  )
  let tokenValue = existing?.snap_token
  if (!tokenValue) {
    const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM payments WHERE reservation_id = ?', [r.id])
    const orderId = `${r.code}-${n + 1}`
    const snap = await createSnapTransaction({ orderId, reservation: r, destinationName: r.destination.name, minutesLeft })
    tokenValue = snap.token
    await pool.query(
      `INSERT INTO payments (id, reservation_id, order_id, provider, status, gross_amount, snap_token)
       VALUES (?, ?, ?, 'midtrans', 'PENDING', ?, ?)`,
      [newId('pay'), r.id, orderId, r.total, tokenValue],
    )
  }
  res.json({ mode: 'midtrans', token: tokenValue, clientKey: config.midtrans.clientKey, snapUrl: snapScriptUrl(), reservation: r })
}

/** Hanya untuk pengembangan/sandbox tanpa kunci Midtrans: meniru notifikasi berhasil/gagal. */
export async function simulatePayment(req, res) {
  if (!config.paymentSimulation) throw forbidden('Simulasi pembayaran tidak aktif.')
  const r = await loadOwn(req)
  if (r.status === STATUS.CANCELLED) throw new HttpError(410, r.cancelReason || 'Reservasi sudah dibatalkan.')
  if (r.status !== STATUS.PENDING) return res.json({ reservation: r })
  const method = String(req.body?.method || '').slice(0, 40)
  if (!method) throw unprocessable('Pilih metode pembayaran.')
  const orderId = `${r.code}-sim-${Date.now()}`
  await pool.query(
    `INSERT INTO payments (id, reservation_id, order_id, provider, method, status, gross_amount)
     VALUES (?, ?, ?, 'simulasi', ?, 'PENDING', ?)`,
    [newId('pay'), r.id, orderId, method, r.total],
  )
  if (req.body?.outcome === 'failure') {
    await markFailed({ reservationId: r.id, orderId, reason: 'Pembayaran ditolak oleh payment gateway' })
  } else {
    await markPaid({ reservationId: r.id, orderId, method, transactionId: `SIM-${Date.now().toString(36).toUpperCase()}` })
  }
  res.json({ reservation: await getReservationView(r.id) })
}

/** Cek status ke Midtrans (dipanggil setelah Snap ditutup, bila webhook belum sampai). */
export async function syncPayment(req, res) {
  const r = await loadOwn(req)
  if (config.midtrans.enabled && r.status === STATUS.PENDING) {
    const [[p]] = await pool.query(
      `SELECT order_id FROM payments WHERE reservation_id = ? AND provider = 'midtrans' ORDER BY created_at DESC LIMIT 1`,
      [r.id],
    )
    if (p) {
      try {
        await applyMidtransStatus(r.id, await fetchTransactionStatus(p.order_id))
      } catch (err) {
        if (err.httpStatusCode !== 404 && err.httpStatusCode !== '404') throw err
      }
    }
  }
  res.json({ reservation: await getReservationView(r.id) })
}

async function applyMidtransStatus(reservationId, n) {
  const outcome = outcomeOf(n)
  if (outcome === 'paid') {
    await markPaid({ reservationId, orderId: n.order_id, method: n.payment_type, transactionId: n.transaction_id, raw: n })
  } else if (outcome === 'failed') {
    const reason = n.transaction_status === 'expire' ? 'Batas waktu pembayaran terlewati' : 'Pembayaran ditolak oleh payment gateway'
    await markFailed({ reservationId, orderId: n.order_id, reason, raw: n })
  }
}

/** Webhook notifikasi Midtrans (HTTP Notification URL). */
export async function midtransNotification(req, res) {
  const n = req.body || {}
  if (!config.midtrans.enabled) throw notFound()
  if (!verifySignature(n)) throw forbidden('Signature notifikasi tidak valid.')
  const [[p]] = await pool.query('SELECT reservation_id, gross_amount FROM payments WHERE order_id = ?', [n.order_id])
  if (!p) throw notFound('Order tidak dikenal.')
  if (Math.round(Number(n.gross_amount)) !== p.gross_amount) throw badRequest('Nominal tidak sesuai.')
  await applyMidtransStatus(p.reservation_id, n)
  res.json({ ok: true })
}

/* ----------------------------- E-tiket PDF ----------------------------- */

export async function ticketPdf(req, res) {
  const r = await loadVisible(req)
  if (r.status !== STATUS.PAID && r.status !== STATUS.USED) throw conflict('E-tiket terbit setelah pembayaran lunas.')
  const pdf = await renderTicketPdf(r)
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="e-tiket-${r.code}.pdf"`,
    'Cache-Control': 'no-store',
  })
  res.send(pdf)
}

/* -------------------------- Ulasan (SRS 3.11) -------------------------- */

export async function createReview(req, res) {
  const r = await loadOwn(req)
  if (r.status !== STATUS.USED)
    throw conflict('Ulasan hanya dapat diberikan setelah tiket digunakan (berstatus "Sudah Digunakan").')
  if (r.review) throw conflict('Reservasi ini sudah pernah diulas.')
  try {
    const review = await insertReview({
      id: newId('rvw'),
      reservationId: r.id,
      destinationId: r.destinationId,
      userId: req.user.id,
      rating: req.body.rating,
      comment: req.body.comment,
      visitDate: r.date,
    })
    res.status(201).json({ review })
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') throw conflict('Reservasi ini sudah pernah diulas.')
    throw err
  }
}

/* ------------------------ Check-in (SRS 3.8) ------------------------ */

export async function checkIn(req, res) {
  const code = String(req.body?.code || '').trim().toUpperCase()
  if (!code) throw unprocessable('Masukkan kode booking.', { code: 'Wajib diisi.' })
  await expireStaleReservations()
  const result = await transaction(async (c) => {
    const [[row]] = await c.query('SELECT * FROM reservations WHERE code = ? FOR UPDATE', [code])
    if (!row) return { valid: false, reason: 'Kode booking tidak ditemukan.' }
    const fail = (reason) => ({ valid: false, reason, id: row.id })
    if (!(await isManager(req.user.id, row.destination_id))) return { valid: false, reason: 'Tiket ini bukan untuk destinasi yang Anda kelola.' }
    if (row.status === STATUS.USED) return fail(`Tiket sudah digunakan pada ${formatDateTimeWIB(row.checked_in_at)}.`)
    if (row.status === STATUS.PENDING) return fail('Tiket belum lunas.')
    if (row.status === STATUS.CANCELLED) return fail('Reservasi sudah dibatalkan.')
    if (row.visit_date !== todayWIB()) return fail(`Tanggal kunjungan tiket ini ${formatDateID(row.visit_date)}, bukan hari ini.`)
    await c.query(`UPDATE reservations SET status = 'SUDAH_DIGUNAKAN', checked_in_at = UTC_TIMESTAMP(), checked_in_by = ? WHERE id = ?`, [
      req.user.id,
      row.id,
    ])
    return { valid: true, id: row.id }
  })
  const reservation = result.id ? await getReservationView(result.id) : null
  res.json({ valid: result.valid, reason: result.reason, reservation })
}

/* ----------------------- Laporan (SRS 3.10) ----------------------- */

export async function report(req, res) {
  const { from, to, status, destinationId, format } = req.validQuery
  const scope = req.user.role === 'admin' ? null : req.user.destinationIds
  if (destinationId && scope && !scope.includes(destinationId)) throw forbidden('Destinasi ini bukan milik Anda.')
  await expireStaleReservations()
  const f = from || addDays(todayWIB(), -30)
  const t = to || addDays(todayWIB(), 14)
  if (f > t) throw unprocessable('Tanggal awal harus sebelum tanggal akhir.', { from: 'Rentang tidak valid.' })
  const rows = await reportRows({ destinationIds: scope, from: f, to: t, status, destinationId })
  const summary = summarize(rows)
  if (format === 'json') return res.json({ rows, summary })

  const scopeName = destinationId ? rows[0]?.destination?.name || 'Destinasi' : scope ? 'Destinasi yang dikelola' : 'Semua destinasi'
  const meta = { rows, summary, title: `Laporan Reservasi · ${scopeName}`, period: `Periode kunjungan ${formatDateID(f)} – ${formatDateID(t)}` }
  const name = `laporan-reservasi-${f}-${t}`
  if (format === 'xlsx') {
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${name}.xlsx"`,
    })
    return res.send(await renderReportXlsx(meta))
  }
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${name}.pdf"` })
  res.send(await renderReportPdf(meta))
}

