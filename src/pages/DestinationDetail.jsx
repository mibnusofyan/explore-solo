import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Share, Grid2x2, Star, Clock, Ticket, Users, MapPin, ChevronLeft } from 'lucide-react'
import { destinations, reviews as reviewsApi, ApiError } from '../services/api'
import { categoryLabel } from '../data/destinations'
import { BookingCard } from '../components/BookingCard'
import { Avatar, EmptyState, Icon, Modal, PageLoader, Photo, RatingInline, Stars } from '../components/ui'
import { DAY_NAMES, formatDate, rupiah } from '../lib/format'
import { useToast } from '../context/ToastContext'

const LocationMap = lazy(() => import('../components/MapView').then((m) => ({ default: m.LocationMap })))

const FACILITY_ICONS = {
  Parkir: 'Car',
  Toilet: 'Bath',
  Mushola: 'MoonStar',
  'Pemandu wisata': 'UserRound',
  Kantin: 'Coffee',
  'Akses kursi roda': 'Accessibility',
  'Area foto': 'Camera',
  'Toko suvenir': 'Gift',
  'Wi-Fi': 'Wifi',
  Loker: 'Lock',
  'Ruang menyusui': 'Baby',
  P3K: 'Cross',
}

export default function DestinationDetail() {
  const { slug } = useParams()
  const [sp] = useSearchParams()
  const toast = useToast()
  // Data disimpan bersama slug-nya; saat slug berganti, halaman otomatis kembali ke status memuat.
  const [loaded, setLoaded] = useState({ slug: null })
  const [gallery, setGallery] = useState(false)
  const [allReviews, setAllReviews] = useState(false)
  const [descOpen, setDescOpen] = useState(false)
  const [mobileBook, setMobileBook] = useState(false)

  useEffect(() => {
    let alive = true
    destinations
      .get(slug)
      .then(async (x) => {
        const reviewList = await reviewsApi.forDestination(x.id)
        if (!alive) return
        document.title = `${x.name} · Explore Solo`
        setLoaded({ slug, d: x, reviewList })
      })
      .catch((e) => alive && setLoaded({ slug, error: e instanceof ApiError ? e.message : 'Terjadi kesalahan.' }))
    return () => {
      alive = false
    }
  }, [slug])

  const current = loaded.slug === slug ? loaded : {}
  const { d, error, reviewList = [] } = current

  if (error)
    return (
      <EmptyState
        icon="Building2"
        title="Destinasi tidak tersedia"
        action={
          <Link to="/" className="btn-dark">
            Kembali ke daftar destinasi
          </Link>
        }
      >
        {error}
      </EmptyState>
    )
  if (!d) return <PageLoader />

  const share = async () => {
    const url = location.href
    try {
      if (navigator.share) await navigator.share({ title: d.name, url })
      else {
        await navigator.clipboard.writeText(url)
        toast('Tautan disalin')
      }
    } catch {
      // Pengguna membatalkan dialog berbagi.
    }
  }

  return (
    <div className="mx-auto max-w-[1120px] px-4 pb-28 sm:px-6 md:px-10 lg:pb-0">
      <div className="flex items-center justify-between pt-4 md:pt-6">
        <Link to="/" className="-ml-2 flex items-center gap-1 rounded-full p-2 text-sm font-semibold hover:bg-soft md:hidden" aria-label="Kembali">
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="hidden text-[26px] font-bold tracking-tight md:block">{d.name}</h1>
        <button onClick={share} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold underline hover:bg-soft">
          <Share className="size-4" /> Bagikan
        </button>
      </div>

      <Mosaic photos={d.photos} name={d.name} onOpen={() => setGallery(true)} />

      <div className="grid grid-cols-1 gap-12 pt-8 lg:grid-cols-[minmax(0,1fr)_370px] lg:gap-24">
        <div className="min-w-0">
          <section className="border-b border-line pb-6">
            <h1 className="text-[22px] font-bold md:hidden">{d.name}</h1>
            <h2 className="text-[22px] font-semibold max-md:mt-1 max-md:text-base max-md:font-normal max-md:text-muted">
              {categoryLabel(d.category)} di {d.area}
            </h2>
            <p className="mt-1 text-[15px]">{d.short}</p>
            <div className="mt-2 flex items-center gap-1 text-[15px] font-semibold">
              <Star className="size-4 fill-ink" />
              {d.reviewCount ? (
                <>
                  {d.rating.toFixed(2).replace('.', ',')} ·{' '}
                  <button className="underline" onClick={() => setAllReviews(true)}>
                    {d.reviewCount} ulasan
                  </button>
                </>
              ) : (
                'Belum ada ulasan'
              )}
            </div>
          </section>

          <section className="space-y-6 border-b border-line py-8">
            <Fact icon={Clock} title={`Buka ${d.hours.open}–${d.hours.close} WIB`}>
              {d.closedDays.length ? `Tutup setiap ${d.closedDays.map((x) => DAY_NAMES[x]).join(', ')}` : 'Buka setiap hari'}
            </Fact>
            <Fact icon={Ticket} title={d.minPrice ? `Tiket mulai ${rupiah(d.minPrice)}` : 'Masuk gratis'}>
              E-tiket dengan kode QR langsung terbit setelah pembayaran.
            </Fact>
            <Fact icon={Users} title={`Kuota ${d.dailyQuota.toLocaleString('id-ID')} pengunjung per hari`}>
              Pesan lebih awal untuk akhir pekan dan hari libur.
            </Fact>
          </section>

          <section className="border-b border-line py-8">
            <p className={`text-[15px] leading-relaxed whitespace-pre-line ${descOpen ? '' : 'line-clamp-5'}`}>{d.description}</p>
            {d.description.length > 280 && (
              <button className="mt-4 font-semibold underline" onClick={() => setDescOpen((o) => !o)}>
                {descOpen ? 'Tampilkan lebih sedikit' : 'Tampilkan selengkapnya'}
              </button>
            )}
          </section>

          <section className="border-b border-line py-10">
            <h2 className="mb-6 text-[22px] font-semibold">Fasilitas</h2>
            <ul className="grid gap-4 sm:grid-cols-2">
              {d.facilities.map((f) => (
                <li key={f} className="flex items-center gap-4 text-[15px]">
                  <Icon name={FACILITY_ICONS[f]} className="size-6" strokeWidth={1.5} />
                  {f}
                </li>
              ))}
            </ul>
          </section>

          <section className="border-b border-line py-10">
            <h2 className="mb-6 text-[22px] font-semibold">Jenis tiket</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {d.tickets.map((t) => (
                <div key={t.id} className="rounded-xl border border-line p-5">
                  <Ticket className="mb-3 size-6" strokeWidth={1.5} />
                  <div className="font-semibold">{t.name}</div>
                  <div className="text-sm text-muted">{t.desc}</div>
                  <div className="mt-2 font-semibold">{rupiah(t.price)}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="py-10 lg:border-b lg:border-line">
            <h2 className="mb-6 text-[22px] font-semibold">Jam operasional</h2>
            <dl className="grid max-w-sm gap-2 text-[15px]">
              {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                <div key={day} className="flex justify-between">
                  <dt>{DAY_NAMES[day]}</dt>
                  <dd className={d.closedDays.includes(day) ? 'font-semibold text-brand-700' : ''}>
                    {d.closedDays.includes(day) ? 'Tutup' : `${d.hours.open}–${d.hours.close}`}
                  </dd>
                </div>
              ))}
            </dl>
            {d.holidays.length > 0 && (
              <p className="mt-4 text-sm text-muted">Libur khusus: {d.holidays.map((h) => formatDate(h)).join(', ')}</p>
            )}
          </section>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-28">
            <BookingCard d={d} initialDate={sp.get('tanggal')} initialGuests={+sp.get('orang') || 0} />
          </div>
        </aside>
      </div>

      <Reviews d={d} list={reviewList} onShowAll={() => setAllReviews(true)} />

      <section className="border-t border-line py-12">
        <h2 className="text-[22px] font-semibold">Lokasi</h2>
        <p className="mt-2 mb-6 flex items-start gap-2 text-[15px]">
          <MapPin className="mt-0.5 size-4 shrink-0" /> {d.address}
        </p>
        <Suspense fallback={<div className="h-[420px] w-full animate-pulse rounded-2xl bg-soft" />}>
          <LocationMap lat={d.lat} lng={d.lng} className="h-[420px] w-full rounded-2xl" />
        </Suspense>
        <a
          href={`https://www.openstreetmap.org/?mlat=${d.lat}&mlon=${d.lng}#map=17/${d.lat}/${d.lng}`}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-block font-semibold underline"
        >
          Buka di OpenStreetMap
        </a>
      </section>

      {/* Bilah pemesanan bawah untuk layar kecil */}
      <div className="no-print fixed inset-x-0 bottom-0 z-40 flex items-center justify-between border-t border-line bg-white px-6 py-4 lg:hidden">
        <div>
          <div className="font-bold">{d.minPrice ? `${rupiah(d.minPrice)} / orang` : 'Gratis'}</div>
          <RatingInline rating={d.rating} count={d.reviewCount} />
        </div>
        <button className="btn-brand" onClick={() => setMobileBook(true)}>
          Pesan
        </button>
      </div>
      <Modal open={mobileBook} onClose={() => setMobileBook(false)} title="Pesan tiket">
        <BookingCard d={d} initialDate={sp.get('tanggal')} initialGuests={+sp.get('orang') || 0} compact />
      </Modal>

      <Modal open={gallery} onClose={() => setGallery(false)} title="Semua foto" size="max-w-4xl">
        <div className="grid gap-3 sm:grid-cols-2">
          {d.photos.map((p, i) => (
            <figure key={p.src} className={i % 3 === 0 ? 'sm:col-span-2' : ''}>
              <Photo src={p.src} alt={`${d.name} foto ${i + 1}`} className="w-full rounded-lg" />
              <figcaption className="mt-1 text-xs text-muted">
                Foto: <a href={p.source} target="_blank" rel="noreferrer" className="underline">{p.credit}</a>
              </figcaption>
            </figure>
          ))}
        </div>
      </Modal>

      <Modal open={allReviews} onClose={() => setAllReviews(false)} title={`${d.reviewCount} ulasan`} size="max-w-3xl">
        <RatingSummary d={d} list={reviewList} />
        <div className="mt-8 space-y-8">
          {reviewList.map((r) => (
            <ReviewItem key={r.id} r={r} full />
          ))}
        </div>
      </Modal>
    </div>
  )
}

function Fact({ icon: I, title, children }) {
  return (
    <div className="flex gap-6">
      <I className="mt-0.5 size-6 shrink-0" strokeWidth={1.5} />
      <div>
        <div className="font-semibold">{title}</div>
        <div className="text-sm text-muted">{children}</div>
      </div>
    </div>
  )
}

function Mosaic({ photos, name, onOpen }) {
  const n = photos.length
  if (!n) return <Photo alt={name} className="mt-4 aspect-[2/1] w-full rounded-2xl md:mt-6" />
  const shown = photos.slice(0, 5)
  const layout =
    n === 1
      ? ['col-span-4 row-span-2']
      : n === 2
        ? ['col-span-2 row-span-2', 'col-span-2 row-span-2']
        : n === 3
          ? ['col-span-2 row-span-2', 'col-span-2', 'col-span-2']
          : n === 4
            ? ['col-span-2 row-span-2', 'col-span-2', '', '']
            : ['col-span-2 row-span-2', '', '', '', '']
  return (
    <div className="relative mt-4 md:mt-6">
      {/* Ponsel: satu foto penuh, geser untuk foto lain */}
      <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory overflow-x-auto sm:hidden">
        {photos.map((p, i) => (
          <Photo key={p.src} src={p.src} alt={`${name} foto ${i + 1}`} className="aspect-[4/3] w-full shrink-0 snap-center" />
        ))}
      </div>
      <div className="hidden h-[clamp(300px,42vw,480px)] grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-2xl sm:grid">
        {shown.map((p, i) => (
          <button key={p.src} onClick={onOpen} className={`group relative overflow-hidden ${layout[i]}`} aria-label={`Lihat foto ${i + 1}`}>
            <Photo src={p.src} alt={`${name} foto ${i + 1}`} className="size-full transition group-hover:brightness-90" />
          </button>
        ))}
      </div>
      <button
        onClick={onOpen}
        className="absolute right-4 bottom-4 hidden items-center gap-2 rounded-lg border border-ink bg-white px-4 py-1.5 text-sm font-semibold hover:bg-soft sm:flex"
      >
        <Grid2x2 className="size-4" /> Tampilkan semua foto
      </button>
    </div>
  )
}

function RatingSummary({ d, list }) {
  const dist = useMemo(() => {
    const c = [0, 0, 0, 0, 0]
    list.forEach((r) => c[r.rating - 1]++)
    return c
  }, [list])
  if (!d.reviewCount) return null
  return (
    <div className="flex flex-col gap-8 sm:flex-row sm:items-center">
      <div className="text-center sm:w-48">
        <div className="text-6xl font-bold tracking-tight">{d.rating.toFixed(1).replace('.', ',')}</div>
        <Stars value={Math.round(d.rating)} />
        <div className="mt-1 text-sm text-muted">{d.reviewCount} ulasan</div>
      </div>
      <div className="flex-1 space-y-1.5">
        {[5, 4, 3, 2, 1].map((s) => (
          <div key={s} className="flex items-center gap-3 text-xs">
            <span className="w-2">{s}</span>
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-ink" style={{ width: `${(dist[s - 1] / list.length) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Reviews({ d, list, onShowAll }) {
  return (
    <section className="border-t border-line py-12 lg:border-t-0">
      {d.reviewCount ? (
        <>
          <div className="mb-10 flex items-center gap-2 text-[22px] font-semibold">
            <Star className="size-5 fill-ink" />
            {d.rating.toFixed(2).replace('.', ',')} · {d.reviewCount} ulasan
          </div>
          <RatingSummary d={d} list={list} />
          <div className="mt-12 grid gap-x-24 gap-y-10 md:grid-cols-2">
            {list.slice(0, 6).map((r) => (
              <ReviewItem key={r.id} r={r} />
            ))}
          </div>
          {list.length > 6 && (
            <button className="btn-outline mt-10" onClick={onShowAll}>
              Tampilkan semua {list.length} ulasan
            </button>
          )}
        </>
      ) : (
        <>
          <h2 className="text-[22px] font-semibold">Belum ada ulasan</h2>
          <p className="mt-2 text-muted">Ulasan muncul dari wisatawan yang tiketnya sudah digunakan.</p>
        </>
      )}
    </section>
  )
}

function ReviewItem({ r, full = false }) {
  return (
    <article>
      <div className="flex items-center gap-3">
        <Avatar user={r.user} size="size-12" />
        <div>
          <div className="font-semibold">{r.user?.name || 'Wisatawan'}</div>
          <div className="text-sm text-muted">Berkunjung {formatDate(r.visitDate, { day: undefined })}</div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Stars value={r.rating} size="size-3" />
      </div>
      {r.comment && <p className={`mt-2 text-[15px] leading-relaxed ${full ? '' : 'line-clamp-4'}`}>{r.comment}</p>}
      {r.reply && (
        <div className="mt-4 ml-4 border-l-2 border-line pl-4">
          <div className="text-sm font-semibold">Balasan pengelola</div>
          <p className="text-sm text-muted">{r.reply.text}</p>
        </div>
      )}
    </article>
  )
}
