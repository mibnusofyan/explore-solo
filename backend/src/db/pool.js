import mysql from 'mysql2/promise'
import { config } from '../config/index.js'

// DATETIME disimpan dalam UTC; kolom DATE (tanggal kunjungan) dikembalikan apa adanya
// sebagai string YYYY-MM-DD agar tidak bergeser zona waktu.
export const pool = mysql.createPool({
  ...config.db,
  connectionLimit: 10,
  timezone: 'Z',
  dateStrings: ['DATE'],
  decimalNumbers: true,
  namedPlaceholders: true,
})

export const query = async (sql, params) => (await pool.query(sql, params))[0]

/** Jalankan fn di dalam transaksi; commit bila berhasil, rollback bila melempar. */
export async function transaction(fn) {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const result = await fn(conn)
    await conn.commit()
    return result
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}
