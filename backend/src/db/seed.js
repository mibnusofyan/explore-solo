// Mengisi basis data dengan data demo. Tanggal dibuat relatif terhadap hari ini (WIB)
// agar demo selalu segar. Menghapus data lama di tabel yang diisi.
import bcrypt from 'bcryptjs'
import { pool, transaction } from './pool.js'
import { DESTINATIONS } from './seed-destinations.js'
import { addDays, todayWIB } from '../utils/time.js'

export const DEMO_CHECKIN_CODE = 'ES-HR7K2M'

function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

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

const pick = (rand, arr) => arr[Math.floor(rand() * arr.length)]
const dt = (ms) => new Date(ms)

export async function seed({ now = Date.now(), log = console.log } = {}) {
  const rand = mulberry32(20261010)
  const today = todayWIB(new Date(now))
  const day = 86_400_000

  // Hash sekali per password unik (bcrypt sengaja lambat).
  const hashes = {}
  const hash = async (p) => (hashes[p] ??= await bcrypt.hash(p, 10))

  const users = [
    { id: 'usr_admin', name: 'Admin Explore Solo', email: 'admin@exploresolo.id', phone: '081200000001', password: 'admin12345', role: 'admin', created: now - 200 * day },
    { id: 'usr_pengelola', name: 'Sri Handayani', email: 'pengelola@exploresolo.id', phone: '081200000002', password: 'pengelola123', role: 'pengelola', created: now - 150 * day,
      destinations: ['dst_keraton', 'dst_radyapustaka', 'dst_vastenburg', 'dst_monpers'] },
    { id: 'usr_pengelola2', name: 'Bambang Haryanto', email: 'mangkunegaran@exploresolo.id', phone: '081200000003', password: 'pengelola123', role: 'pengelola', created: now - 150 * day,
      destinations: ['dst_mangkunegaran', 'dst_balekambang', 'dst_jurug', 'dst_lokananta', 'dst_triwindu', 'dst_pasargede', 'dst_laweyan', 'dst_masjidagung', 'dst_sheikhzayed'] },
    { id: 'usr_demo', name: 'Dimas Prasetyo', email: 'wisatawan@exploresolo.id', phone: '081234567890', password: 'wisata123', role: 'wisatawan', created: now - 60 * day },
    ...REVIEWERS.map((name, i) => ({
      id: `usr_r${i}`,
      name,
      email: `${name.toLowerCase().replace(/\s+/g, '.')}@contoh.id`,
      phone: `0813${String(10000000 + i * 7919).slice(0, 8)}`,
      password: 'password123',
      role: 'wisatawan',
      active: i !== 14,
      created: now - (100 - i * 3) * day,
    })),
  ]
  const userById = Object.fromEntries(users.map((u) => [u.id, u]))
  const destById = Object.fromEntries(DESTINATIONS.map((d) => [d.id, d]))

  const reservations = []
  const items = []
  const payments = []
  const reviews = []
  const usedCodes = new Set([DEMO_CHECKIN_CODE])
  let seq = 0

  const makeCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let s
    do {
      s = 'ES-'
      for (let i = 0; i < 6; i++) s += chars[Math.floor(rand() * chars.length)]
    } while (usedCodes.has(s))
    usedCodes.add(s)
    return s
  }

  function addReservation(d, userId, date, status, qtyPlan, extra = {}) {
    const lines = qtyPlan
      .map((qty, i) => d.tickets[i] && qty > 0 && { ticket: d.tickets[i], qty })
      .filter(Boolean)
    const u = userById[userId]
    const created = extra.created ?? new Date(`${date}T02:00:00Z`).getTime() - (2 + Math.floor(rand() * 10)) * day
    const total = lines.reduce((s, l) => s + l.ticket.price * l.qty, 0)
    const r = {
      id: `rsv_seed${++seq}`,
      code: extra.code || makeCode(),
      user_id: userId,
      destination_id: d.id,
      visit_date: date,
      total_qty: lines.reduce((s, l) => s + l.qty, 0),
      total_amount: total,
      status,
      contact_name: u.name,
      contact_email: u.email,
      contact_phone: u.phone,
      expires_at: dt(extra.expires ?? created + 3_600_000),
      cancel_reason: status === 'DIBATALKAN' ? 'Batas waktu pembayaran terlewati' : null,
      checked_in_at: status === 'SUDAH_DIGUNAKAN' ? new Date(`${date}T03:30:00Z`) : null,
      created_at: dt(created),
    }
    reservations.push(r)
    for (const l of lines) items.push([r.id, l.ticket.id, l.ticket.name, l.ticket.price, l.qty])
    if (status === 'LUNAS' || status === 'SUDAH_DIGUNAKAN') {
      const free = total === 0
      payments.push([
        `pay_seed${seq}`, r.id, `${r.code}-1`, free ? 'gratis' : 'simulasi',
        free ? 'gratis' : pick(rand, ['bca_va', 'qris', 'gopay', 'bri_va', 'shopeepay']),
        'BERHASIL', total, dt(created + 600_000),
      ])
    }
    return r
  }

  const reviewersFor = () => `usr_r${Math.floor(rand() * REVIEWERS.length)}`

  for (const d of DESTINATIONS.filter((x) => !x.status || x.status === 'AKTIF')) {
    const visits = 10 + Math.floor(rand() * 10)
    for (let i = 0; i < visits; i++) {
      const date = addDays(today, -Math.floor(rand() * 60) - 1)
      const reviewer = reviewersFor()
      const status = rand() < 0.12 && d.tickets[0].price > 0 ? 'DIBATALKAN' : 'SUDAH_DIGUNAKAN'
      const plan = [1 + Math.floor(rand() * 3), rand() < 0.5 ? Math.floor(rand() * 3) : 0, rand() < 0.1 ? 1 : 0]
      const r = addReservation(d, reviewer, date, status, plan)
      if (status === 'SUDAH_DIGUNAKAN' && rand() < 0.75) {
        const roll = rand()
        const rating = roll < 0.62 ? 5 : roll < 0.92 ? 4 : 3
        const replied = rand() < 0.3
        reviews.push([
          `rvw_seed${reviews.length + 1}`, r.id, d.id, reviewer, rating, pick(rand, COMMENTS[rating]), date,
          replied ? 'Terima kasih atas kunjungan dan ulasannya. Sampai jumpa kembali!' : null,
          replied ? 'Pengelola' : null,
          replied ? new Date(`${date}T14:00:00Z`) : null,
          new Date(`${date}T12:00:00Z`),
        ])
      }
    }
    const upcoming = 3 + Math.floor(rand() * 4)
    for (let i = 0; i < upcoming; i++) {
      addReservation(d, reviewersFor(), addDays(today, Math.floor(rand() * 14)), 'LUNAS', [1 + Math.floor(rand() * 4), Math.floor(rand() * 2)])
    }
  }

  // Reservasi akun demo Wisatawan, mewakili setiap status.
  const demo = 'usr_demo'
  addReservation(destById.dst_keraton, demo, today, 'LUNAS', [2, 1], { code: DEMO_CHECKIN_CODE })
  addReservation(destById.dst_lokananta, demo, addDays(today, 5), 'LUNAS', [2])
  addReservation(destById.dst_mangkunegaran, demo, addDays(today, -9), 'SUDAH_DIGUNAKAN', [2])
  const reviewed = addReservation(destById.dst_balekambang, demo, addDays(today, -21), 'SUDAH_DIGUNAKAN', [2, 2])
  reviews.push([
    `rvw_seed${reviews.length + 1}`, reviewed.id, reviewed.destination_id, demo, 5,
    'Taman yang asri dan teduh. Anak-anak senang memberi makan rusa. Cocok untuk piknik keluarga di akhir pekan.',
    reviewed.visit_date, 'Terima kasih, Kak Dimas! Senang keluarga menikmati Balekambang.', 'Bambang Haryanto',
    dt(now - 19 * day), dt(now - 20 * day),
  ])
  addReservation(destById.dst_radyapustaka, demo, addDays(today, -3), 'DIBATALKAN', [3])
  addReservation(destById.dst_jurug, demo, addDays(today, 2), 'MENUNGGU_PEMBAYARAN', [2, 2], {
    created: now - 20 * 60_000,
    expires: now + 40 * 60_000,
  })

  const userRows = []
  for (const u of users) {
    userRows.push([u.id, u.name, u.email, u.phone, await hash(u.password), u.role, u.active === false ? 0 : 1, dt(u.created), dt(u.created)])
  }

  await transaction(async (c) => {
    await c.query('SET FOREIGN_KEY_CHECKS = 0')
    for (const t of ['sessions', 'reviews', 'payments', 'reservation_items', 'reservations', 'ticket_types', 'destination_managers', 'destinations', 'users']) {
      await c.query(`DELETE FROM \`${t}\``)
    }
    await c.query('SET FOREIGN_KEY_CHECKS = 1')

    await c.query(
      'INSERT INTO users (id, name, email, phone, password_hash, role, active, email_verified_at, created_at) VALUES ?',
      [userRows],
    )
    await c.query(
      `INSERT INTO destinations (id, slug, name, category, area, short, description, address, lat, lng, photos, facilities,
        hours_open, hours_close, closed_days, holidays, daily_quota, status, created_at) VALUES ?`,
      [
        DESTINATIONS.map((d) => [
          d.id, d.slug, d.name, d.category, d.area, d.short, d.description, d.address, d.lat, d.lng,
          JSON.stringify(d.photos), JSON.stringify(d.facilities), d.hours.open, d.hours.close,
          JSON.stringify(d.closedDays), JSON.stringify(d.holidays), d.dailyQuota, d.status || 'AKTIF', dt(now - 120 * day),
        ]),
      ],
    )
    await c.query('INSERT INTO ticket_types (id, destination_id, name, price, description, position) VALUES ?', [
      DESTINATIONS.flatMap((d) => d.tickets.map((t, i) => [t.id, d.id, t.name, t.price, t.desc, i])),
    ])
    await c.query('INSERT INTO destination_managers (user_id, destination_id) VALUES ?', [
      users.flatMap((u) => (u.destinations || []).map((dId) => [u.id, dId])),
    ])
    const cols = Object.keys(reservations[0])
    await c.query(`INSERT INTO reservations (${cols.join(', ')}) VALUES ?`, [reservations.map((r) => cols.map((k) => r[k]))])
    await c.query('INSERT INTO reservation_items (reservation_id, ticket_type_id, name, price, qty) VALUES ?', [items])
    await c.query(
      'INSERT INTO payments (id, reservation_id, order_id, provider, method, status, gross_amount, paid_at) VALUES ?',
      [payments],
    )
    await c.query(
      `INSERT INTO reviews (id, reservation_id, destination_id, user_id, rating, comment, visit_date, reply_text, reply_by, replied_at, created_at) VALUES ?`,
      [reviews],
    )
  })
  log(`Seed selesai: ${users.length} pengguna, ${DESTINATIONS.length} destinasi, ${reservations.length} reservasi, ${reviews.length} ulasan.`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seed()
    .then(() => pool.end())
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
