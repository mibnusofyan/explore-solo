import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { reservations } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { formatShortDate, rupiah, rupiahPlain, todayISO } from '../lib/format'
import { Stepper } from './SearchBar'
import { Alert, RatingInline } from './ui'
import { encodeQty } from '../lib/qty'

/** Kartu pemesanan menempel di sisi kanan halaman detail (SRS 3.5 langkah 1–4). */
export function BookingCard({ d, initialDate, initialGuests, compact = false }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [date, setDate] = useState(initialDate || '')
  const [qty, setQty] = useState(() => (initialGuests ? { [d.tickets[0].id]: Math.min(20, initialGuests) } : {}))
  const [touched, setTouched] = useState(false)

  const quote = useMemo(() => reservations.quote(d, date, qty), [d, date, qty])
  const blocking = touched ? quote.errors[0] : date && !quote.avail?.open ? quote.avail.reason : null

  const reserve = () => {
    setTouched(true)
    if (quote.errors.length) return
    const target = `/pesan/${d.slug}?tanggal=${date}&tiket=${encodeQty(qty)}`
    if (!user) navigate(`/masuk?next=${encodeURIComponent(target)}`, { state: { reason: 'Masuk dulu untuk melanjutkan reservasi.' } })
    else navigate(target)
  }

  const canBook = !user || user.role === 'wisatawan'

  return (
    <div className={compact ? '' : 'card p-6 shadow-card'}>
      {!compact && (
        <div className="mb-6 flex items-end justify-between gap-2">
          <div>
            {d.minPrice ? (
              <>
                <span className="text-[22px] font-bold">{rupiah(d.minPrice)}</span>
                <span className="text-muted"> / orang</span>
              </>
            ) : (
              <span className="text-[22px] font-bold">Gratis</span>
            )}
          </div>
          <RatingInline rating={d.rating} count={d.reviewCount} />
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-muted/50">
        <label className="relative block cursor-pointer border-b border-muted/50 px-4 py-3 focus-within:ring-2 focus-within:ring-ink focus-within:ring-inset">
          <span className="block text-[10px] font-extrabold tracking-wide uppercase">Tanggal kunjungan</span>
          <span className={`text-sm ${date ? '' : 'text-muted'}`}>{date ? formatShortDate(date) : 'Pilih tanggal'}</span>
          <input
            type="date"
            min={todayISO()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            onClick={(e) => e.currentTarget.showPicker?.()}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="Tanggal kunjungan"
          />
        </label>
        <div className="divide-y divide-line px-4">
          {d.tickets.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold">{t.name}</div>
                <div className="text-xs text-muted">
                  {rupiah(t.price)} · {t.desc}
                </div>
              </div>
              <Stepper
                value={qty[t.id] || 0}
                label={t.name}
                max={20}
                onChange={(n) => setQty((q) => ({ ...q, [t.id]: Math.max(0, n) }))}
              />
            </div>
          ))}
        </div>
      </div>

      {date && quote.avail?.open && (
        <p className="mt-3 text-sm text-muted">
          Sisa kuota <span className="font-semibold text-ink">{quote.avail.remaining}</span> dari {quote.avail.quota} tiket pada tanggal ini
        </p>
      )}

      {blocking && (
        <Alert className="mt-4" tone="error">
          {blocking}
        </Alert>
      )}

      {canBook ? (
        <button className="btn-brand mt-4 w-full py-3.5 text-base" onClick={reserve}>
          {user ? 'Pesan sekarang' : 'Masuk untuk memesan'}
        </button>
      ) : (
        <Alert className="mt-4" tone="info">
          Reservasi hanya untuk akun Wisatawan.
        </Alert>
      )}
      <p className="mt-3 text-center text-sm text-muted">Anda belum dikenakan biaya</p>

      {quote.items.length > 0 && (
        <div className="mt-6 space-y-3 text-[15px]">
          {quote.items.map((i) => (
            <div key={i.ticketId} className="flex justify-between">
              <span className="underline decoration-line underline-offset-4">
                {i.name} × {i.qty}
              </span>
              <span>{rupiahPlain(i.price * i.qty)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t border-line pt-4 font-bold">
            <span>Total</span>
            <span>{rupiahPlain(quote.total)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
