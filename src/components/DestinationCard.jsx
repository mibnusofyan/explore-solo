import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Photo, RatingInline } from './ui'
import { rupiah } from '../lib/format'
import { categoryLabel } from '../data/destinations'

export function DestinationCard({ d, date, onHover }) {
  const [idx, setIdx] = useState(0)
  const photos = d.photos.length ? d.photos : [null]
  const go = (e, step) => {
    e.preventDefault()
    setIdx((i) => (i + step + photos.length) % photos.length)
  }
  const favorite = d.reviewCount >= 8 && d.rating >= 4.7

  return (
    <Link
      to={`/destinasi/${d.slug}${date ? `?tanggal=${date}` : ''}`}
      className="group block"
      onMouseEnter={() => onHover?.(d.id)}
      onMouseLeave={() => onHover?.(null)}
    >
      <div className="relative aspect-square overflow-hidden rounded-xl bg-soft">
        <Photo src={photos[idx]?.src} alt={d.name} className="size-full transition duration-300 group-hover:scale-[1.03]" />
        {favorite && (
          <span className="absolute top-3 left-3 rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold shadow-pill">
            Favorit wisatawan
          </span>
        )}
        {photos.length > 1 && (
          <>
            <button
              onClick={(e) => go(e, -1)}
              aria-label="Foto sebelumnya"
              className="absolute top-1/2 left-3 hidden size-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 opacity-0 shadow-pill transition group-hover:opacity-100 hover:scale-105 sm:flex"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              onClick={(e) => go(e, 1)}
              aria-label="Foto berikutnya"
              className="absolute top-1/2 right-3 hidden size-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 opacity-0 shadow-pill transition group-hover:opacity-100 hover:scale-105 sm:flex"
            >
              <ChevronRight className="size-4" />
            </button>
            <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
              {photos.map((_, i) => (
                <span key={i} className={`size-1.5 rounded-full ${i === idx ? 'bg-white' : 'bg-white/60'}`} />
              ))}
            </div>
          </>
        )}
      </div>
      <div className="mt-3 flex items-start justify-between gap-2">
        <h3 className="line-clamp-1 font-semibold">{d.name}</h3>
        <RatingInline rating={d.rating} count={d.reviewCount} showCount={false} className="shrink-0" />
      </div>
      <p className="line-clamp-1 text-[15px] text-muted">
        {categoryLabel(d.category)} · {d.area}
      </p>
      <p className="text-[15px] text-muted">
        Buka {d.hours.open}–{d.hours.close}
      </p>
      <p className="mt-1 text-[15px]">
        {d.minPrice ? (
          <>
            <span className="text-muted">mulai </span>
            <span className="font-semibold">{rupiah(d.minPrice)}</span>
            <span className="text-muted"> / orang</span>
          </>
        ) : (
          <span className="font-semibold">Gratis</span>
        )}
      </p>
    </Link>
  )
}

export function CardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="aspect-square rounded-xl bg-soft" />
      <div className="mt-3 h-4 w-3/4 rounded bg-soft" />
      <div className="mt-2 h-4 w-1/2 rounded bg-soft" />
      <div className="mt-2 h-4 w-1/3 rounded bg-soft" />
    </div>
  )
}
