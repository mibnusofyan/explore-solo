// Sistem memakai zona waktu WIB (SRS 2.7 f).
export const TZ = 'Asia/Jakarta'

export function todayWIB(now = new Date()) {
  return now.toLocaleDateString('en-CA', { timeZone: TZ })
}

export function addDays(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** 0 = Minggu … 6 = Sabtu */
export function weekdayOf(iso) {
  return new Date(`${iso}T00:00:00Z`).getUTCDay()
}

export const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

export function formatDateID(iso, opts = {}) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('id-ID', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...opts,
  })
}

export function formatDateTimeWIB(d) {
  if (!d) return '-'
  return `${new Date(d).toLocaleString('id-ID', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} WIB`
}

export function rupiah(n) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0)
}

/** Date JS → epoch ms (null tetap null), untuk respons JSON yang konsisten. */
export const ms = (d) => (d ? new Date(d).getTime() : null)
