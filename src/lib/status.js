import { STATUS, DEST_STATUS } from '../services/api'

// Label dan warna lencana untuk status reservasi dan destinasi.
export const STATUS_STYLES = {
  [STATUS.PENDING]: { label: 'Menunggu Pembayaran', cls: 'bg-amber-50 text-amber-800 ring-amber-200' },
  [STATUS.PAID]: { label: 'Lunas', cls: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
  [STATUS.USED]: { label: 'Sudah Digunakan', cls: 'bg-sky-50 text-sky-800 ring-sky-200' },
  [STATUS.CANCELLED]: { label: 'Dibatalkan', cls: 'bg-soft text-muted ring-line' },
  [DEST_STATUS.ACTIVE]: { label: 'Aktif', cls: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
  [DEST_STATUS.PENDING]: { label: 'Menunggu Verifikasi', cls: 'bg-amber-50 text-amber-800 ring-amber-200' },
  [DEST_STATUS.REJECTED]: { label: 'Ditolak', cls: 'bg-brand-50 text-brand-700 ring-brand-200' },
  [DEST_STATUS.INACTIVE]: { label: 'Nonaktif', cls: 'bg-soft text-muted ring-line' },
}

export function statusLabel(status) {
  return STATUS_STYLES[status]?.label ?? status
}
