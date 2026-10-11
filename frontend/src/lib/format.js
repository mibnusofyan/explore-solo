// Seluruh waktu memakai WIB dan mata uang Rupiah (SRS 2.7 f).
export const TZ = 'Asia/Jakarta'

const rupiahFmt = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

export function rupiah(value) {
  if (!value) return 'Gratis'
  return rupiahFmt.format(value)
}

export function rupiahPlain(value) {
  return rupiahFmt.format(value || 0)
}

/** Tanggal hari ini (WIB) dalam format YYYY-MM-DD. */
export function todayISO() {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ })
}

export function addDays(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Hari dalam minggu (0 = Minggu) untuk tanggal YYYY-MM-DD. */
export function weekdayOf(iso) {
  return new Date(`${iso}T00:00:00Z`).getUTCDay()
}

export function formatDate(iso, opts = {}) {
  if (!iso) return '-'
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('id-ID', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...opts,
  })
}

export function formatShortDate(iso) {
  return formatDate(iso, { day: 'numeric', month: 'short', year: undefined })
}

export function formatDateTime(ts) {
  if (!ts) return '-'
  return (
    new Date(ts).toLocaleString('id-ID', {
      timeZone: TZ,
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }) + ' WIB'
  )
}

export const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

export function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

export function pluralTiket(n) {
  return `${n} tiket`
}
