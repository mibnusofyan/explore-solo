import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ChevronLeft, Download, MapPin, Clock, CircleCheck, Mail } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { reservations, STATUS } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { methodLabel } from '../lib/payment'
import { Alert, EmptyState, Modal, PageLoader, Photo, Stars, StatusBadge } from '../components/ui'
import { ReviewModal } from '../components/ReviewModal'
import { formatDate, formatDateTime, rupiahPlain } from '../lib/format'

/** SRS 3.7: detail reservasi + e-tiket QR + unduh PDF + batalkan bila belum dibayar. */
export default function TicketDetail() {
  const { id } = useParams()
  const [sp] = useSearchParams()
  const { user } = useAuth()
  const toast = useToast()
  const [r, setR] = useState(null)
  const [error, setError] = useState('')
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)

  const load = useCallback(
    () =>
      reservations
        .get(user, id)
        .then(setR)
        .catch((e) => setError(e.message)),
    [user, id],
  )
  useEffect(() => {
    load()
  }, [load])

  if (error)
    return (
      <EmptyState icon="Ticket" title="Reservasi tidak ditemukan" action={<Link to="/reservasi" className="btn-dark">Reservasi saya</Link>}>
        {error}
      </EmptyState>
    )
  if (!r) return <PageLoader />

  const d = r.destination
  const hasTicket = r.status === STATUS.PAID || r.status === STATUS.USED

  const cancel = async () => {
    try {
      setR(await reservations.cancel(user, r.id))
      toast('Reservasi dibatalkan, kuota dikembalikan')
    } catch (e) {
      toast(e.message, 'error')
    }
    setConfirmCancel(false)
  }

  const download = () => {
    const prev = document.title
    document.title = `E-Tiket ${r.code}`
    window.print()
    document.title = prev
  }

  return (
    <div className="mx-auto max-w-[1040px] px-4 py-8 sm:px-6 md:py-12">
      <div className="no-print mb-6 flex items-center gap-2">
        <Link to="/reservasi" className="-ml-3 rounded-full p-2 hover:bg-soft" aria-label="Kembali">
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="text-2xl font-bold tracking-tight md:text-[32px]">{hasTicket ? 'E-tiket Anda' : 'Detail reservasi'}</h1>
      </div>

      {sp.get('baru') && hasTicket && (
        <Alert tone="success" className="no-print mb-6">
          <b>Pembayaran berhasil!</b> E-tiket juga telah dikirim ke <b>{r.contact.email}</b>. Tunjukkan kode QR ini kepada petugas saat berkunjung.
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Tiket (ikut tercetak sebagai PDF) */}
        <article className="overflow-hidden rounded-3xl border border-line bg-white shadow-card print:shadow-none">
          <div className="relative">
            <Photo src={d.photos[0]?.src} alt={d.name} className="aspect-[5/2] w-full print:hidden" />
            <div className="absolute inset-0 bg-linear-to-t from-black/70 to-transparent print:hidden" />
            <div className="absolute inset-x-0 bottom-0 p-6 text-white print:static print:p-6 print:text-ink">
              <div className="text-xs font-semibold tracking-widest uppercase opacity-90">Explore Solo · E-Tiket</div>
              <h2 className="mt-1 text-2xl font-bold">{d.name}</h2>
            </div>
          </div>

          <div className="grid gap-6 p-6 sm:grid-cols-[1fr_auto]">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-[15px]">
              <Info label="Tanggal kunjungan" value={formatDate(r.date, { weekday: 'long' })} wide />
              <Info label="Kode booking" value={<span className="font-mono text-lg font-bold">{r.code}</span>} />
              <Info label="Status" value={<StatusBadge status={r.status} />} />
              <Info label="Nama pemesan" value={r.contact.name} />
              <Info label="Jam buka" value={`${d.hours.open}–${d.hours.close} WIB`} />
              <Info label="Tiket" value={r.items.map((i) => `${i.qty} × ${i.name}`).join(', ')} wide />
            </dl>
            {hasTicket ? (
              <div className="flex flex-col items-center justify-center">
                <div className={`rounded-2xl border border-line p-3 ${r.status === STATUS.USED ? 'opacity-30' : ''}`}>
                  <QRCodeSVG value={r.code} size={156} marginSize={1} />
                </div>
                <span className="mt-2 text-xs text-muted">
                  {r.status === STATUS.USED ? `Digunakan ${formatDateTime(r.checkedInAt)}` : 'Pindai saat masuk'}
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-center rounded-2xl bg-soft p-6 text-center text-sm text-muted sm:w-48">
                {r.status === STATUS.PENDING ? 'Kode QR terbit setelah pembayaran lunas' : 'Reservasi dibatalkan'}
              </div>
            )}
          </div>

          <div className="mx-6 border-t-2 border-dashed border-line" />
          <div className="space-y-2 p-6 text-sm text-muted">
            <p className="flex gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0" /> {d.address}
            </p>
            <p className="flex gap-2">
              <Clock className="mt-0.5 size-4 shrink-0" /> Tiket hanya berlaku pada tanggal kunjungan dan untuk satu kali masuk.
            </p>
          </div>
        </article>

        <aside className="no-print space-y-4">
          {r.status === STATUS.PENDING && (
            <div className="card p-6">
              <h3 className="font-semibold">Menunggu pembayaran</h3>
              <p className="mt-1 text-sm text-muted">Bayar sebelum {formatDateTime(r.expiresAt)} agar kuota tidak dilepas.</p>
              <Link to={`/pembayaran/${r.id}`} className="btn-brand mt-4 w-full">
                Bayar {rupiahPlain(r.total)}
              </Link>
              <button className="btn-ghost mt-2 w-full underline" onClick={() => setConfirmCancel(true)}>
                Batalkan reservasi
              </button>
            </div>
          )}

          {hasTicket && (
            <div className="card p-6">
              <button className="btn-dark w-full" onClick={download}>
                <Download className="size-4" /> Unduh e-tiket (PDF)
              </button>
              <p className="mt-3 flex items-center gap-2 text-xs text-muted">
                <Mail className="size-3.5" /> Salinan dikirim ke {r.contact.email}
              </p>
            </div>
          )}

          {r.status === STATUS.USED && (
            <div className="card p-6">
              {r.review ? (
                <>
                  <h3 className="flex items-center gap-2 font-semibold">
                    <CircleCheck className="size-4 text-emerald-600" /> Ulasan Anda
                  </h3>
                  <Stars value={r.review.rating} size="size-4" />
                  {r.review.comment && <p className="mt-2 text-sm">{r.review.comment}</p>}
                  {r.review.reply && (
                    <div className="mt-3 border-l-2 border-line pl-3 text-sm text-muted">
                      <b className="text-ink">Balasan pengelola:</b> {r.review.reply.text}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <h3 className="font-semibold">Bagaimana kunjungan Anda?</h3>
                  <p className="mt-1 text-sm text-muted">Ulasan membantu wisatawan lain dan pengelola destinasi.</p>
                  <button className="btn-outline mt-4 w-full" onClick={() => setReviewOpen(true)}>
                    Beri rating & ulasan
                  </button>
                </>
              )}
            </div>
          )}

          <div className="card p-6 text-[15px]">
            <h3 className="mb-3 font-semibold">Rincian pembayaran</h3>
            {r.items.map((i) => (
              <div key={i.ticketId} className="flex justify-between py-1">
                <span>
                  {i.qty} × {i.name}
                </span>
                <span>{rupiahPlain(i.qty * i.price)}</span>
              </div>
            ))}
            <div className="mt-2 flex justify-between border-t border-line pt-3 font-bold">
              <span>Total</span>
              <span>{rupiahPlain(r.total)}</span>
            </div>
            {r.payment?.paidAt && (
              <p className="mt-3 text-xs text-muted">
                Dibayar {formatDateTime(r.payment.paidAt)} · {methodLabel(r.payment.method)}
              </p>
            )}
            {r.status === STATUS.CANCELLED && <p className="mt-3 text-xs text-muted">Alasan: {r.cancelReason}</p>}
          </div>

          <Link to={`/destinasi/${d.slug}`} className="block text-center text-sm font-semibold underline">
            Lihat halaman destinasi
          </Link>
        </aside>
      </div>

      <Modal
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title="Batalkan reservasi?"
        footer={
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setConfirmCancel(false)}>
              Kembali
            </button>
            <button className="btn-dark" onClick={cancel}>
              Ya, batalkan
            </button>
          </div>
        }
      >
        Reservasi <b>{r.code}</b> akan dibatalkan dan {r.totalQty} kuota dikembalikan. Tindakan ini tidak dapat diurungkan.
      </Modal>
      {reviewOpen && <ReviewModal open reservation={r} onClose={() => setReviewOpen(false)} onSaved={load} />}
    </div>
  )
}

function Info({ label, value, wide }) {
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  )
}
