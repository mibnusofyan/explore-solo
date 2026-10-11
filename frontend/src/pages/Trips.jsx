import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { reservations, STATUS } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { EmptyState, PageLoader, Photo, StatusBadge } from '../components/ui'
import { ReviewModal } from '../components/ReviewModal'
import { formatDate, rupiahPlain, todayISO } from '../lib/format'

const TABS = [
  { id: 'mendatang', label: 'Mendatang' },
  { id: 'selesai', label: 'Selesai' },
  { id: 'dibatalkan', label: 'Dibatalkan' },
]

function bucket(r) {
  if (r.status === STATUS.CANCELLED) return 'dibatalkan'
  if (r.status === STATUS.USED || r.date < todayISO()) return 'selesai'
  return 'mendatang'
}

/** SRS 3.7 Riwayat Reservasi. */
export default function Trips() {
  const { user } = useAuth()
  const [list, setList] = useState(null)
  const [tab, setTab] = useState('mendatang')
  const [reviewing, setReviewing] = useState(null)

  const load = useCallback(() => reservations.listMine(user).then(setList), [user])
  useEffect(() => {
    load()
  }, [load])

  if (!list) return <PageLoader />

  const shown = list.filter((r) => bucket(r) === tab)
  if (tab === 'mendatang') shown.sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div className="container-page max-w-6xl py-8 md:py-12">
      <h1 className="text-[32px] font-bold tracking-tight">Reservasi saya</h1>

      {list.length === 0 ? (
        <div className="mt-8 border-t border-line">
          <EmptyState
            icon="Ticket"
            title="Belum ada riwayat reservasi"
            action={
              <Link to="/" className="btn-dark">
                Mulai menjelajah
              </Link>
            }
          >
            Saatnya merencanakan kunjungan ke keraton, museum, dan kampung batik di Kota Solo.
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="mt-6 flex gap-2 border-b border-line">
            {TABS.map((t) => {
              const n = list.filter((r) => bucket(r) === t.id).length
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`-mb-px border-b-2 px-3 pb-3 text-[15px] font-semibold whitespace-nowrap transition ${
                    tab === t.id ? 'border-ink' : 'border-transparent text-muted hover:text-ink'
                  }`}
                >
                  {t.label} <span className="text-muted">({n})</span>
                </button>
              )
            })}
          </div>

          {shown.length === 0 ? (
            <EmptyState icon="CalendarDays" title="Tidak ada reservasi di sini" />
          ) : (
            <div className="mt-8 grid gap-6 md:grid-cols-2">
              {shown.map((r) => (
                <TripCard key={r.id} r={r} onReview={() => setReviewing(r)} />
              ))}
            </div>
          )}
        </>
      )}

      {reviewing && <ReviewModal open reservation={reviewing} onClose={() => setReviewing(null)} onSaved={load} />}
    </div>
  )
}

function TripCard({ r, onReview }) {
  const d = r.destination
  return (
    <div className="card flex overflow-hidden transition hover:shadow-card">
      <Link to={`/reservasi/${r.id}`} className="flex min-w-0 flex-1">
        <Photo src={d?.photos[0]?.src} alt={d?.name} className="w-32 shrink-0 sm:w-40" />
        <div className="min-w-0 flex-1 p-4 sm:p-5">
          <StatusBadge status={r.status} />
          <h2 className="mt-2 line-clamp-1 font-semibold">{d?.name}</h2>
          <p className="text-sm text-muted">{formatDate(r.date, { weekday: 'short' })}</p>
          <p className="text-sm text-muted">
            {r.totalQty} tiket · {r.total ? rupiahPlain(r.total) : 'Gratis'}
          </p>
          <p className="mt-1 font-mono text-xs text-muted">{r.code}</p>
        </div>
      </Link>
      {r.status === STATUS.USED && !r.review && (
        <div className="flex items-end p-4">
          <button className="btn-outline px-3 py-2 text-sm" onClick={onReview}>
            Beri ulasan
          </button>
        </div>
      )}
    </div>
  )
}
