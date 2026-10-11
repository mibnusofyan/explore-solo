import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Accessibility,
  Baby,
  Banknote,
  Bath,
  Building2,
  CalendarDays,
  Camera,
  Car,
  Circle,
  CircleAlert,
  CircleCheck,
  ClipboardList,
  Coffee,
  Compass,
  Cross,
  FerrisWheel,
  Gift,
  Hourglass,
  Info,
  Landmark,
  Library,
  Lock,
  MessageSquare,
  MoonStar,
  ScanLine,
  Search,
  ShieldCheck,
  ShoppingBag,
  Star,
  Ticket,
  Trees,
  TrendingUp,
  TriangleAlert,
  UserRound,
  Users,
  Wifi,
  X,
  ImageOff,
} from 'lucide-react'
import { STATUS_STYLES } from '../lib/status'
import { initials } from '../lib/format'

// Ikon yang dipanggil lewat nama (kategori, fasilitas, status). Daftar eksplisit
// agar bundel tidak memuat seluruh pustaka ikon.
const ICONS = { Accessibility, Baby, Banknote, Bath, Building2, CalendarDays, Camera, Car, Circle, CircleAlert, CircleCheck, ClipboardList, Coffee, Compass, Cross, FerrisWheel, Gift, Hourglass, Info, Landmark, Library, Lock, MessageSquare, MoonStar, ScanLine, Search, ShieldCheck, ShoppingBag, Star, Ticket, Trees, TrendingUp, TriangleAlert, UserRound, Users, Wifi }

export function Icon({ name, ...props }) {
  const C = ICONS[name] || Circle
  return <C {...props} />
}

export function Spinner({ className = 'size-6' }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-current border-r-transparent ${className}`}
      role="status"
      aria-label="Memuat"
    />
  )
}

export function PageLoader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-muted">
      <Spinner className="size-8" />
    </div>
  )
}

/** Foto dengan cadangan bila gagal dimuat atau belum ada. */
export function Photo({ src, alt, className = '', ...rest }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <div
        className={`flex items-center justify-center bg-linear-to-br from-brand-50 via-soft to-amber-50 text-muted ${className}`}
        role="img"
        aria-label={alt}
      >
        <ImageOff className="size-8 opacity-50" />
      </div>
    )
  }
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={`object-cover ${className}`} {...rest} />
}

export function RatingInline({ rating, count, showCount = true, className = '' }) {
  if (!count) return <span className={`text-sm ${className}`}>Baru</span>
  return (
    <span className={`inline-flex items-center gap-1 text-sm ${className}`}>
      <Star className="size-3.5 fill-current" />
      {rating.toFixed(2).replace('.', ',')}
      {showCount && <span className="text-muted">({count})</span>}
    </span>
  )
}

export function Stars({ value, size = 'size-4', onChange }) {
  const [hover, setHover] = useState(0)
  const shown = hover || value
  return (
    <div className="inline-flex gap-1" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) =>
        onChange ? (
          <button
            key={n}
            type="button"
            aria-label={`${n} bintang`}
            onMouseEnter={() => setHover(n)}
            onClick={() => onChange(n)}
            className="rounded p-0.5 transition hover:scale-110"
          >
            <Star className={`${size} ${n <= shown ? 'fill-ink text-ink' : 'text-line'}`} />
          </button>
        ) : (
          <Star key={n} className={`${size} ${n <= shown ? 'fill-ink text-ink' : 'fill-line text-line'}`} />
        ),
      )}
    </div>
  )
}


export function StatusBadge({ status, className = '' }) {
  const s = STATUS_STYLES[status] || { label: status, cls: 'bg-soft text-muted ring-line' }
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${s.cls} ${className}`}>
      {s.label}
    </span>
  )
}

export function Avatar({ user, size = 'size-8', className = '' }) {
  if (user?.avatar) return <img src={user.avatar} alt="" className={`${size} rounded-full object-cover ${className}`} />
  return (
    <span
      className={`inline-flex ${size} shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white ${className}`}
      aria-hidden
    >
      {initials(user?.name) || '?'}
    </span>
  )
}

export function Modal({ open, onClose, title, children, footer, size = 'max-w-xl' }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-[900] flex items-end justify-center bg-black/50 sm:items-center sm:p-6" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`flex max-h-[92vh] w-full ${size} flex-col overflow-hidden rounded-t-2xl bg-white shadow-float sm:rounded-2xl`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="relative flex h-16 shrink-0 items-center justify-center border-b border-line px-14">
          <button onClick={onClose} className="absolute left-4 rounded-full p-2 hover:bg-soft" aria-label="Tutup">
            <X className="size-4" />
          </button>
          <h2 className="truncate text-base font-bold">{title}</h2>
        </header>
        <div className="overflow-y-auto p-6">{children}</div>
        {footer && <footer className="shrink-0 border-t border-line px-6 py-4">{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}

export function EmptyState({ icon = 'Compass', title, children, action }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
      <div className="mb-5 flex size-16 items-center justify-center rounded-full bg-soft">
        <Icon name={icon} className="size-7 text-muted" />
      </div>
      <h3 className="text-xl font-bold">{title}</h3>
      {children && <p className="mt-2 text-muted">{children}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

export function FieldError({ children }) {
  if (!children) return null
  return (
    <p className="mt-1.5 flex items-center gap-1 text-sm text-brand-700">
      <CircleAlert className="size-3.5" /> {children}
    </p>
  )
}

export function Alert({ tone = 'error', children, className = '' }) {
  const styles = {
    error: 'border-brand-200 bg-brand-50 text-brand-700',
    info: 'border-sky-200 bg-sky-50 text-sky-900',
    warn: 'border-amber-200 bg-amber-50 text-amber-900',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  }
  const icon = { error: 'CircleAlert', info: 'Info', warn: 'TriangleAlert', success: 'CircleCheck' }[tone]
  return (
    <div className={`flex gap-3 rounded-xl border px-4 py-3 text-sm ${styles[tone]} ${className}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon name={icon} className="mt-0.5 size-4 shrink-0" />
      <div>{children}</div>
    </div>
  )
}

export function Stat({ label, value, icon, hint }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between text-sm text-muted">
        {label}
        {icon && <Icon name={icon} className="size-4" />}
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  )
}
