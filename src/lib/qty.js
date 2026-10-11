// Jumlah tiket per jenis dikodekan di URL, mis. "krt-dewasa:2,krt-anak:1".
export function encodeQty(q) {
  return Object.entries(q)
    .filter(([, n]) => n > 0)
    .map(([id, n]) => `${id}:${n}`)
    .join(',')
}

export function decodeQty(s) {
  const out = {}
  for (const part of (s || '').split(',')) {
    const [id, n] = part.split(':')
    if (id && +n > 0) out[id] = Math.min(20, Math.floor(+n))
  }
  return out
}
