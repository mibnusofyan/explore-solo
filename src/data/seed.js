// Data awal demo. Tanggal dibuat relatif terhadap hari ini agar demo selalu segar.
import { DESTINATIONS } from './destinations'
import { addDays, todayISO } from '../lib/format'

function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const DEMO_ACCOUNTS = [
  { role: 'wisatawan', label: 'Wisatawan', email: 'wisatawan@exploresolo.id', password: 'wisata123' },
  { role: 'pengelola', label: 'Pengelola Destinasi', email: 'pengelola@exploresolo.id', password: 'pengelola123' },
  { role: 'admin', label: 'Admin', email: 'admin@exploresolo.id', password: 'admin12345' },
]

export const DEMO_CHECKIN_CODE = 'ES-HR7K2M'

const REVIEWERS = [
  'Ayu Lestari', 'Bagus Santoso', 'Citra Maharani', 'Dewi Anggraini', 'Eko Prasetyo',
  'Fajar Nugroho', 'Gita Permata', 'Hendra Wijaya', 'Indah Puspita', 'Joko Susilo',
  'Kartika Sari', 'Lukman Hakim', 'Maya Safitri', 'Nanda Pratama', 'Oktaviani Putri',
]

const COMMENTS = {
  5: [
    'Pengalaman yang luar biasa! Pemandu ramah dan penjelasannya sangat detail. Wajib dikunjungi kalau ke Solo.',
    'Tempatnya bersih, tertata, dan penuh cerita. Pesan tiket lewat Explore Solo juga praktis, tinggal tunjukkan QR.',
    'Datang pagi hari lebih enak, belum ramai dan udaranya sejuk. Anak-anak senang sekali.',
    'Sangat berkesan. Banyak spot foto bagus dan petugasnya membantu.',
    'Salah satu destinasi terbaik di Surakarta. Akan kembali lagi bersama keluarga.',
  ],
  4: [
    'Bagus dan edukatif, hanya parkirnya agak terbatas saat akhir pekan.',
    'Secara umum menyenangkan. Papan informasinya bisa ditambah terjemahan bahasa Inggris.',
    'Worth it untuk harga tiketnya. Siang hari cukup panas, bawa topi dan air minum.',
    'Tempat yang nyaman untuk belajar sejarah Solo. Toiletnya bisa lebih dirawat.',
  ],
  3: [
    'Cukup menarik, tetapi beberapa bagian sedang direnovasi sehingga tidak bisa dimasuki.',
    'Lumayan, antrean masuk agak lama walaupun sudah punya e-tiket.',
  ],
}

function pick(rand, arr) {
  return arr[Math.floor(rand() * arr.length)]
}

export function buildSeed() {
  const rand = mulberry32(20261010)
  const today = todayISO()
  const now = Date.now()
  const day = 86_400_000

  const destinations = DESTINATIONS.map((d) => ({
    ...d,
    status: d.status || 'AKTIF',
    pendingChanges: null,
    reviewNote: null,
    createdAt: now - 120 * day,
    updatedAt: now - 30 * day,
  }))
  const byId = Object.fromEntries(destinations.map((d) => [d.id, d]))

  const users = [
    {
      id: 'usr_admin',
      name: 'Admin Explore Solo',
      email: 'admin@exploresolo.id',
      phone: '081200000001',
      password: 'admin12345',
      role: 'admin',
      active: true,
      avatar: null,
      destinationIds: [],
      createdAt: now - 200 * day,
    },
    {
      id: 'usr_pengelola',
      name: 'Sri Handayani',
      email: 'pengelola@exploresolo.id',
      phone: '081200000002',
      password: 'pengelola123',
      role: 'pengelola',
      active: true,
      avatar: null,
      destinationIds: ['dst_keraton', 'dst_radyapustaka', 'dst_vastenburg', 'dst_monpers'],
      createdAt: now - 150 * day,
    },
    {
      id: 'usr_pengelola2',
      name: 'Bambang Haryanto',
      email: 'mangkunegaran@exploresolo.id',
      phone: '081200000003',
      password: 'pengelola123',
      role: 'pengelola',
      active: true,
      avatar: null,
      destinationIds: ['dst_mangkunegaran', 'dst_balekambang', 'dst_jurug', 'dst_lokananta', 'dst_triwindu', 'dst_pasargede', 'dst_laweyan', 'dst_masjidagung', 'dst_sheikhzayed'],
      createdAt: now - 150 * day,
    },
    {
      id: 'usr_demo',
      name: 'Dimas Prasetyo',
      email: 'wisatawan@exploresolo.id',
      phone: '081234567890',
      password: 'wisata123',
      role: 'wisatawan',
      active: true,
      avatar: null,
      destinationIds: [],
      createdAt: now - 60 * day,
    },
    ...REVIEWERS.map((name, i) => ({
      id: `usr_r${i}`,
      name,
      email: `${name.toLowerCase().replace(/\s+/g, '.')}@contoh.id`,
      phone: `0813${String(10000000 + i * 7919).slice(0, 8)}`,
      password: 'password123',
      role: 'wisatawan',
      active: i !== 14,
      avatar: null,
      destinationIds: [],
      createdAt: now - (100 - i * 3) * day,
    })),
  ]

  const reservations = []
  const reviews = []
  let seq = 0

  const makeCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let s = ''
    for (let i = 0; i < 6; i++) s += chars[Math.floor(rand() * chars.length)]
    return `ES-${s}`
  }

  function addReservation(d, userId, date, status, qtyPlan, extra = {}) {
    const items = qtyPlan
      .map((qty, i) => d.tickets[i] && qty > 0 && { ticketId: d.tickets[i].id, name: d.tickets[i].name, price: d.tickets[i].price, qty })
      .filter(Boolean)
    const user = users.find((u) => u.id === userId)
    const created = new Date(`${date}T02:00:00Z`).getTime() - (2 + Math.floor(rand() * 10)) * day
    const free = items.every((i) => i.price === 0)
    const r = {
      id: `rsv_${++seq}`,
      code: makeCode(),
      userId,
      destinationId: d.id,
      date,
      items,
      totalQty: items.reduce((s, i) => s + i.qty, 0),
      total: items.reduce((s, i) => s + i.qty * i.price, 0),
      contact: { name: user.name, email: user.email, phone: user.phone },
      status,
      payment:
        status === 'DIBATALKAN'
          ? null
          : { method: free ? 'gratis' : pick(rand, ['bca_va', 'qris', 'gopay', 'bri_va', 'shopeepay']), paidAt: created + 600_000 },
      createdAt: created,
      updatedAt: created,
      expiresAt: created + 3_600_000,
      checkedInAt: status === 'SUDAH_DIGUNAKAN' ? new Date(`${date}T03:30:00Z`).getTime() : null,
      ...extra,
    }
    if (status === 'DIBATALKAN') r.cancelReason = 'Batas waktu pembayaran terlewati'
    reservations.push(r)
    return r
  }

  // Riwayat kunjungan 60 hari terakhir + reservasi mendatang untuk laporan dan ulasan.
  for (const d of destinations.filter((x) => x.status === 'AKTIF')) {
    const visits = 10 + Math.floor(rand() * 10)
    for (let i = 0; i < visits; i++) {
      const offset = -Math.floor(rand() * 60) - 1
      const date = addDays(today, offset)
      const reviewer = REVIEWERS.length ? `usr_r${Math.floor(rand() * REVIEWERS.length)}` : 'usr_demo'
      const status = rand() < 0.12 && d.tickets[0].price > 0 ? 'DIBATALKAN' : 'SUDAH_DIGUNAKAN'
      const plan = [1 + Math.floor(rand() * 3), rand() < 0.5 ? Math.floor(rand() * 3) : 0, rand() < 0.1 ? 1 : 0]
      const r = addReservation(d, reviewer, date, status, plan)
      if (status === 'SUDAH_DIGUNAKAN' && rand() < 0.75) {
        const roll = rand()
        const rating = roll < 0.62 ? 5 : roll < 0.92 ? 4 : 3
        reviews.push({
          id: `rvw_${reviews.length + 1}`,
          reservationId: r.id,
          destinationId: d.id,
          userId: reviewer,
          rating,
          comment: pick(rand, COMMENTS[rating]),
          visitDate: date,
          createdAt: new Date(`${date}T12:00:00Z`).getTime(),
          reply:
            rand() < 0.3
              ? { text: 'Terima kasih atas kunjungan dan ulasannya. Sampai jumpa kembali!', by: 'Pengelola', createdAt: new Date(`${date}T14:00:00Z`).getTime() }
              : null,
        })
      }
    }
    const upcoming = 3 + Math.floor(rand() * 4)
    for (let i = 0; i < upcoming; i++) {
      const date = addDays(today, Math.floor(rand() * 14))
      addReservation(d, `usr_r${Math.floor(rand() * REVIEWERS.length)}`, date, 'LUNAS', [1 + Math.floor(rand() * 4), Math.floor(rand() * 2)])
    }
  }

  // Reservasi milik akun demo Wisatawan, mewakili setiap status.
  const demo = 'usr_demo'
  addReservation(byId.dst_keraton, demo, today, 'LUNAS', [2, 1], { code: DEMO_CHECKIN_CODE })
  addReservation(byId.dst_lokananta, demo, addDays(today, 5), 'LUNAS', [2])
  addReservation(byId.dst_mangkunegaran, demo, addDays(today, -9), 'SUDAH_DIGUNAKAN', [2])
  const reviewed = addReservation(byId.dst_balekambang, demo, addDays(today, -21), 'SUDAH_DIGUNAKAN', [2, 2])
  reviews.push({
    id: `rvw_${reviews.length + 1}`,
    reservationId: reviewed.id,
    destinationId: reviewed.destinationId,
    userId: demo,
    rating: 5,
    comment: 'Taman yang asri dan teduh. Anak-anak senang memberi makan rusa. Cocok untuk piknik keluarga di akhir pekan.',
    visitDate: reviewed.date,
    createdAt: now - 20 * day,
    reply: { text: 'Terima kasih, Kak Dimas! Senang keluarga menikmati Balekambang.', by: 'Bambang Haryanto', createdAt: now - 19 * day },
  })
  addReservation(byId.dst_radyapustaka, demo, addDays(today, -3), 'DIBATALKAN', [3])
  // Satu reservasi menunggu pembayaran (sisa ±40 menit) untuk mencoba alur bayar.
  addReservation(byId.dst_jurug, demo, addDays(today, 2), 'MENUNGGU_PEMBAYARAN', [2, 2], {
    createdAt: now - 20 * 60_000,
    updatedAt: now - 20 * 60_000,
    expiresAt: now + 40 * 60_000,
    payment: null,
  })

  return { version: 1, users, destinations, reservations, reviews }
}
