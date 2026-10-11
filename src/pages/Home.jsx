import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SlidersHorizontal, Map as MapIcon, List } from 'lucide-react'
import { destinations } from '../services/api'
import { CATEGORIES } from '../data/destinations'
import { SearchBar } from '../components/SearchBar'
import { DestinationCard, CardSkeleton } from '../components/DestinationCard'
import { EmptyState, Icon, Modal } from '../components/ui'
import { formatDate } from '../lib/format'

// Leaflet hanya dimuat saat peta dibuka.
const ResultsMap = lazy(() => import('../components/MapView').then((m) => ({ default: m.ResultsMap })))

const SORTS = [
  { id: 'rekomendasi', label: 'Rekomendasi' },
  { id: 'rating', label: 'Rating tertinggi' },
  { id: 'harga-terendah', label: 'Harga terendah' },
  { id: 'harga-tertinggi', label: 'Harga tertinggi' },
  { id: 'nama', label: 'Nama (A–Z)' },
]

const PRICE_PRESETS = [
  { label: 'Gratis', min: 0, max: 0 },
  { label: '< Rp25rb', min: 1, max: 25000 },
  { label: 'Rp25rb–Rp60rb', min: 25000, max: 60000 },
  { label: '> Rp60rb', min: 60000, max: null },
]

function readParams(sp) {
  const num = (k) => (sp.get(k) === null || sp.get(k) === '' ? null : Number(sp.get(k)))
  return {
    q: sp.get('q') || '',
    category: sp.get('kategori') || '',
    minPrice: num('min'),
    maxPrice: num('max'),
    minRating: num('rating') || 0,
    sort: sp.get('urut') || 'rekomendasi',
    date: sp.get('tanggal') || '',
    guests: num('orang') || 0,
  }
}

export default function Home() {
  const [sp, setSp] = useSearchParams()
  const params = useMemo(() => readParams(sp), [sp])
  const [result, setResult] = useState({ key: null, items: null })
  const [showMap, setShowMap] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [hoverId, setHoverId] = useState(null)

  const searchKey = sp.toString()
  useEffect(() => {
    let alive = true
    destinations.search(params).then((items) => alive && setResult({ key: searchKey, items }))
    return () => {
      alive = false
    }
  }, [params, searchKey])
  const items = result.key === searchKey ? result.items : null

  const update = (patch) => {
    const next = new URLSearchParams(sp)
    const keys = { q: 'q', category: 'kategori', minPrice: 'min', maxPrice: 'max', minRating: 'rating', sort: 'urut', date: 'tanggal', guests: 'orang' }
    for (const [k, v] of Object.entries(patch)) {
      const empty =
        v === '' || v == null || (k === 'sort' && v === 'rekomendasi') || ((k === 'minRating' || k === 'guests') && !v)
      if (empty) next.delete(keys[k])
      else next.set(keys[k], v)
    }
    setSp(next)
  }

  const filterCount = (params.minPrice != null || params.maxPrice != null ? 1 : 0) + (params.minRating ? 1 : 0) + (params.sort !== 'rekomendasi' ? 1 : 0)

  // Bila tanggal/jumlah pengunjung dipilih, tandai destinasi yang tutup atau kuotanya kurang.
  const withAvailability = useMemo(() => {
    if (!items) return null
    if (!params.date) return items.map((d) => ({ d, avail: null }))
    return items.map((d) => {
      const a = destinations.availability(d, params.date)
      const ok = a.open && a.remaining >= Math.max(1, params.guests)
      return { d, avail: { ...a, ok } }
    })
  }, [items, params.date, params.guests])

  return (
    <>
      <section className="container-page pt-6 pb-2 md:pt-8">
        <SearchBar key={`${params.q}|${params.date}|${params.guests}`} initial={params} onSearch={(v) => update(v)} />
      </section>

      <div className="sticky top-20 z-30 border-b border-line bg-white">
        <div className="container-page flex items-center gap-6">
          <nav className="no-scrollbar -mb-px flex flex-1 gap-8 overflow-x-auto pt-4" aria-label="Kategori">
            <CategoryTab active={!params.category} icon="Compass" label="Semua" onClick={() => update({ category: '' })} />
            {CATEGORIES.map((c) => (
              <CategoryTab
                key={c.id}
                active={params.category === c.id}
                icon={c.icon}
                label={c.label}
                onClick={() => update({ category: c.id })}
              />
            ))}
          </nav>
          <button
            onClick={() => setFilterOpen(true)}
            className="relative flex shrink-0 items-center gap-2 rounded-xl border border-line px-4 py-3 text-xs font-semibold transition hover:border-ink"
          >
            <SlidersHorizontal className="size-4" />
            <span className="hidden sm:inline">Filter</span>
            {filterCount > 0 && (
              <span className="absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full bg-ink text-[10px] text-white">
                {filterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <section className="container-page py-6">
        {(params.q || params.date) && items && (
          <p className="mb-5 text-[15px]">
            <span className="font-semibold">{items.length} destinasi</span>
            {params.q && <> untuk “{params.q}”</>}
            {params.date && <> · kunjungan {formatDate(params.date)}</>}
            {params.guests > 0 && <> · {params.guests} orang</>}
          </p>
        )}

        {showMap ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <div className="order-2 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:order-1">
              <Results list={withAvailability} date={params.date} onHover={setHoverId} onReset={() => setSp({})} />
            </div>
            <div className="order-1 h-[60vh] overflow-hidden rounded-2xl lg:sticky lg:top-44 lg:order-2 lg:h-[calc(100vh-12rem)]">
              <Suspense fallback={<div className="size-full animate-pulse bg-soft" />}>
                {items && <ResultsMap items={items} activeId={hoverId} className="size-full" />}
              </Suspense>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            <Results list={withAvailability} date={params.date} onHover={setHoverId} onReset={() => setSp({})} />
          </div>
        )}
      </section>

      <div className="no-print pointer-events-none fixed inset-x-0 bottom-8 z-30 flex justify-center">
        <button
          onClick={() => setShowMap((s) => !s)}
          className="pointer-events-auto flex items-center gap-2 rounded-full bg-ink px-5 py-3.5 text-sm font-semibold text-white shadow-float transition hover:scale-105"
        >
          {showMap ? (
            <>
              Tampilkan daftar <List className="size-4" />
            </>
          ) : (
            <>
              Tampilkan peta <MapIcon className="size-4" />
            </>
          )}
        </button>
      </div>

      {filterOpen && <FilterModal onClose={() => setFilterOpen(false)} params={params} onApply={update} />}
    </>
  )
}

function CategoryTab({ active, icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`group flex shrink-0 flex-col items-center gap-2 border-b-2 pb-3 text-xs font-semibold transition ${
        active ? 'border-ink text-ink' : 'border-transparent text-muted hover:border-line hover:text-ink'
      }`}
    >
      <Icon name={icon} className="size-6" strokeWidth={active ? 2 : 1.6} />
      {label}
    </button>
  )
}

function Results({ list, date, onHover, onReset }) {
  if (!list) return Array.from({ length: 8 }, (_, i) => <CardSkeleton key={i} />)
  if (!list.length)
    return (
      <div className="col-span-full">
        <EmptyState
          icon="Search"
          title="Destinasi tidak ditemukan"
          action={
            <button className="btn-outline" onClick={onReset}>
              Hapus semua filter
            </button>
          }
        >
          Coba kata kunci lain atau longgarkan filter kategori, harga, dan rating.
        </EmptyState>
      </div>
    )
  return list.map(({ d, avail }) => (
    <div key={d.id} className={avail && !avail.ok ? 'opacity-55' : ''}>
      <DestinationCard d={d} date={date} onHover={onHover} />
      {avail && (
        <p className={`mt-1 text-sm font-medium ${avail.ok ? 'text-emerald-700' : 'text-brand-700'}`}>
          {!avail.open ? avail.reason : avail.ok ? `Tersedia · sisa ${avail.remaining} kuota` : `Kuota tersisa ${avail.remaining}`}
        </p>
      )}
    </div>
  ))
}

function FilterModal({ onClose, params, onApply }) {
  const [min, setMin] = useState(params.minPrice ?? '')
  const [max, setMax] = useState(params.maxPrice ?? '')
  const [rating, setRating] = useState(params.minRating)
  const [sort, setSort] = useState(params.sort)

  const apply = () => {
    onApply({
      minPrice: min === '' ? null : Number(min),
      maxPrice: max === '' ? null : Number(max),
      minRating: rating,
      sort,
    })
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Filter"
      size="max-w-2xl"
      footer={
        <div className="flex items-center justify-between">
          <button
            className="rounded-lg px-2 py-2 font-semibold underline hover:bg-soft"
            onClick={() => {
              setMin('')
              setMax('')
              setRating(0)
              setSort('rekomendasi')
            }}
          >
            Hapus semua
          </button>
          <button className="btn-dark" onClick={apply}>
            Terapkan
          </button>
        </div>
      }
    >
      <section className="border-b border-line pb-8">
        <h3 className="text-xl font-bold">Rentang harga tiket</h3>
        <p className="mt-1 text-sm text-muted">Harga tiket termurah per orang</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {PRICE_PRESETS.map((p) => {
            const on = String(min) === String(p.min) && String(max) === String(p.max ?? '')
            return (
              <button
                key={p.label}
                onClick={() => {
                  setMin(p.min)
                  setMax(p.max ?? '')
                }}
                className={`rounded-full border px-4 py-2 text-sm transition ${on ? 'border-ink bg-soft font-semibold' : 'border-line hover:border-ink'}`}
              >
                {p.label}
              </button>
            )
          })}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-4">
          <label className="rounded-xl border border-line px-4 py-2 focus-within:border-ink">
            <span className="text-xs text-muted">Minimum (Rp)</span>
            <input type="number" min={0} step={1000} value={min} onChange={(e) => setMin(e.target.value)} className="w-full outline-none" placeholder="0" />
          </label>
          <label className="rounded-xl border border-line px-4 py-2 focus-within:border-ink">
            <span className="text-xs text-muted">Maksimum (Rp)</span>
            <input type="number" min={0} step={1000} value={max} onChange={(e) => setMax(e.target.value)} className="w-full outline-none" placeholder="Tanpa batas" />
          </label>
        </div>
      </section>

      <section className="border-b border-line py-8">
        <h3 className="text-xl font-bold">Rating</h3>
        <div className="mt-5 flex flex-wrap gap-2">
          {[
            [0, 'Semua'],
            [4, '4,0+'],
            [4.5, '4,5+'],
            [4.8, '4,8+'],
          ].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setRating(v)}
              className={`rounded-full border px-5 py-2 text-sm transition ${rating === v ? 'border-ink bg-ink text-white' : 'border-line hover:border-ink'}`}
            >
              {l}
            </button>
          ))}
        </div>
      </section>

      <section className="pt-8">
        <h3 className="text-xl font-bold">Urutkan</h3>
        <div className="mt-4 grid gap-1">
          {SORTS.map((s) => (
            <label key={s.id} className="flex cursor-pointer items-center justify-between rounded-lg py-2.5">
              <span>{s.label}</span>
              <input type="radio" name="sort" className="size-5 accent-ink" checked={sort === s.id} onChange={() => setSort(s.id)} />
            </label>
          ))}
        </div>
      </section>
    </Modal>
  )
}
