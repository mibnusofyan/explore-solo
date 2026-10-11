import PDFDocument from 'pdfkit'
import QRCode from 'qrcode'
import { formatDateID, formatDateTimeWIB, rupiah } from '../utils/time.js'

const STATUS_LABEL = { LUNAS: 'Lunas', SUDAH_DIGUNAKAN: 'Sudah Digunakan' }

export async function qrPng(text) {
  return QRCode.toBuffer(text, { width: 360, margin: 1 })
}

/** E-tiket PDF (SRS 3.7) berisi kode QR, kode booking, dan rincian kunjungan. */
export async function renderTicketPdf(r) {
  const qr = await qrPng(r.code)
  const doc = new PDFDocument({ size: 'A5', margin: 36, info: { Title: `E-Tiket ${r.code}`, Author: 'Explore Solo' } })
  const chunks = []
  doc.on('data', (c) => chunks.push(c))
  const done = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))))

  const brand = '#E31C5F'
  const W = doc.page.width - 72
  doc.rect(0, 0, doc.page.width, 92).fill(brand)
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10).text('EXPLORE SOLO · E-TIKET', 36, 30, { characterSpacing: 1 })
  doc.fontSize(18).text(r.destination.name, 36, 46, { width: W })

  doc.fillColor('#222222')
  doc.image(qr, doc.page.width / 2 - 75, 112, { width: 150 })
  doc.font('Courier-Bold').fontSize(18).text(r.code, 36, 270, { width: W, align: 'center' })
  doc.font('Helvetica').fontSize(9).fillColor('#6a6a6a').text('Tunjukkan kode QR ini kepada petugas saat masuk', { width: W, align: 'center' })

  let y = 316
  const row = (label, value) => {
    doc.font('Helvetica').fontSize(8).fillColor('#6a6a6a').text(label.toUpperCase(), 36, y, { characterSpacing: 0.5 })
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#222222').text(value, 36, y + 11, { width: W })
    y = doc.y + 8
  }
  row('Tanggal kunjungan', formatDateID(r.date, { weekday: 'long' }))
  row('Nama pemesan', r.contact.name)
  row('Tiket', r.items.map((i) => `${i.qty} × ${i.name}`).join(', '))
  row('Total dibayar', r.total ? rupiah(r.total) : 'Gratis')
  row('Status', STATUS_LABEL[r.status] || r.status)
  if (r.checkedInAt) row('Check-in', formatDateTimeWIB(r.checkedInAt))

  doc.moveTo(36, y + 4).lineTo(36 + W, y + 4).dash(3, { space: 3 }).strokeColor('#dddddd').stroke().undash()
  doc.font('Helvetica').fontSize(8).fillColor('#6a6a6a')
    .text(`${r.destination.address}\nJam buka ${r.destination.hours.open}–${r.destination.hours.close} WIB. Tiket berlaku untuk satu kali masuk pada tanggal kunjungan.`, 36, y + 14, { width: W })
  doc.end()
  return done
}
