import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { destinations, reservations, PAYMENT_WINDOW_MIN } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { categoryLabel } from '../data/destinations'
import { decodeQty } from '../lib/qty'
import { Alert, EmptyState, FieldError, PageLoader, Photo, RatingInline, Spinner } from '../components/ui'
import { formatDate, rupiahPlain } from '../lib/format'

/** SRS 3.5 langkah 4–7: ringkasan, data pemesan, konfirmasi reservasi. */
export default function Checkout() {
  const { slug } = useParams()
  const [sp] = useSearchParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [d, setD] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [contact, setContact] = useState({ name: user.name, email: user.email, phone: user.phone })
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const date = sp.get('tanggal') || ''
  const qty = useMemo(() => decodeQty(sp.get('tiket')), [sp])

  useEffect(() => {
    destinations
      .get(slug)
      .then(setD)
      .catch(() => setNotFound(true))
  }, [slug])

  const quote = useMemo(() => (d ? reservations.quote(d, date, qty) : null), [d, date, qty])

  if (notFound)
    return (
      <EmptyState icon="Building2" title="Destinasi tidak tersedia" action={<Link to="/" className="btn-dark">Lihat destinasi lain</Link>}>
        Destinasi ini sudah dinonaktifkan atau dihapus.
      </EmptyState>
    )
  if (!d) return <PageLoader />

  const back = `/destinasi/${d.slug}?tanggal=${date}`

  const confirm = async () => {
    const f = {}
    if (!contact.name.trim()) f.name = 'Nama pemesan wajib diisi.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) f.email = 'Email tidak valid.'
    if (!contact.phone.trim()) f.phone = 'Nomor HP wajib diisi.'
    setErrors(f)
    if (Object.keys(f).length) return
    setBusy(true)
    setError('')
    try {
      const r = await reservations.create(user, { destinationId: d.id, date, quantities: qty, contact })
      navigate(r.total === 0 ? `/reservasi/${r.id}?baru=1` : `/pembayaran/${r.id}`, { replace: true })
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-[1120px] px-4 py-8 sm:px-6 md:px-10 md:py-12">
      <div className="mb-8 flex items-center gap-2 md:mb-12">
        <Link to={back} className="-ml-3 rounded-full p-2 hover:bg-soft" aria-label="Kembali">
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="text-2xl font-bold tracking-tight md:text-[32px]">Konfirmasi reservasi</h1>
      </div>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-20">
        <div className="min-w-0">
          {quote.errors.length > 0 && (
            <Alert tone="error" className="mb-6">
              <b>Reservasi tidak dapat dilanjutkan.</b> {quote.errors[0]}{' '}
              <Link to={back} className="font-semibold underline">
                Ubah pilihan
              </Link>
            </Alert>
          )}

          <section className="border-b border-line pb-8">
            <h2 className="mb-6 text-[22px] font-semibold">Kunjungan Anda</h2>
            <Row title="Tanggal" value={date ? formatDate(date, { weekday: 'long' }) : '-'} to={back} />
            <Row title="Tiket" value={quote.items.map((i) => `${i.qty} ${i.name}`).join(', ') || '-'} to={back} />
            {quote.avail?.open && (
              <p className="mt-2 text-sm text-muted">Sisa kuota saat ini: {quote.avail.remaining} tiket</p>
            )}
          </section>

          <section className="border-b border-line py-8">
            <h2 className="mb-6 text-[22px] font-semibold">Data pemesan</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label" htmlFor="c-name">Nama lengkap</label>
                <input id="c-name" className="field" value={contact.name} aria-invalid={!!errors.name || undefined} onChange={(e) => setContact({ ...contact, name: e.target.value })} />
                <FieldError>{errors.name}</FieldError>
              </div>
              <div>
                <label className="label" htmlFor="c-email">Email (untuk e-tiket)</label>
                <input id="c-email" type="email" className="field" value={contact.email} aria-invalid={!!errors.email || undefined} onChange={(e) => setContact({ ...contact, email: e.target.value })} />
                <FieldError>{errors.email}</FieldError>
              </div>
              <div>
                <label className="label" htmlFor="c-phone">Nomor HP</label>
                <input id="c-phone" type="tel" className="field" value={contact.phone} aria-invalid={!!errors.phone || undefined} onChange={(e) => setContact({ ...contact, phone: e.target.value })} />
                <FieldError>{errors.phone}</FieldError>
              </div>
            </div>
          </section>

          <section className="border-b border-line py-8">
            <h2 className="mb-3 text-[22px] font-semibold">Kebijakan pembayaran & pembatalan</h2>
            <ul className="list-disc space-y-2 pl-5 text-[15px] text-muted">
              <li>
                Kuota ditahan selama <b className="text-ink">{PAYMENT_WINDOW_MIN} menit</b>. Bila belum dibayar, reservasi otomatis dibatalkan dan kuota dikembalikan.
              </li>
              <li>Reservasi yang belum dibayar dapat Anda batalkan kapan saja dari halaman Reservasi saya.</li>
              <li>Tiket yang sudah lunas tidak dapat dikembalikan dananya secara otomatis.</li>
            </ul>
          </section>

          {error && (
            <Alert tone="error" className="mt-8">
              {error}
            </Alert>
          )}
          <button className="btn-brand mt-8 w-full py-4 text-base sm:w-auto sm:px-10" disabled={busy || quote.errors.length > 0} onClick={confirm}>
            {busy ? <Spinner className="size-5" /> : quote.total ? 'Konfirmasi dan lanjut bayar' : 'Konfirmasi reservasi'}
          </button>
        </div>

        <aside className="order-first lg:order-none">
          <div className="card sticky top-28 p-6">
            <div className="flex gap-4 border-b border-line pb-6">
              <Photo src={d.photos[0]?.src} alt={d.name} className="size-28 shrink-0 rounded-xl" />
              <div className="min-w-0">
                <div className="text-xs text-muted">{categoryLabel(d.category)}</div>
                <div className="font-semibold">{d.name}</div>
                <div className="text-sm text-muted">{d.area}</div>
                <RatingInline className="mt-1" rating={d.rating} count={d.reviewCount} />
              </div>
            </div>
            <h3 className="mt-6 mb-4 text-[22px] font-semibold">Rincian harga</h3>
            <div className="space-y-3 text-[15px]">
              {quote.items.map((i) => (
                <div key={i.ticketId} className="flex justify-between">
                  <span>
                    {rupiahPlain(i.price)} × {i.qty} {i.name}
                  </span>
                  <span>{rupiahPlain(i.price * i.qty)}</span>
                </div>
              ))}
              <div className="flex justify-between">
                <span>Biaya layanan</span>
                <span>{rupiahPlain(0)}</span>
              </div>
              <div className="flex justify-between border-t border-line pt-4 font-bold">
                <span>Total (IDR)</span>
                <span>{rupiahPlain(quote.total)}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function Row({ title, value, to }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div>
        <div className="font-semibold">{title}</div>
        <div className="text-muted">{value}</div>
      </div>
      <Link to={to} className="font-semibold underline">
        Ubah
      </Link>
    </div>
  )
}
