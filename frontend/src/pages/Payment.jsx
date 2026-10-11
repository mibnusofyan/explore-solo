import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Copy, ShieldCheck, Hourglass, CircleX } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { reservations, STATUS } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { PAYMENT_GROUPS, ALL_METHODS, vaNumber } from '../lib/payment'
import { Alert, EmptyState, PageLoader, Photo, Spinner } from '../components/ui'
import { formatDate, rupiahPlain } from '../lib/format'

function useCountdown(target) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const left = Math.max(0, (target || 0) - now)
  const m = Math.floor(left / 60000)
  const s = Math.floor((left % 60000) / 1000)
  return { left, label: `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` }
}

/** Muat snap.js Midtrans sekali, lalu kembalikan window.snap. */
function loadSnap(src, clientKey) {
  if (window.snap) return Promise.resolve(window.snap)
  return new Promise((resolve, reject) => {
    const el = Object.assign(document.createElement('script'), { src, async: true })
    el.dataset.clientKey = clientKey
    el.onload = () => resolve(window.snap)
    el.onerror = () => reject(new Error('Halaman pembayaran Midtrans gagal dimuat. Periksa koneksi lalu coba lagi.'))
    document.head.append(el)
  })
}

/**
 * SRS 3.6 Pembayaran Reservasi. Bila server memakai Midtrans, pembayaran dibuka lewat Snap;
 * tanpa kunci Midtrans (pengembangan), halaman ini menampilkan simulasi sandbox.
 */
export default function Payment() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [r, setR] = useState(null)
  const [error, setError] = useState('')
  const [method, setMethod] = useState(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(null)
  const [session, setSession] = useState(null)
  const { left, label } = useCountdown(r?.expiresAt)

  useEffect(() => {
    reservations
      .get(user, id)
      .then(async (res) => {
        setR(res)
        if (res.status === STATUS.PENDING) setSession(await reservations.startPayment(res.id))
      })
      .catch((e) => setError(e.message))
  }, [user, id])

  useEffect(() => {
    if (r?.status === STATUS.PAID || r?.status === STATUS.USED) navigate(`/reservasi/${r.id}`, { replace: true })
  }, [r, navigate])

  if (error) return <EmptyState icon="Ticket" title="Pembayaran tidak dapat dibuka">{error}</EmptyState>
  if (!r || (r.status === STATUS.PENDING && !session)) return <PageLoader />

  const expired = r.status === STATUS.CANCELLED || left === 0
  const m = ALL_METHODS.find((x) => x.id === method)

  const pay = async (outcome) => {
    setBusy(true)
    try {
      const res = await reservations.pay(user, r.id, method, outcome)
      if (res.status === STATUS.PAID) {
        toast('Pembayaran berhasil, e-tiket terbit')
        navigate(`/reservasi/${res.id}?baru=1`, { replace: true })
      } else {
        setR(res)
        setFailed(res.cancelReason)
      }
    } catch (e) {
      setFailed(e.message)
      const fresh = await reservations.get(user, r.id)
      setR(fresh)
    } finally {
      setBusy(false)
    }
  }

  const afterSnap = async () => {
    setBusy(true)
    try {
      const res = await reservations.syncPayment(r.id)
      if (res.status === STATUS.PAID) {
        toast('Pembayaran berhasil, e-tiket terbit')
        navigate(`/reservasi/${res.id}?baru=1`, { replace: true })
      } else if (res.status === STATUS.CANCELLED) {
        setR(res)
        setFailed(res.cancelReason)
      } else {
        setR(res)
      }
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const openSnap = async () => {
    try {
      const snap = await loadSnap(session.snapUrl, session.clientKey)
      snap.pay(session.token, { onSuccess: afterSnap, onPending: afterSnap, onError: afterSnap, onClose: afterSnap })
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  if (failed || expired)
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-brand-50">
          <CircleX className="size-8 text-brand-600" />
        </div>
        <h1 className="text-2xl font-bold">Pembayaran gagal</h1>
        <p className="mt-2 text-muted">
          {failed || r.cancelReason || 'Batas waktu pembayaran terlewati.'} Reservasi <b>{r.code}</b> dibatalkan dan kuota telah dikembalikan.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link to={`/destinasi/${r.destination.slug}?tanggal=${r.date}`} className="btn-brand">
            Reservasi ulang
          </Link>
          <Link to="/reservasi" className="btn-outline">
            Lihat reservasi saya
          </Link>
        </div>
      </div>
    )

  return (
    <div className="mx-auto max-w-[1040px] px-4 py-8 sm:px-6 md:py-12">
      <div className="mb-8 flex items-center gap-2">
        <Link to={`/reservasi/${r.id}`} className="-ml-3 rounded-full p-2 hover:bg-soft" aria-label="Kembali">
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="text-2xl font-bold tracking-tight md:text-[32px]">Pembayaran</h1>
      </div>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">
          <div className="mb-6 flex items-center justify-between gap-4 rounded-xl bg-amber-50 px-5 py-4 text-amber-900 ring-1 ring-amber-200">
            <span className="flex items-center gap-2 text-sm">
              <Hourglass className="size-4" /> Selesaikan pembayaran sebelum kuota dilepas
            </span>
            <span className="font-mono text-lg font-bold tabular-nums" aria-live="off">
              {label}
            </span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-line">
            <div className="flex items-center justify-between bg-ink px-5 py-3 text-sm text-white">
              <span className="font-semibold">{session?.mode === 'midtrans' ? 'Midtrans' : 'Simulasi pembayaran · Sandbox'}</span>
              <span className="flex items-center gap-1 text-xs opacity-80">
                <ShieldCheck className="size-3.5" /> Transaksi terenkripsi
              </span>
            </div>

            {session?.mode === 'midtrans' ? (
              <div className="p-6">
                <p className="text-[15px] text-muted">
                  Pilih virtual account, QRIS, atau dompet digital di jendela pembayaran Midtrans. Status reservasi diperbarui otomatis
                  setelah pembayaran dikonfirmasi.
                </p>
                <button className="btn-brand mt-6 w-full py-3.5" disabled={busy} onClick={openSnap}>
                  {busy ? <Spinner className="size-5" /> : `Bayar ${rupiahPlain(r.total)}`}
                </button>
                <button className="mt-3 w-full text-center text-sm text-muted underline" disabled={busy} onClick={afterSnap}>
                  Saya sudah membayar, perbarui status
                </button>
              </div>
            ) : !m ? (
              <div className="divide-y divide-line">
                {PAYMENT_GROUPS.map((g) => (
                  <div key={g.id} className="px-5 py-4">
                    <div className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">{g.label}</div>
                    {g.methods.map((x) => (
                      <button
                        key={x.id}
                        onClick={() => setMethod(x.id)}
                        className="-mx-2 flex w-[calc(100%+16px)] items-center gap-4 rounded-lg px-2 py-3 text-left hover:bg-soft"
                      >
                        <MethodBadge m={x} />
                        <span className="flex-1 font-medium">{x.label}</span>
                        <ChevronRight className="size-4 text-muted" />
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6">
                <button onClick={() => setMethod(null)} className="mb-4 flex items-center gap-1 text-sm font-semibold underline">
                  <ChevronLeft className="size-4" /> Ganti metode
                </button>
                <div className="flex items-center gap-3">
                  <MethodBadge m={m} />
                  <h2 className="text-lg font-semibold">{m.label}</h2>
                </div>
                <Instructions m={m} r={r} />
                <button className="btn-brand mt-8 w-full py-3.5" disabled={busy} onClick={() => pay('success')}>
                  {busy ? <Spinner className="size-5" /> : `Saya sudah membayar ${rupiahPlain(r.total)}`}
                </button>
                <button className="mt-3 w-full text-center text-sm text-muted underline" disabled={busy} onClick={() => pay('failure')}>
                  Simulasikan pembayaran ditolak
                </button>
              </div>
            )}
          </div>
          {session?.mode === 'simulation' && (
            <Alert tone="info" className="mt-6">
              Mode simulasi: server belum memakai kunci Midtrans, jadi tidak ada dana yang ditarik. Isi MIDTRANS_SERVER_KEY dan
              MIDTRANS_CLIENT_KEY di backend untuk memakai Midtrans Snap sandbox.
            </Alert>
          )}
        </div>

        <aside>
          <div className="card sticky top-28 p-6">
            <div className="flex gap-4">
              <Photo src={r.destination.photos[0]?.src} alt={r.destination.name} className="size-20 shrink-0 rounded-xl" />
              <div>
                <div className="font-semibold">{r.destination.name}</div>
                <div className="text-sm text-muted">{formatDate(r.date, { weekday: 'long' })}</div>
                <div className="mt-1 font-mono text-xs text-muted">Kode booking {r.code}</div>
              </div>
            </div>
            <div className="mt-6 space-y-2 border-t border-line pt-4 text-[15px]">
              {r.items.map((i) => (
                <div key={i.ticketId} className="flex justify-between">
                  <span>
                    {i.qty} × {i.name}
                  </span>
                  <span>{rupiahPlain(i.qty * i.price)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-line pt-3 text-lg font-bold">
                <span>Total</span>
                <span>{rupiahPlain(r.total)}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function MethodBadge({ m }) {
  return (
    <span
      className="flex h-8 w-12 shrink-0 items-center justify-center rounded-md text-[10px] font-extrabold text-white"
      style={{ background: m.color }}
      aria-hidden
    >
      {m.short}
    </span>
  )
}

function Instructions({ m, r }) {
  const toast = useToast()
  if (m.group === 'va') {
    const va = vaNumber(m.id, r.code)
    return (
      <div className="mt-6">
        <div className="text-sm text-muted">Nomor virtual account</div>
        <div className="mt-1 flex items-center gap-3">
          <span className="font-mono text-2xl font-bold tracking-wider">{va}</span>
          <button
            className="rounded-lg p-2 hover:bg-soft"
            aria-label="Salin nomor VA"
            onClick={() => navigator.clipboard?.writeText(va).then(() => toast('Nomor VA disalin'))}
          >
            <Copy className="size-4" />
          </button>
        </div>
        <ol className="mt-5 list-decimal space-y-1.5 pl-5 text-sm text-muted">
          <li>Buka aplikasi m-banking atau ATM {m.short}.</li>
          <li>Pilih menu Transfer → Virtual Account.</li>
          <li>Masukkan nomor di atas dan pastikan nama tagihan “Explore Solo”.</li>
          <li>Konfirmasi pembayaran sebesar {rupiahPlain(r.total)}.</li>
        </ol>
      </div>
    )
  }
  return (
    <div className="mt-6 flex flex-col items-center text-center">
      <div className="rounded-2xl border border-line p-4">
        <QRCodeSVG value={`MIDTRANS-SANDBOX|${m.id}|${r.code}|${r.total}`} size={200} />
      </div>
      <p className="mt-4 text-sm text-muted">
        Pindai dengan {m.group === 'qris' ? 'aplikasi e-wallet atau m-banking apa pun' : `aplikasi ${m.label}`} untuk membayar {rupiahPlain(r.total)}.
      </p>
    </div>
  )
}
