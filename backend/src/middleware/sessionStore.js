import session from 'express-session'
import { query } from '../db/pool.js'

/** Penyimpanan sesi express-session di tabel `sessions` MySQL. */
export class MySQLSessionStore extends session.Store {
  async get(sid, cb) {
    try {
      const rows = await query('SELECT data FROM sessions WHERE sid = ? AND expires_at > UTC_TIMESTAMP()', [sid])
      cb(null, rows[0]?.data ?? null)
    } catch (err) {
      cb(err)
    }
  }

  async set(sid, sess, cb) {
    try {
      const expires = sess.cookie?.expires ? new Date(sess.cookie.expires) : new Date(Date.now() + 86_400_000)
      await query(
        `INSERT INTO sessions (sid, data, user_id, expires_at) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE data = VALUES(data), user_id = VALUES(user_id), expires_at = VALUES(expires_at)`,
        [sid, JSON.stringify(sess), sess.userId ?? null, expires],
      )
      cb?.(null)
    } catch (err) {
      cb?.(err)
    }
  }

  async destroy(sid, cb) {
    try {
      await query('DELETE FROM sessions WHERE sid = ?', [sid])
      cb?.(null)
    } catch (err) {
      cb?.(err)
    }
  }

  async touch(sid, sess, cb) {
    try {
      const expires = sess.cookie?.expires ? new Date(sess.cookie.expires) : new Date(Date.now() + 86_400_000)
      await query('UPDATE sessions SET expires_at = ? WHERE sid = ?', [expires, sid])
      cb?.(null)
    } catch (err) {
      cb?.(err)
    }
  }
}

export async function purgeExpiredSessions() {
  await query('DELETE FROM sessions WHERE expires_at <= UTC_TIMESTAMP()')
}

/** Hapus semua sesi milik pengguna (mis. setelah dinonaktifkan atau ganti password). */
export async function destroyUserSessions(userId, exceptSid) {
  await query('DELETE FROM sessions WHERE user_id = ? AND sid <> ?', [userId, exceptSid || ''])
}
