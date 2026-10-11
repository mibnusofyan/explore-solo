import nodemailer from 'nodemailer'
import { config } from '../config/index.js'

// Tanpa SMTP_HOST, email tidak benar-benar dikirim: isinya dicatat ke konsol (pengembangan)
// dan disimpan di `outbox` (dipakai pengujian).
export const outbox = []

const transport = config.mail.host
  ? nodemailer.createTransport({
      host: config.mail.host,
      port: config.mail.port,
      secure: config.mail.secure,
      auth: config.mail.user ? { user: config.mail.user, pass: config.mail.pass } : undefined,
    })
  : nodemailer.createTransport({ jsonTransport: true })

export async function sendMail({ to, subject, text, html, attachments }) {
  const message = { from: config.mail.from, to, subject, text, html, attachments }
  try {
    const info = await transport.sendMail(message)
    if (!config.mail.host) {
      outbox.push({ to, subject, text, attachments: (attachments || []).map((a) => a.filename) })
      if (!config.isTest) console.log(`[email:dev] → ${to} | ${subject}\n${text}\n`)
    }
    return info
  } catch (err) {
    // Gagal kirim email tidak boleh menggagalkan transaksi utama (reservasi tetap tercatat).
    console.error('[email] gagal mengirim:', err.message)
    return null
  }
}
