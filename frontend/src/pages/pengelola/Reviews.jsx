import { useCallback, useEffect, useState } from 'react'
import { reviews } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { Avatar, EmptyState, PageLoader, Spinner, Stars } from '../../components/ui'
import { PageTitle } from '../../components/Guards'
import { formatDate } from '../../lib/format'

/** SRS 3.11 langkah 6–7: Pengelola melihat dan membalas ulasan. */
export default function PengelolaReviews() {
  const { user } = useAuth()
  const [list, setList] = useState(null)
  const [filter, setFilter] = useState('belum')

  const load = useCallback(() => reviews.forManager(user).then(setList), [user])
  useEffect(() => {
    load()
  }, [load])

  if (!list) return <PageLoader />
  const shown = list.filter((r) => (filter === 'belum' ? !r.reply : filter === 'sudah' ? r.reply : true))
  const avg = list.length ? list.reduce((s, r) => s + r.rating, 0) / list.length : 0

  return (
    <>
      <PageTitle title="Ulasan" subtitle={list.length ? `Rata-rata ${avg.toFixed(2).replace('.', ',')} dari ${list.length} ulasan` : undefined} />
      <div className="mb-6 flex gap-2">
        {[
          ['belum', `Belum dibalas (${list.filter((r) => !r.reply).length})`],
          ['sudah', 'Sudah dibalas'],
          ['semua', 'Semua'],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${filter === id ? 'border-ink bg-ink text-white' : 'border-line hover:border-ink'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <EmptyState icon="MessageSquare" title="Tidak ada ulasan di sini" />
      ) : (
        <div className="space-y-4">
          {shown.map((r) => (
            <ReviewRow key={r.id} r={r} onSaved={load} />
          ))}
        </div>
      )}
    </>
  )
}

function ReviewRow({ r, onSaved }) {
  const { user } = useAuth()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(r.reply?.text || '')
  const [busy, setBusy] = useState(false)

  const send = async () => {
    setBusy(true)
    try {
      await reviews.reply(user, r.id, text)
      toast('Balasan terkirim')
      setOpen(false)
      onSaved()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Avatar user={r.user} size="size-10" />
          <div>
            <div className="font-semibold">{r.user?.name}</div>
            <div className="text-xs text-muted">
              {r.destination.name} · berkunjung {formatDate(r.visitDate)}
            </div>
          </div>
        </div>
        <Stars value={r.rating} size="size-3.5" />
      </div>
      <p className="mt-3 text-[15px]">{r.comment || <span className="text-muted italic">Tanpa komentar</span>}</p>

      {r.reply && !open && (
        <div className="mt-4 rounded-xl bg-soft p-4 text-sm">
          <div className="font-semibold">Balasan Anda</div>
          <p className="mt-1 text-muted">{r.reply.text}</p>
          <button className="mt-2 text-sm font-semibold underline" onClick={() => setOpen(true)}>
            Ubah balasan
          </button>
        </div>
      )}
      {!r.reply && !open && (
        <button className="btn-outline mt-4 py-2 text-sm" onClick={() => setOpen(true)}>
          Balas ulasan
        </button>
      )}
      {open && (
        <div className="mt-4">
          <textarea rows={3} autoFocus className="field" value={text} maxLength={500} onChange={(e) => setText(e.target.value)} placeholder="Tulis balasan yang ramah dan membantu" />
          <div className="mt-2 flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setOpen(false)}>
              Batal
            </button>
            <button className="btn-dark py-2.5" disabled={busy || !text.trim()} onClick={send}>
              {busy ? <Spinner className="size-4" /> : 'Kirim balasan'}
            </button>
          </div>
        </div>
      )}
    </article>
  )
}
