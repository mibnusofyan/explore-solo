import { useEffect, useRef, useState } from 'react'
import { Search, Minus, Plus } from 'lucide-react'
import { formatShortDate, todayISO } from '../lib/format'

function Segment({ label, children, active, onClick, className = '' }) {
  return (
    <div
      onClick={onClick}
      className={`relative flex min-w-0 cursor-pointer flex-col justify-center rounded-full px-6 py-3 transition md:py-3.5 ${
        active ? 'bg-white shadow-float' : 'hover:bg-soft'
      } ${className}`}
    >
      <span className="text-xs font-semibold">{label}</span>
      {children}
    </div>
  )
}

export function Stepper({ value, onChange, min = 0, max = 20, label }) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        className="flex size-8 items-center justify-center rounded-full border border-line text-muted transition hover:border-ink hover:text-ink disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-line"
        onClick={() => onChange(value - 1)}
        disabled={value <= min}
        aria-label={`Kurangi ${label}`}
      >
        <Minus className="size-3.5" />
      </button>
      <span className="w-5 text-center tabular-nums" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className="flex size-8 items-center justify-center rounded-full border border-line text-muted transition hover:border-ink hover:text-ink disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-line"
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label={`Tambah ${label}`}
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  )
}

/** Bilah pencarian berbentuk pil (Ke mana · Tanggal · Pengunjung) seperti beranda Airbnb. */
export function SearchBar({ initial, onSearch }) {
  const [q, setQ] = useState(initial.q || '')
  const [date, setDate] = useState(initial.date || '')
  const [guests, setGuests] = useState(initial.guests || 0)
  const [active, setActive] = useState(null)
  const ref = useRef(null)
  const dateRef = useRef(null)

  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setActive(null)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const submit = (e) => {
    e?.preventDefault()
    setActive(null)
    onSearch({ q: q.trim(), date, guests })
  }

  return (
    <form
      ref={ref}
      onSubmit={submit}
      role="search"
      className={`relative mx-auto grid w-full max-w-[850px] grid-cols-1 rounded-3xl border border-line shadow-pill md:grid-cols-[1.4fr_1fr_1fr] md:rounded-full ${
        active ? 'bg-soft' : 'bg-white'
      }`}
    >
      <Segment label="Ke mana" active={active === 'q'} onClick={() => setActive('q')}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setActive('q')}
          placeholder="Cari destinasi atau area"
          className="w-full truncate bg-transparent text-sm outline-none placeholder:text-muted"
          aria-label="Cari destinasi"
        />
      </Segment>
      <Segment
        label="Tanggal kunjungan"
        active={active === 'date'}
        onClick={() => {
          setActive('date')
          dateRef.current?.showPicker?.()
        }}
        className="md:before:absolute md:before:inset-y-4 md:before:left-0 md:before:w-px md:before:bg-line"
      >
        <span className={`text-sm ${date ? '' : 'text-muted'}`}>{date ? formatShortDate(date) : 'Pilih tanggal'}</span>
        <input
          ref={dateRef}
          type="date"
          min={todayISO()}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label="Tanggal kunjungan"
        />
      </Segment>
      <Segment
        label="Pengunjung"
        active={active === 'guests'}
        onClick={() => setActive('guests')}
        className="pr-16 md:before:absolute md:before:inset-y-4 md:before:left-0 md:before:w-px md:before:bg-line"
      >
        <span className={`text-sm ${guests ? '' : 'text-muted'}`}>{guests ? `${guests} orang` : 'Tambah pengunjung'}</span>
        {active === 'guests' && (
          <div
            className="absolute top-[calc(100%+12px)] right-0 z-30 w-80 cursor-default rounded-3xl bg-white p-6 shadow-float"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">Jumlah pengunjung</div>
                <div className="text-sm text-muted">Untuk cek sisa kuota harian</div>
              </div>
              <Stepper value={guests} onChange={setGuests} label="pengunjung" />
            </div>
          </div>
        )}
      </Segment>
      <button
        type="submit"
        className="absolute right-2 bottom-2 flex h-12 items-center gap-2 rounded-full bg-linear-to-r from-brand-500 to-brand-600 px-4 font-semibold text-white transition hover:from-brand-600 hover:to-brand-700 md:top-1/2 md:bottom-auto md:-translate-y-1/2"
        aria-label="Cari"
      >
        <Search className="size-4" strokeWidth={3} />
        <span className={active ? 'inline' : 'hidden'}>Cari</span>
      </button>
    </form>
  )
}
