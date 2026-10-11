import { useEffect, useState } from 'react'
import { destinations } from '../services/api'

/** Ambil sisa kuota destinasi untuk satu tanggal dari server; null selama dimuat. */
export function useAvailability(slug, date) {
  const key = `${slug}|${date}`
  const [state, setState] = useState({ key: null })

  useEffect(() => {
    if (!date) return
    let alive = true
    destinations
      .availability(slug, date)
      .then((avail) => alive && setState({ key, avail }))
      .catch((e) => alive && setState({ key, avail: { open: false, reason: e.message, remaining: 0 } }))
    return () => {
      alive = false
    }
  }, [slug, date, key])

  return date && state.key === key ? state.avail : null
}
