import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ScanLine, ChevronRight } from 'lucide-react'
import { destinations, reservations, reviews, STATUS } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { PageLoader, Photo, Stat, StatusBadge, Stars } from '../../components/ui'
import { PageTitle } from '../../components/Guards'
import { addDays, formatDate, rupiahPlain, todayISO } from '../../lib/format'

export default function PengelolaOverview() {
  const { user } = useAuth()
  const [data, setData] = useState(null)

  useEffect(() => {
    const today = todayISO()
    Promise.all([
      destinations.listManaged(user),
      reservations.report(user, { from: today, to: today }),
      reservations.report(user, { from: addDays(today, -29), to: today }),
      reviews.forManager(user),
    ]).then(([dests, todayRep, monthRep, revs]) => setData({ dests, todayRep, monthRep, revs, today }))
  }, [user])

  if (!data) return <PageLoader />
  const { dests, todayRep, monthRep, revs, today } = data
  const expected = todayRep.rows.filter((r) => r.status === STATUS.PAID)
  const unreplied = revs.filter((r) => !r.reply)

  return (
    <>
      <PageTitle
        title={`Halo, ${user.name.split(' ')[0]}`}
        subtitle={`Ringkasan ${formatDate(today, { weekday: 'long' })}`}
        actions={
          <Link to="/pengelola/check-in" className="btn-brand py-2.5">
            <ScanLine className="size-4" /> Verifikasi tiket
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat label="Tiket hari ini" value={todayRep.summary.ticketsSold} icon="Ticket" hint={`${todayRep.summary.visitors} sudah check-in`} />
        <Stat label="Menunggu kedatangan" value={expected.reduce((s, r) => s + r.totalQty, 0)} icon="Hourglass" hint={`${expected.length} reservasi`} />
        <Stat label="Pendapatan 30 hari" value={rupiahPlain(monthRep.summary.revenue)} icon="Banknote" />
        <Stat label="Ulasan belum dibalas" value={unreplied.length} icon="MessageSquare" />
      </div>

      <div className="mt-10 grid grid-cols-1 gap-10 xl:grid-cols-2">
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[22px] font-semibold">Kedatangan hari ini</h2>
            <Link to="/pengelola/reservasi" className="text-sm font-semibold underline">
              Semua reservasi
            </Link>
          </div>
          {todayRep.rows.length === 0 ? (
            <p className="rounded-2xl border border-line p-6 text-muted">Belum ada reservasi untuk hari ini.</p>
          ) : (
            <ul className="divide-y divide-line rounded-2xl border border-line">
              {todayRep.rows.slice(0, 6).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <div className="font-semibold">{r.contact.name}</div>
                    <div className="truncate text-sm text-muted">
                      {r.destination.name} · {r.totalQty} tiket · <span className="font-mono">{r.code}</span>
                    </div>
                  </div>
                  <StatusBadge status={r.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[22px] font-semibold">Ulasan terbaru</h2>
            <Link to="/pengelola/ulasan" className="text-sm font-semibold underline">
              Kelola ulasan
            </Link>
          </div>
          <ul className="divide-y divide-line rounded-2xl border border-line">
            {revs.slice(0, 4).map((r) => (
              <li key={r.id} className="px-5 py-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{r.user?.name}</span>
                  <Stars value={r.rating} size="size-3" />
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted">{r.comment || 'Tanpa komentar'}</p>
                <div className="mt-1 text-xs text-muted">{r.destination.name}</div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-10">
        <h2 className="mb-4 text-[22px] font-semibold">Destinasi saya</h2>
        <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {dests.map((d) => (
            <Link key={d.id} to={`/pengelola/destinasi/${d.id}`} className="card flex items-center gap-4 p-3 transition hover:shadow-card">
              <Photo src={d.photos[0]?.src} alt={d.name} className="size-16 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{d.name}</div>
                <StatusBadge status={d.pendingChanges ? 'MENUNGGU_VERIFIKASI' : d.status} className="mt-1" />
              </div>
              <ChevronRight className="size-4 text-muted" />
            </Link>
          ))}
        </div>
      </section>
    </>
  )
}
