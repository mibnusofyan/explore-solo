import { config } from './config/index.js'
import { createApp } from './app.js'
import { pool } from './db/pool.js'
import { migrate } from './db/migrate.js'
import { expireStaleReservations } from './models/reservationModel.js'
import { purgeExpiredSessions } from './middleware/sessionStore.js'

await migrate()
const app = createApp()

// Lepas kuota reservasi yang tidak dibayar dalam 60 menit, dan bersihkan sesi kedaluwarsa.
const timer = setInterval(() => {
  expireStaleReservations().catch((e) => console.error('[expire]', e.message))
  purgeExpiredSessions().catch((e) => console.error('[sessions]', e.message))
}, 60_000)

const server = app.listen(config.port, () => {
  console.log(`Explore Solo API berjalan di http://localhost:${config.port} (${config.env})`)
  console.log(`Pembayaran: ${config.midtrans.enabled ? 'Midtrans' : config.paymentSimulation ? 'simulasi (tanpa Midtrans)' : 'nonaktif'}`)
})

function shutdown() {
  clearInterval(timer)
  server.close(() => pool.end().then(() => process.exit(0)))
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
