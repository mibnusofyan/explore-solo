import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileSpreadsheet, FileText } from 'lucide-react'
import { reservations, destinations, STATUS } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { EmptyState, Spinner, Stat, StatusBadge } from '../../components/ui'
import { statusLabel } from '../../lib/status'
import { PageTitle } from '../../components/Guards'
import { addDays, formatDate, rupiahPlain, todayISO } from '../../lib/format'
import { useToast } from '../../context/ToastContext'

/** SRS 3.10 Kelola Reservasi dan Laporan, dipakai Pengelola (destinasinya) dan Admin (semua). */
export default function ReportPage() {
  const { user } = useAuth()
  const toast = useToast()
  const [from, setFrom] = useState(addDays(todayISO(), -30))
  const [to, setTo] = useState(addDays(todayISO(), 14))
  const [status, setStatus] = useState('')
  const [destinationId, setDestinationId] = useState('')
  const [dests, setDests] = useState([])
  const [loaded, setLoaded] = useState({ filter: null })

  useEffect(() => {
    const load = user.role === 'admin' ? destinations.listAll() : destinations.listManaged(user)
    load.then(setDests)
  }, [user])

  const filter = useMemo(() => ({ from, to, status, destinationId }), [from, to, status, destinationId])
  useEffect(() => {
    let alive = true
    reservations.report(user, filter).then((data) => alive && setLoaded({ filter, data }))
    return () => {
      alive = false
    }
  }, [user, filter])
  const data = loaded.filter === filter ? loaded.data : null
  const [downloading, setDownloading] = useState(null)

  const exportAs = async (format) => {
    setDownloading(format)
    try {
      await reservations.downloadReport(filter, format)
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setDownloading(null)
    }
  }

  const scopeName = destinationId ? dests.find((d) => d.id === destinationId)?.name : user.role === 'admin' ? 'Semua destinasi' : 'Destinasi yang saya kelola'

  return (
    <>
      <PageTitle
        title={user.role === 'admin' ? 'Laporan reservasi' : 'Reservasi & laporan'}
        subtitle={`${scopeName} · ${formatDate(from)} – ${formatDate(to)}`}
        actions={
          data?.rows.length ? (
            <div className="no-print flex gap-2">
              {['xlsx', 'pdf'].map((format) => (
                <button key={format} className="btn-outline py-2.5 text-sm" disabled={!!downloading} onClick={() => exportAs(format)}>
                  {downloading === format ? (
                    <Spinner className="size-4" />
                  ) : format === 'xlsx' ? (
                    <FileSpreadsheet className="size-4" />
                  ) : (
                    <FileText className="size-4" />
                  )}
                  Unduh {format === 'xlsx' ? 'Excel' : 'PDF'}
                </button>
              ))}
            </div>
          ) : null
        }
      />

      <div className="no-print mb-8 grid gap-3 rounded-2xl border border-line p-4 sm:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm">
          <span className="mb-1 block font-semibold">Dari tanggal</span>
          <input type="date" className="field py-2.5" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-semibold">Sampai tanggal</span>
          <input type="date" className="field py-2.5" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-semibold">Status</span>
          <select className="field py-2.5" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Semua status</option>
            {Object.values(STATUS).map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-semibold">Destinasi</span>
          <select className="field py-2.5" value={destinationId} onChange={(e) => setDestinationId(e.target.value)}>
            <option value="">Semua destinasi</option>
            {dests.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!data ? (
        <div className="flex justify-center py-20 text-muted">
          <Spinner className="size-8" />
        </div>
      ) : data.rows.length === 0 ? (
        <EmptyState icon="ClipboardList" title="Tidak ada data reservasi">
          Tidak ada reservasi pada rentang tanggal dan filter yang dipilih. Ubah filter untuk mencoba lagi.
        </EmptyState>
      ) : (
        <>
          <div className="mb-8 grid grid-cols-2 gap-4 xl:grid-cols-4">
            <Stat label="Reservasi" value={data.summary.reservations.toLocaleString('id-ID')} icon="ClipboardList" />
            <Stat label="Tiket terjual" value={data.summary.ticketsSold.toLocaleString('id-ID')} icon="Ticket" hint="Lunas + sudah digunakan" />
            <Stat label="Pengunjung hadir" value={data.summary.visitors.toLocaleString('id-ID')} icon="Users" hint="Tiket sudah check-in" />
            <Stat label="Pendapatan" value={rupiahPlain(data.summary.revenue)} icon="Banknote" />
          </div>

          <div className="overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-soft text-xs tracking-wide text-muted uppercase">
                <tr>
                  <th className="px-4 py-3 font-semibold">Kode</th>
                  <th className="px-4 py-3 font-semibold">Kunjungan</th>
                  {(user.role === 'admin' || dests.length > 1) && <th className="px-4 py-3 font-semibold">Destinasi</th>}
                  <th className="px-4 py-3 font-semibold">Pemesan</th>
                  <th className="px-4 py-3 text-right font-semibold">Tiket</th>
                  <th className="px-4 py-3 text-right font-semibold">Total</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.rows.map((r) => (
                  <tr key={r.id} className="hover:bg-soft/60">
                    <td className="px-4 py-3 font-mono text-xs">{r.code}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(r.date, { month: 'short' })}</td>
                    {(user.role === 'admin' || dests.length > 1) && <td className="px-4 py-3">{r.destination?.name}</td>}
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.contact.name}</div>
                      <div className="text-xs text-muted">{r.items.map((i) => `${i.qty} ${i.name}`).join(', ')}</div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.totalQty}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{rupiahPlain(r.total)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {user.role === 'pengelola' && (
            <p className="no-print mt-4 text-sm text-muted">
              Wisatawan datang? Verifikasi tiketnya di{' '}
              <Link to="/pengelola/check-in" className="font-semibold text-ink underline">
                halaman verifikasi tiket
              </Link>
              .
            </p>
          )}
        </>
      )}
    </>
  )
}
