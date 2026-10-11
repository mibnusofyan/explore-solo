import ExcelJS from 'exceljs'
import PDFDocument from 'pdfkit'
import { formatDateID, formatDateTimeWIB, rupiah } from '../utils/time.js'

const STATUS_LABEL = {
  MENUNGGU_PEMBAYARAN: 'Menunggu Pembayaran',
  LUNAS: 'Lunas',
  SUDAH_DIGUNAKAN: 'Sudah Digunakan',
  DIBATALKAN: 'Dibatalkan',
}

export async function renderReportXlsx({ rows, summary, title, period }) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Explore Solo'
  const ws = wb.addWorksheet('Reservasi')
  ws.addRow([title]).font = { bold: true, size: 14 }
  ws.addRow([period])
  ws.addRow([])
  ws.addRow(['Reservasi', summary.reservations, 'Tiket terjual', summary.ticketsSold, 'Pengunjung hadir', summary.visitors, 'Pendapatan', summary.revenue])
  ws.addRow([])
  const header = ws.addRow(['Kode booking', 'Destinasi', 'Tanggal kunjungan', 'Pemesan', 'Email', 'Tiket', 'Jumlah', 'Total (Rp)', 'Status', 'Metode bayar', 'Check-in'])
  header.font = { bold: true }
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F7F7' } }
  for (const r of rows) {
    ws.addRow([
      r.code, r.destination?.name, r.date, r.contact.name, r.contact.email,
      r.items.map((i) => `${i.qty} ${i.name}`).join(', '), r.totalQty, r.total,
      STATUS_LABEL[r.status], r.payment?.method || '', r.checkedInAt ? formatDateTimeWIB(r.checkedInAt) : '',
    ])
  }
  ws.getColumn(8).numFmt = '#,##0'
  ws.getCell('H4').numFmt = '#,##0'
  ;[14, 30, 16, 22, 28, 26, 8, 12, 20, 14, 22].forEach((w, i) => (ws.getColumn(i + 1).width = w))
  return Buffer.from(await wb.xlsx.writeBuffer())
}

export async function renderReportPdf({ rows, summary, title, period }) {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36, info: { Title: title, Author: 'Explore Solo' } })
  const chunks = []
  doc.on('data', (c) => chunks.push(c))
  const done = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))))

  doc.font('Helvetica-Bold').fontSize(16).fillColor('#222222').text(title)
  doc.font('Helvetica').fontSize(10).fillColor('#6a6a6a').text(period)
  doc.moveDown(0.6)
  doc.fillColor('#222222').fontSize(10).text(
    `Reservasi: ${summary.reservations}    Tiket terjual: ${summary.ticketsSold}    Pengunjung hadir: ${summary.visitors}    Pendapatan: ${rupiah(summary.revenue)}`,
  )
  doc.moveDown(0.8)

  const cols = [
    ['Kode', 70], ['Kunjungan', 90], ['Destinasi', 170], ['Pemesan', 140], ['Tiket', 50], ['Total', 90], ['Status', 110],
  ]
  const left = 36
  const drawHeader = () => {
    let x = left
    const y = doc.y
    doc.rect(left, y - 3, cols.reduce((s, c) => s + c[1], 0), 18).fill('#f7f7f7')
    doc.fillColor('#6a6a6a').font('Helvetica-Bold').fontSize(8)
    for (const [label, w] of cols) {
      doc.text(label.toUpperCase(), x + 4, y + 2, { width: w - 8 })
      x += w
    }
    doc.y = y + 20
  }
  drawHeader()
  doc.font('Helvetica').fontSize(9).fillColor('#222222')
  for (const r of rows) {
    if (doc.y > doc.page.height - 60) {
      doc.addPage()
      drawHeader()
      doc.font('Helvetica').fontSize(9).fillColor('#222222')
    }
    const y = doc.y
    const cells = [
      r.code, formatDateID(r.date, { month: 'short' }), r.destination?.name || '', r.contact.name,
      String(r.totalQty), rupiah(r.total), STATUS_LABEL[r.status],
    ]
    let x = left
    cells.forEach((c, i) => {
      doc.text(c, x + 4, y, { width: cols[i][1] - 8, height: 12, ellipsis: true, lineBreak: false })
      x += cols[i][1]
    })
    doc.y = y + 16
  }
  doc.end()
  return done
}
