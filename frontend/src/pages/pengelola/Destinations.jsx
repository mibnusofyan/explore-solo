import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Plus, Trash2, Upload, ImagePlus, ExternalLink } from 'lucide-react'
import { destinations, DEST_STATUS, ApiError } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { CATEGORIES, FACILITIES, categoryLabel } from '../../data/destinations'
import { LocationMap } from '../../components/MapView'
import { Alert, EmptyState, FieldError, PageLoader, Photo, RatingInline, Spinner, StatusBadge } from '../../components/ui'
import { PageTitle } from '../../components/Guards'
import { DAY_NAMES, formatDate, rupiah, todayISO } from '../../lib/format'

export function DestinationList() {
  const { user } = useAuth()
  const [list, setList] = useState(null)
  useEffect(() => {
    destinations.listManaged(user).then(setList)
  }, [user])
  if (!list) return <PageLoader />

  return (
    <>
      <PageTitle
        title="Destinasi saya"
        subtitle="Perubahan data tampil di halaman publik setelah diverifikasi Admin."
        actions={
          <Link to="/pengelola/destinasi/baru" className="btn-dark py-2.5">
            <Plus className="size-4" /> Tambah destinasi
          </Link>
        }
      />
      {list.length === 0 ? (
        <EmptyState icon="Building2" title="Belum ada destinasi">
          Tambahkan destinasi pertama Anda untuk mulai menerima reservasi.
        </EmptyState>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 2xl:grid-cols-3">
          {list.map((d) => (
            <Link key={d.id} to={`/pengelola/destinasi/${d.id}`} className="group block">
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl">
                <Photo src={d.photos[0]?.src} alt={d.name} className="size-full transition group-hover:scale-[1.03]" />
                <div className="absolute top-3 left-3 flex flex-wrap gap-1">
                  <StatusBadge status={d.status} />
                  {d.pendingChanges && <StatusBadge status="MENUNGGU_VERIFIKASI" />}
                </div>
              </div>
              <div className="mt-3 flex justify-between gap-2">
                <h3 className="font-semibold">{d.name}</h3>
                <RatingInline rating={d.rating} count={d.reviewCount} />
              </div>
              <p className="text-sm text-muted">
                {categoryLabel(d.category)} · kuota {d.dailyQuota}/hari · mulai {rupiah(d.minPrice)}
              </p>
              {d.reviewNote && <p className="mt-1 line-clamp-2 text-sm text-brand-700">Catatan admin: {d.reviewNote}</p>}
            </Link>
          ))}
        </div>
      )}
    </>
  )
}

const EMPTY = {
  name: '',
  category: '',
  area: '',
  short: '',
  description: '',
  address: '',
  lat: null,
  lng: null,
  photos: [],
  facilities: [],
  hours: { open: '08:00', close: '16:00' },
  closedDays: [],
  holidays: [],
  tickets: [{ id: '', name: 'Dewasa', price: 0, desc: 'Usia 13 tahun ke atas' }],
  dailyQuota: 200,
}

/** SRS 3.9 Kelola Data Destinasi (form tambah/ubah). */
export function DestinationForm() {
  const { id } = useParams()
  const isNew = !id || id === 'baru'
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const fileRef = useRef(null)
  const [orig, setOrig] = useState(null)
  const [form, setForm] = useState(isNew ? EMPTY : null)
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [holiday, setHoliday] = useState('')
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (isNew) return
    destinations
      .getManaged(user, id)
      .then((d) => {
        setOrig(d)
        setForm(structuredClone(d.pendingChanges ? { ...d, ...d.pendingChanges } : d))
      })
      .catch((e) => setError(e.message))
  }, [user, id, isNew])

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const pick = useCallback((lat, lng) => setForm((f) => ({ ...f, lat, lng })), [])

  if (error && !form) return <EmptyState icon="Building2" title="Destinasi tidak ditemukan">{error}</EmptyState>
  if (!form) return <PageLoader />

  const addPhotos = async (e) => {
    const files = [...(e.target.files || [])]
    e.target.value = ''
    const bad = files.find((f) => !/^image\/(jpeg|png|webp)$/.test(f.type) || f.size > 5 * 1024 * 1024)
    if (bad) {
      setErrors((x) => ({ ...x, photos: `“${bad.name}” ditolak: format harus JPG/PNG/WebP dan ukuran maksimal 5 MB.` }))
      return
    }
    setErrors((x) => ({ ...x, photos: undefined }))
    setUploading(true)
    try {
      for (const f of files.slice(0, 8 - form.photos.length)) {
        const photo = await destinations.uploadPhoto(f)
        setForm((x) => ({ ...x, photos: [...x.photos, photo] }))
      }
    } catch (err) {
      setErrors((x) => ({ ...x, photos: err.message }))
    } finally {
      setUploading(false)
    }
  }

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    setErrors({})
    setError('')
    try {
      const saved = await destinations.save(user, { ...form, id: isNew ? undefined : id })
      toast('Tersimpan. Menunggu verifikasi Admin.')
      if (isNew) navigate(`/pengelola/destinasi/${saved.id}`, { replace: true })
      else setOrig(saved)
    } catch (err) {
      setErrors(err.fields || {})
      setError(err instanceof ApiError ? err.message : 'Gagal menyimpan. Coba lagi.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setBusy(false)
    }
  }

  const ticket = (i, k, v) => set('tickets', form.tickets.map((t, j) => (j === i ? { ...t, [k]: v } : t)))
  const toggle = (k, v) => set(k, form[k].includes(v) ? form[k].filter((x) => x !== v) : [...form[k], v])

  return (
    <form onSubmit={save} noValidate>
      <PageTitle
        title={isNew ? 'Tambah destinasi' : form.name}
        subtitle={isNew ? 'Destinasi baru tampil setelah disetujui Admin.' : 'Ubah informasi, tiket, jam operasional, dan kuota.'}
        actions={
          orig?.status === DEST_STATUS.ACTIVE && (
            <Link to={`/destinasi/${orig.slug}`} target="_blank" className="btn-outline py-2.5 text-sm">
              <ExternalLink className="size-4" /> Lihat halaman publik
            </Link>
          )
        }
      />

      <div className="mb-6 space-y-3">
        {orig?.status === DEST_STATUS.PENDING && <Alert tone="warn">Destinasi ini menunggu verifikasi Admin dan belum tampil di halaman publik.</Alert>}
        {orig?.pendingChanges && <Alert tone="warn">Ada perubahan yang menunggu verifikasi Admin. Halaman publik masih memakai data sebelumnya.</Alert>}
        {orig?.reviewNote && (
          <Alert tone="error">
            <b>{orig.status === DEST_STATUS.REJECTED ? 'Ditolak Admin.' : 'Perubahan terakhir ditolak.'}</b> Catatan: {orig.reviewNote}
          </Alert>
        )}
        {error && <Alert tone="error">{error}</Alert>}
      </div>

      <div className="space-y-10">
        <Section title="Informasi umum">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nama destinasi" error={errors.name} className="sm:col-span-2">
              <input className="field" value={form.name} aria-invalid={!!errors.name || undefined} onChange={(e) => set('name', e.target.value)} />
            </Field>
            <Field label="Kategori" error={errors.category}>
              <select className="field" value={form.category} aria-invalid={!!errors.category || undefined} onChange={(e) => set('category', e.target.value)}>
                <option value="">Pilih kategori</option>
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Kawasan / kecamatan">
              <input className="field" value={form.area} placeholder="mis. Baluwarti, Pasar Kliwon" onChange={(e) => set('area', e.target.value)} />
            </Field>
            <Field label="Ringkasan singkat" className="sm:col-span-2">
              <input className="field" maxLength={100} value={form.short} placeholder="Satu kalimat yang tampil di bawah judul" onChange={(e) => set('short', e.target.value)} />
            </Field>
            <Field label="Deskripsi" error={errors.description} className="sm:col-span-2">
              <textarea rows={6} className="field" value={form.description} aria-invalid={!!errors.description || undefined} onChange={(e) => set('description', e.target.value)} />
            </Field>
          </div>
        </Section>

        <Section title="Foto" hint="JPG, PNG, atau WebP, maksimal 5 MB per foto, hingga 8 foto. Foto pertama menjadi sampul.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {form.photos.map((p, i) => (
              <div key={p.src.slice(-40) + i} className="group relative aspect-square overflow-hidden rounded-xl">
                <Photo src={p.src} alt={`Foto ${i + 1}`} className="size-full" />
                {i === 0 && <span className="absolute top-2 left-2 rounded-full bg-white px-2 py-0.5 text-xs font-semibold shadow-pill">Sampul</span>}
                <button
                  type="button"
                  onClick={() => set('photos', form.photos.filter((_, j) => j !== i))}
                  className="absolute top-2 right-2 rounded-full bg-white p-1.5 shadow-pill hover:bg-soft"
                  aria-label="Hapus foto"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
            {form.photos.length < 8 && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line text-sm text-muted transition hover:border-ink hover:text-ink"
              >
                {uploading ? <Spinner className="size-6" /> : <ImagePlus className="size-6" />}
                {uploading ? 'Mengunggah…' : 'Tambah foto'}
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" onChange={addPhotos} />
          <FieldError>{errors.photos}</FieldError>
        </Section>

        <Section title="Lokasi" hint="Klik pada peta untuk menentukan titik koordinat.">
          <Field label="Alamat lengkap" error={errors.address}>
            <input className="field" value={form.address} aria-invalid={!!errors.address || undefined} onChange={(e) => set('address', e.target.value)} />
          </Field>
          <LocationMap lat={form.lat} lng={form.lng} onPick={pick} className="mt-4 h-80 w-full cursor-crosshair rounded-xl" />
          <p className="mt-2 font-mono text-xs text-muted">{form.lat ? `${form.lat}, ${form.lng}` : 'Belum ada titik lokasi'}</p>
          <FieldError>{errors.location}</FieldError>
        </Section>

        <Section title="Fasilitas">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {FACILITIES.map((f) => (
              <label key={f} className="flex cursor-pointer items-center gap-3 text-[15px]">
                <input type="checkbox" className="size-5 accent-ink" checked={form.facilities.includes(f)} onChange={() => toggle('facilities', f)} />
                {f}
              </label>
            ))}
          </div>
        </Section>

        <Section title="Jam operasional & hari libur">
          <div className="grid max-w-md grid-cols-2 gap-4">
            <Field label="Jam buka">
              <input type="time" className="field" value={form.hours.open} onChange={(e) => set('hours', { ...form.hours, open: e.target.value })} />
            </Field>
            <Field label="Jam tutup">
              <input type="time" className="field" value={form.hours.close} onChange={(e) => set('hours', { ...form.hours, close: e.target.value })} />
            </Field>
          </div>
          <FieldError>{errors.hours}</FieldError>
          <div className="mt-6">
            <div className="label">Tutup setiap</div>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                <button
                  type="button"
                  key={day}
                  onClick={() => toggle('closedDays', day)}
                  aria-pressed={form.closedDays.includes(day)}
                  className={`rounded-full border px-4 py-2 text-sm transition ${form.closedDays.includes(day) ? 'border-ink bg-ink text-white' : 'border-line hover:border-ink'}`}
                >
                  {DAY_NAMES[day]}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-6">
            <div className="label">Libur khusus</div>
            <div className="flex gap-2">
              <input type="date" min={todayISO()} className="field max-w-xs" value={holiday} onChange={(e) => setHoliday(e.target.value)} />
              <button
                type="button"
                className="btn-outline shrink-0"
                disabled={!holiday || form.holidays.includes(holiday)}
                onClick={() => {
                  set('holidays', [...form.holidays, holiday].sort())
                  setHoliday('')
                }}
              >
                Tambah
              </button>
            </div>
            {form.holidays.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {form.holidays.map((h) => (
                  <span key={h} className="inline-flex items-center gap-2 rounded-full bg-soft px-3 py-1.5 text-sm">
                    {formatDate(h)}
                    <button type="button" onClick={() => set('holidays', form.holidays.filter((x) => x !== h))} aria-label="Hapus tanggal libur">
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </Section>

        <Section title="Jenis tiket & kuota">
          <div className="space-y-3">
            {form.tickets.map((t, i) => (
              <div key={i} className="grid gap-3 rounded-xl border border-line p-4 sm:grid-cols-[1fr_160px_1.4fr_auto] sm:items-end">
                <Field label="Nama tiket">
                  <input className="field" value={t.name} onChange={(e) => ticket(i, 'name', e.target.value)} />
                </Field>
                <Field label="Harga (Rp)">
                  <input type="number" min={0} step={1000} className="field" value={t.price} onChange={(e) => ticket(i, 'price', e.target.value === '' ? '' : +e.target.value)} />
                </Field>
                <Field label="Keterangan">
                  <input className="field" value={t.desc} onChange={(e) => ticket(i, 'desc', e.target.value)} />
                </Field>
                <button
                  type="button"
                  disabled={form.tickets.length === 1}
                  onClick={() => set('tickets', form.tickets.filter((_, j) => j !== i))}
                  className="rounded-lg p-3 text-muted hover:bg-soft hover:text-ink disabled:opacity-30"
                  aria-label="Hapus jenis tiket"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
          <FieldError>{errors.tickets}</FieldError>
          <button
            type="button"
            className="btn-ghost mt-3 font-semibold underline"
            onClick={() => set('tickets', [...form.tickets, { id: '', name: '', price: 0, desc: '' }])}
          >
            <Plus className="size-4" /> Tambah jenis tiket
          </button>
          <div className="mt-6 max-w-xs">
            <Field label="Kuota kunjungan harian" error={errors.dailyQuota}>
              <input type="number" min={1} className="field" value={form.dailyQuota} aria-invalid={!!errors.dailyQuota || undefined} onChange={(e) => set('dailyQuota', e.target.value)} />
            </Field>
          </div>
        </Section>
      </div>

      <div className="no-print sticky bottom-0 z-20 -mx-4 mt-10 flex items-center justify-end gap-3 border-t border-line bg-white px-4 py-4">
        <Link to="/pengelola/destinasi" className="btn-ghost underline">
          Batal
        </Link>
        <button className="btn-dark" disabled={busy || uploading}>
          {busy ? <Spinner className="size-5" /> : <Upload className="size-4" />}
          Simpan & ajukan verifikasi
        </button>
      </div>
    </form>
  )
}

function Section({ title, hint, children }) {
  return (
    <section className="border-b border-line pb-10">
      <h2 className="text-[22px] font-semibold">{title}</h2>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      <div className="mt-5">{children}</div>
    </section>
  )
}

function Field({ label, error, className = '', children }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
      <FieldError>{error}</FieldError>
    </label>
  )
}
