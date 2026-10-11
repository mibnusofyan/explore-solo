import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, ChevronRight } from 'lucide-react'
import { destinations, reservations, users as usersApi, DEST_STATUS } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { categoryLabel } from '../../data/destinations'
import { Alert, Avatar, EmptyState, FieldError, Modal, PageLoader, Photo, Spinner, Stat, StatusBadge } from '../../components/ui'
import { PageTitle } from '../../components/Guards'
import { DAY_NAMES, addDays, formatDateTime, rupiah, rupiahPlain, todayISO } from '../../lib/format'

/* ------------------------------------------------------------------ */
/* Ringkasan                                                           */
/* ------------------------------------------------------------------ */

export function AdminOverview() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  useEffect(() => {
    const t = todayISO()
    Promise.all([destinations.listAll(), usersApi.list(), reservations.report(user, { from: addDays(t, -29), to: t })]).then(([d, u, rep]) =>
      setData({ d, u, rep }),
    )
  }, [user])
  if (!data) return <PageLoader />
  const pending = data.d.filter((d) => d.status === DEST_STATUS.PENDING || d.pendingChanges)
  const top = [...data.rep.rows]
    .filter((r) => r.status === 'LUNAS' || r.status === 'SUDAH_DIGUNAKAN')
    .reduce((m, r) => m.set(r.destinationId, { d: r.destination, revenue: (m.get(r.destinationId)?.revenue || 0) + r.total, tickets: (m.get(r.destinationId)?.tickets || 0) + r.totalQty }), new Map())

  return (
    <>
      <PageTitle title="Ringkasan Admin" subtitle="Kondisi seluruh destinasi dalam 30 hari terakhir" />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat label="Destinasi aktif" value={data.d.filter((d) => d.status === DEST_STATUS.ACTIVE).length} icon="Building2" />
        <Stat label="Menunggu verifikasi" value={pending.length} icon="ShieldCheck" />
        <Stat label="Pengguna terdaftar" value={data.u.length} icon="Users" hint={`${data.u.filter((u) => u.role === 'pengelola').length} pengelola`} />
        <Stat label="Pendapatan 30 hari" value={rupiahPlain(data.rep.summary.revenue)} icon="Banknote" hint={`${data.rep.summary.ticketsSold} tiket terjual`} />
      </div>

      <div className="mt-10 grid grid-cols-1 gap-10 xl:grid-cols-2">
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[22px] font-semibold">Perlu diverifikasi</h2>
            <Link to="/admin/destinasi" className="text-sm font-semibold underline">
              Lihat semua
            </Link>
          </div>
          {pending.length === 0 ? (
            <p className="rounded-2xl border border-line p-6 text-muted">Tidak ada pengajuan yang menunggu.</p>
          ) : (
            <ul className="divide-y divide-line rounded-2xl border border-line">
              {pending.map((d) => (
                <li key={d.id}>
                  <Link to={`/admin/destinasi?buka=${d.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-soft">
                    <Photo src={d.photos[0]?.src} alt="" className="size-12 shrink-0 rounded-lg" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{d.name}</div>
                      <div className="text-sm text-muted">{d.pendingChanges ? 'Perubahan data' : 'Destinasi baru'} · {d.managers.join(', ')}</div>
                    </div>
                    <ChevronRight className="size-4 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h2 className="mb-4 text-[22px] font-semibold">Destinasi terlaris</h2>
          <ol className="divide-y divide-line rounded-2xl border border-line">
            {[...top.values()]
              .sort((a, b) => b.revenue - a.revenue)
              .slice(0, 5)
              .map((x, i) => (
                <li key={x.d.id} className="flex items-center gap-4 px-5 py-3.5">
                  <span className="w-5 text-center font-bold text-muted">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{x.d.name}</span>
                  <span className="text-right text-sm">
                    <div className="font-semibold">{rupiahPlain(x.revenue)}</div>
                    <div className="text-muted">{x.tickets} tiket</div>
                  </span>
                </li>
              ))}
          </ol>
        </section>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Verifikasi destinasi (SRS 3.9 aktor Admin)                          */
/* ------------------------------------------------------------------ */

export function AdminDestinations() {
  const toast = useToast()
  const [list, setList] = useState(null)
  const [tab, setTab] = useState('menunggu')
  const [openId, setOpenId] = useState(() => new URLSearchParams(location.search).get('buka'))
  const [note, setNote] = useState('')
  const [noteErr, setNoteErr] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => destinations.listAll().then(setList), [])
  useEffect(() => {
    load()
  }, [load])

  if (!list) return <PageLoader />
  const isPending = (d) => d.status === DEST_STATUS.PENDING || !!d.pendingChanges
  const shown = list.filter((d) => (tab === 'menunggu' ? isPending(d) : true))
  const open = list.find((d) => d.id === openId)

  const decide = async (approve) => {
    if (!approve && !note.trim()) {
      setNoteErr('Tuliskan alasan penolakan agar pengelola dapat memperbaiki data.')
      return
    }
    setBusy(true)
    await destinations.verify(open.id, approve, note)
    toast(approve ? `${open.name} disetujui dan tayang` : `${open.name} ditolak`)
    setBusy(false)
    setOpenId(null)
    setNote('')
    setNoteErr('')
    load()
  }

  const toggleActive = async (d) => {
    await destinations.setActive(d.id, d.status !== DEST_STATUS.ACTIVE)
    toast(d.status === DEST_STATUS.ACTIVE ? 'Destinasi dinonaktifkan' : 'Destinasi diaktifkan')
    load()
  }

  return (
    <>
      <PageTitle title="Verifikasi destinasi" subtitle="Setujui atau tolak destinasi baru dan perubahan data dari pengelola." />
      <div className="mb-6 flex gap-2">
        {[
          ['menunggu', `Menunggu (${list.filter(isPending).length})`],
          ['semua', `Semua (${list.length})`],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${tab === id ? 'border-ink bg-ink text-white' : 'border-line hover:border-ink'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyState icon="ShieldCheck" title="Semua pengajuan sudah diproses" />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-soft text-xs tracking-wide text-muted uppercase">
              <tr>
                <th className="px-4 py-3 font-semibold">Destinasi</th>
                <th className="px-4 py-3 font-semibold">Pengelola</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Diperbarui</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Photo src={d.photos[0]?.src} alt="" className="size-11 shrink-0 rounded-lg" />
                      <div>
                        <div className="font-semibold">{d.name}</div>
                        <div className="text-xs text-muted">{categoryLabel(d.category)}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">{d.managers.join(', ') || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <StatusBadge status={d.status} />
                      {d.pendingChanges && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">Ada perubahan</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted">{formatDateTime(d.updatedAt)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {isPending(d) ? (
                      <button className="btn-dark px-4 py-2 text-sm" onClick={() => setOpenId(d.id)}>
                        Tinjau
                      </button>
                    ) : (
                      (d.status === DEST_STATUS.ACTIVE || d.status === DEST_STATUS.INACTIVE) && (
                        <button className="btn-outline px-4 py-2 text-sm" onClick={() => toggleActive(d)}>
                          {d.status === DEST_STATUS.ACTIVE ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <Modal
          open
          onClose={() => setOpenId(null)}
          title={open.pendingChanges ? 'Tinjau perubahan data' : 'Tinjau destinasi baru'}
          size="max-w-3xl"
          footer={
            <div className="space-y-3">
              <div>
                <textarea
                  rows={2}
                  className="field"
                  placeholder="Catatan untuk pengelola (wajib bila menolak)"
                  value={note}
                  aria-invalid={!!noteErr || undefined}
                  onChange={(e) => {
                    setNote(e.target.value)
                    setNoteErr('')
                  }}
                />
                <FieldError>{noteErr}</FieldError>
              </div>
              <div className="flex justify-end gap-2">
                <button className="btn-outline" disabled={busy} onClick={() => decide(false)}>
                  Tolak
                </button>
                <button className="btn-brand" disabled={busy} onClick={() => decide(true)}>
                  {busy ? <Spinner className="size-5" /> : 'Setujui & tayangkan'}
                </button>
              </div>
            </div>
          }
        >
          <DestinationReview d={open} />
        </Modal>
      )}
    </>
  )
}

function ReviewRow({ d, k, label, children }) {
  const changed = d.pendingChanges && JSON.stringify(d[k]) !== JSON.stringify(d.pendingChanges[k])
  return (
    <div className={`grid gap-1 py-3 sm:grid-cols-[160px_1fr] ${changed ? '-mx-3 rounded-lg bg-amber-50 px-3' : ''}`}>
      <dt className="text-sm font-semibold text-muted">
        {label}
        {changed && <span className="ml-1 text-xs text-amber-800">(diubah)</span>}
      </dt>
      <dd className="text-[15px]">{children}</dd>
    </div>
  )
}

function DestinationReview({ d }) {
  const next = d.pendingChanges ? { ...d, ...d.pendingChanges } : d
  return (
    <>
      {next.photos.length > 0 ? (
        <div className="no-scrollbar -mx-6 mb-4 flex gap-2 overflow-x-auto px-6">
          {next.photos.map((p, i) => (
            <Photo key={i} src={p.src} alt="" className="h-36 w-52 shrink-0 rounded-lg" />
          ))}
        </div>
      ) : (
        <Alert tone="warn" className="mb-4">
          Belum ada foto.
        </Alert>
      )}
      <dl className="divide-y divide-line">
        <ReviewRow d={d} k="name" label="Nama">{next.name}</ReviewRow>
        <ReviewRow d={d} k="category" label="Kategori">{categoryLabel(next.category)}</ReviewRow>
        <ReviewRow d={d} k="description" label="Deskripsi"><span className="whitespace-pre-line">{next.description}</span></ReviewRow>
        <ReviewRow d={d} k="address" label="Alamat">{next.address} <span className="font-mono text-xs text-muted">({next.lat}, {next.lng})</span></ReviewRow>
        <ReviewRow d={d} k="facilities" label="Fasilitas">{next.facilities.join(', ') || '-'}</ReviewRow>
        <ReviewRow d={d} k="hours" label="Jam buka">
          {next.hours.open}–{next.hours.close} WIB{next.closedDays.length > 0 && ` · tutup ${next.closedDays.map((x) => DAY_NAMES[x]).join(', ')}`}
        </ReviewRow>
        <ReviewRow d={d} k="tickets" label="Tiket">{next.tickets.map((t) => `${t.name} ${rupiah(t.price)}`).join(' · ')}</ReviewRow>
        <ReviewRow d={d} k="dailyQuota" label="Kuota harian">{next.dailyQuota}</ReviewRow>
      </dl>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Kelola pengguna (SRS 3.13)                                          */
/* ------------------------------------------------------------------ */

const ROLE_LABEL = { wisatawan: 'Wisatawan', pengelola: 'Pengelola Destinasi', admin: 'Admin' }

export function AdminUsers() {
  const { user: me } = useAuth()
  const toast = useToast()
  const [list, setList] = useState(null)
  const [dests, setDests] = useState([])
  const [q, setQ] = useState('')
  const [role, setRole] = useState('')
  const [editing, setEditing] = useState(null)

  const load = useCallback(() => Promise.all([usersApi.list(), destinations.listAll()]).then(([u, d]) => (setList(u), setDests(d))), [])
  useEffect(() => {
    load()
  }, [load])

  const shown = useMemo(
    () =>
      (list || [])
        .filter((u) => !role || u.role === role)
        .filter((u) => !q || `${u.name} ${u.email}`.toLowerCase().includes(q.toLowerCase())),
    [list, q, role],
  )
  if (!list) return <PageLoader />

  const toggle = async (u) => {
    await usersApi.setActive(u.id, !u.active)
    toast(u.active ? `Akun ${u.name} dinonaktifkan` : `Akun ${u.name} diaktifkan kembali`)
    load()
  }

  return (
    <>
      <PageTitle
        title="Kelola pengguna"
        subtitle="Buat akun Pengelola Destinasi, ubah data, dan atur status akun."
        actions={
          <button className="btn-dark py-2.5" onClick={() => setEditing({})}>
            <Plus className="size-4" /> Tambah pengguna
          </button>
        }
      />
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <Search className="absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted" />
          <input className="field pl-11" placeholder="Cari nama atau email" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <select className="field sm:w-56" value={role} onChange={(e) => setRole(e.target.value)} aria-label="Filter peran">
          <option value="">Semua peran</option>
          {Object.entries(ROLE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-soft text-xs tracking-wide text-muted uppercase">
            <tr>
              <th className="px-4 py-3 font-semibold">Pengguna</th>
              <th className="px-4 py-3 font-semibold">Peran</th>
              <th className="px-4 py-3 font-semibold">Destinasi dikelola</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {shown.map((u) => (
              <tr key={u.id} className={u.active ? '' : 'text-muted'}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar user={u} size="size-9" />
                    <div>
                      <div className="font-semibold text-ink">{u.name}</div>
                      <div className="text-xs text-muted">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">{ROLE_LABEL[u.role]}</td>
                <td className="max-w-64 px-4 py-3 text-xs">
                  {u.role === 'pengelola' ? u.destinationIds.map((id) => dests.find((d) => d.id === id)?.name).filter(Boolean).join(', ') : '-'}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${u.active ? 'text-emerald-700' : 'text-muted'}`}>
                    <span className={`size-2 rounded-full ${u.active ? 'bg-emerald-500' : 'bg-line'}`} />
                    {u.active ? 'Aktif' : 'Nonaktif'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button className="btn-ghost px-3 py-1.5 text-sm underline" onClick={() => setEditing(u)}>
                    Ubah
                  </button>
                  {u.id !== me.id && (
                    <button className="btn-ghost px-3 py-1.5 text-sm underline" onClick={() => toggle(u)}>
                      {u.active ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <p className="p-8 text-center text-muted">Tidak ada pengguna yang cocok.</p>}
      </div>

      {editing && (
        <UserForm
          initial={editing}
          dests={dests}
          isSelf={editing.id === me.id}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
        />
      )}
    </>
  )
}

function UserForm({ initial, dests, isSelf, onClose, onSaved }) {
  const toast = useToast()
  const isNew = !initial.id
  const [form, setForm] = useState({
    id: initial.id,
    name: initial.name || '',
    email: initial.email || '',
    phone: initial.phone || '',
    role: initial.role || 'pengelola',
    password: '',
    destinationIds: initial.destinationIds || [],
  })
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const save = async () => {
    setBusy(true)
    setErrors({})
    setError('')
    try {
      await usersApi.save(form)
      toast(isNew ? 'Akun dibuat' : 'Data pengguna diperbarui')
      onSaved()
    } catch (e) {
      setErrors(e.fields || {})
      setError(e.message)
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? 'Tambah pengguna' : 'Ubah pengguna'}
      footer={
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>
            Batal
          </button>
          <button className="btn-dark" disabled={busy} onClick={save}>
            {busy ? <Spinner className="size-5" /> : 'Simpan'}
          </button>
        </div>
      }
    >
      {error && (
        <Alert tone="error" className="mb-4">
          {error}
        </Alert>
      )}
      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="u-role">Peran</label>
          <select id="u-role" className="field" value={form.role} onChange={set('role')} disabled={isSelf}>
            {Object.entries(ROLE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        {[
          ['name', 'Nama lengkap', 'text'],
          ['email', 'Email', 'email'],
          ['phone', 'Nomor HP', 'tel'],
        ].map(([k, label, type]) => (
          <div key={k}>
            <label className="label" htmlFor={`u-${k}`}>{label}</label>
            <input id={`u-${k}`} type={type} className="field" value={form[k]} aria-invalid={!!errors[k] || undefined} onChange={set(k)} />
            <FieldError>{errors[k]}</FieldError>
          </div>
        ))}
        {isNew && (
          <div>
            <label className="label" htmlFor="u-pass">Password awal</label>
            <input id="u-pass" type="text" className="field font-mono" value={form.password} aria-invalid={!!errors.password || undefined} onChange={set('password')} placeholder="Minimal 8 karakter" />
            <FieldError>{errors.password}</FieldError>
            <p className="mt-1 text-xs text-muted">Sampaikan ke pengguna dan minta diganti setelah login pertama.</p>
          </div>
        )}
        {form.role === 'pengelola' && (
          <div>
            <div className="label">Destinasi yang dikelola</div>
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-line p-3">
              {dests.map((d) => (
                <label key={d.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-soft">
                  <input
                    type="checkbox"
                    className="size-4 accent-ink"
                    checked={form.destinationIds.includes(d.id)}
                    onChange={() =>
                      setForm((f) => ({
                        ...f,
                        destinationIds: f.destinationIds.includes(d.id) ? f.destinationIds.filter((x) => x !== d.id) : [...f.destinationIds, d.id],
                      }))
                    }
                  />
                  {d.name}
                </label>
              ))}
            </div>
            <FieldError>{errors.destinationIds}</FieldError>
          </div>
        )}
      </div>
    </Modal>
  )
}
