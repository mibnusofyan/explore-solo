import { transaction } from '../db/pool.js'
import { STATUS, getReservationView } from '../models/reservationModel.js'
import { sendMail } from './mailer.js'
import { qrPng, renderTicketPdf } from './ticketPdf.js'
import { formatDateID, rupiah } from '../utils/time.js'
import { config } from '../config/index.js'

/**
 * Catat pembayaran berhasil (SRS 3.6 langkah 5): status reservasi → LUNAS, e-tiket terbit,
 * lalu e-tiket dikirim ke email pemesan. Aman dipanggil berulang (notifikasi ganda).
 */
export async function markPaid({ reservationId, orderId, method, transactionId, raw }) {
  const changed = await transaction(async (c) => {
    const [[r]] = await c.query('SELECT id, code, status FROM reservations WHERE id = ? FOR UPDATE', [reservationId])
    if (!r) return false
    await c.query(
      `UPDATE payments SET status = 'BERHASIL', method = COALESCE(?, method), transaction_id = ?, raw_response = ?, paid_at = UTC_TIMESTAMP()
       WHERE order_id = ? AND status <> 'BERHASIL'`,
      [method || null, transactionId || null, raw ? JSON.stringify(raw) : null, orderId],
    )
    if (r.status !== STATUS.PENDING) {
      if (r.status === STATUS.CANCELLED) {
        // Dana masuk setelah reservasi kedaluwarsa: perlu ditangani manual (refund tidak otomatis, SRS 1.4).
        console.warn(`[payment] ${orderId} lunas tetapi reservasi ${r.code} sudah dibatalkan.`)
      }
      return false
    }
    await c.query(`UPDATE reservations SET status = 'LUNAS', cancel_reason = NULL WHERE id = ?`, [reservationId])
    return true
  })
  if (changed) await sendTicketEmail(reservationId)
  return changed
}

/** Pembayaran gagal/kedaluwarsa (SRS 3.6 skenario gagal): reservasi dibatalkan, kuota kembali. */
export async function markFailed({ reservationId, orderId, reason, raw }) {
  return transaction(async (c) => {
    await c.query('SELECT id FROM reservations WHERE id = ? FOR UPDATE', [reservationId])
    await c.query(`UPDATE payments SET status = 'GAGAL', raw_response = ? WHERE order_id = ? AND status = 'PENDING'`, [
      raw ? JSON.stringify(raw) : null,
      orderId,
    ])
    const [res] = await c.query(
      `UPDATE reservations SET status = 'DIBATALKAN', cancel_reason = ? WHERE id = ? AND status = 'MENUNGGU_PEMBAYARAN'`,
      [reason, reservationId],
    )
    return res.affectedRows > 0
  })
}

export async function sendTicketEmail(reservationId) {
  const r = await getReservationView(reservationId)
  if (!r) return
  const [pdf, qr] = await Promise.all([renderTicketPdf(r), qrPng(r.code)])
  const lines = r.items.map((i) => `- ${i.qty} × ${i.name}`).join('\n')
  await sendMail({
    to: r.contact.email,
    subject: `E-tiket ${r.destination.name} · ${r.code}`,
    text: `Halo ${r.contact.name},\n\nPembayaran Anda sudah kami terima. Berikut e-tiket kunjungan Anda.\n\nDestinasi: ${r.destination.name}\nTanggal: ${formatDateID(r.date, { weekday: 'long' })}\nKode booking: ${r.code}\n${lines}\nTotal: ${r.total ? rupiah(r.total) : 'Gratis'}\n\nTunjukkan kode QR (terlampir) kepada petugas saat masuk.\nLihat e-tiket: ${config.appUrl}/reservasi/${r.id}\n\nSalam,\nExplore Solo`,
    html: `<p>Halo ${escapeHtml(r.contact.name)},</p><p>Pembayaran Anda sudah kami terima. Tunjukkan kode QR berikut kepada petugas saat masuk.</p>
<p><img src="cid:qr" width="180" height="180" alt="QR ${r.code}"></p>
<p><b>${escapeHtml(r.destination.name)}</b><br>${formatDateID(r.date, { weekday: 'long' })}<br>Kode booking: <b>${r.code}</b></p>
<p><a href="${config.appUrl}/reservasi/${r.id}">Lihat e-tiket</a></p>`,
    attachments: [
      { filename: `e-tiket-${r.code}.pdf`, content: pdf },
      { filename: `qr-${r.code}.png`, content: qr, cid: 'qr' },
    ],
  })
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch])
}
