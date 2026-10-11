// Membuat tabel dari schema.sql. Opsi --fresh menghapus semua tabel lebih dulu.
import { readFile } from 'node:fs/promises'
import { pool } from './pool.js'

const TABLES = ['sessions', 'reviews', 'payments', 'reservation_items', 'reservations', 'ticket_types', 'destination_managers', 'destinations', 'users']

export async function migrate({ fresh = false } = {}) {
  if (fresh) {
    await pool.query('SET FOREIGN_KEY_CHECKS = 0')
    for (const t of TABLES) await pool.query(`DROP TABLE IF EXISTS \`${t}\``)
    await pool.query('SET FOREIGN_KEY_CHECKS = 1')
  }
  const sql = await readFile(new URL('./schema.sql', import.meta.url), 'utf8')
  const statements = sql
    .split(/;\s*$/m)
    .map((s) => s.replace(/^\s*--.*$/gm, '').trim())
    .filter(Boolean)
  for (const s of statements) await pool.query(s)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const fresh = process.argv.includes('--fresh')
  migrate({ fresh })
    .then(() => {
      console.log(`Migrasi selesai${fresh ? ' (fresh)' : ''}.`)
      return pool.end()
    })
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
