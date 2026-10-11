// Basis data tiruan di localStorage. Bentuk tabelnya mengikuti rancangan MySQL
// (users, destinations, reservations, reviews) agar mudah diganti dengan API Express.
import { buildSeed } from '../data/seed'

const KEY = 'explore-solo:db:v1'

let cache = null

function load() {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      cache = JSON.parse(raw)
      return cache
    }
  } catch {
    // Penyimpanan diblokir atau rusak: mulai dari data awal.
  }
  cache = buildSeed()
  persist()
  return cache
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache))
  } catch {
    // Mode privat: data tetap hidup di memori selama tab terbuka.
  }
}

export function db() {
  return load()
}

export function commit() {
  persist()
}

export function resetDb() {
  cache = buildSeed()
  persist()
}

export function uid(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}
