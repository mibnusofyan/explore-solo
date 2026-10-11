import { after, before, beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { ACCOUNTS, addDays, agent, app, nextOpenDay, nextWeekday, outbox, pool, resetDatabase, todayWIB } from './helpers.js'

before(resetDatabase)
after(() => pool.end())

describe('Autentikasi (SRS 3.1, 3.2)', () => {
  test('registrasi menolak data tidak valid dan email terdaftar', async () => {
    const a = await agent()
    let res = await a.post('/api/auth/register').send({ name: '', email: 'bukan-email', phone: '123', password: 'pendek', confirm: 'x' })
    assert.equal(res.status, 422)
    assert.ok(res.body.fields.name && res.body.fields.email && res.body.fields.phone && res.body.fields.password)
    res = await a.post('/api/auth/register').send({ name: 'A', email: 'wisatawan@exploresolo.id', phone: '081234567891', password: 'rahasia123', confirm: 'rahasia123' })
    assert.equal(res.status, 422)
    assert.equal(res.body.fields.email, 'Email sudah terdaftar.')
  })

  test('registrasi berhasil, email verifikasi terkirim, lalu bisa login', async () => {
    const a = await agent()
    outbox.length = 0
    const res = await a.post('/api/auth/register').send({ name: 'Rina Kusuma', email: 'Rina@Contoh.id', phone: '0812-3456-7000', password: 'rahasia123', confirm: 'rahasia123' })
    assert.equal(res.status, 201)
    assert.equal(res.body.user.role, 'wisatawan')
    assert.equal(res.body.user.email, 'rina@contoh.id')
    assert.equal(res.body.user.emailVerified, false)
    assert.match(outbox.at(-1).text, /verify-email\?token=[a-f0-9]{48}/)
    const token = outbox.at(-1).text.match(/token=([a-f0-9]+)/)[1]
    const v = await request(app).get(`/api/auth/verify-email?token=${token}`)
    assert.equal(v.status, 302)
    assert.match(v.headers.location, /verifikasi=berhasil/)
    const login = await a.login('rina@contoh.id', 'rahasia123')
    assert.equal(login.status, 200)
    assert.equal(login.body.user.emailVerified, true)
  })

  test('login gagal untuk password salah dan akun nonaktif', async () => {
    const a = await agent()
    assert.equal((await a.login('wisatawan@exploresolo.id', 'salah-sekali')).status, 401)
    assert.equal((await a.login('tidak.ada@contoh.id', 'apa-saja1')).status, 401)
    const res = await a.login('oktaviani.putri@contoh.id', 'password123')
    assert.equal(res.status, 403)
    assert.match(res.body.message, /tidak aktif/)
  })

  test('permintaan yang mengubah data tanpa token CSRF ditolak', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: ACCOUNTS.admin[0], password: ACCOUNTS.admin[1] })
    assert.equal(res.status, 403)
    assert.equal(res.body.code, 'CSRF')
  })

  test('RBAC: tamu 401, wisatawan tidak bisa membuka fitur admin/pengelola', async () => {
    assert.equal((await request(app).get('/api/reservations')).status, 401)
    const w = await agent(...ACCOUNTS.wisatawan)
    assert.equal((await w.get('/api/admin/users')).status, 403)
    assert.equal((await w.post('/api/manager/check-in').send({ code: 'ES-HR7K2M' })).status, 403)
    const p = await agent(...ACCOUNTS.pengelola)
    assert.equal((await p.get('/api/admin/destinations')).status, 403)
    assert.equal((await p.post('/api/reservations').send({})).status, 403)
  })

  test('profil: ubah data, ganti password dengan password lama yang benar', async () => {
    const a = await agent('ayu.lestari@contoh.id', 'password123')
    let res = await a.patch('/api/me').send({ name: 'Ayu L.', phone: '081311112222' })
    assert.equal(res.status, 200)
    assert.equal(res.body.user.name, 'Ayu L.')
    res = await a.put('/api/me/password').send({ oldPassword: 'keliru123', newPassword: 'baru12345', confirm: 'baru12345' })
    assert.equal(res.status, 422)
    assert.equal(res.body.fields.oldPassword, 'Password lama salah.')
    res = await a.put('/api/me/password').send({ oldPassword: 'password123', newPassword: 'baru12345', confirm: 'baru12345' })
    assert.equal(res.status, 204)
    assert.equal((await (await agent()).login('ayu.lestari@contoh.id', 'baru12345')).status, 200)
  })
})

describe('Pencarian dan detail destinasi (SRS 3.3, 3.4)', () => {
  test('filter kategori, harga, rating, dan urutan', async () => {
    let res = await request(app).get('/api/destinations?category=religi')
    assert.equal(res.status, 200)
    assert.ok(res.body.items.length >= 2)
    assert.ok(res.body.items.every((d) => d.category === 'religi'))
    res = await request(app).get('/api/destinations?minPrice=0&maxPrice=0')
    assert.ok(res.body.items.every((d) => d.minPrice === 0))
    res = await request(app).get('/api/destinations?sort=harga-tertinggi')
    const prices = res.body.items.map((d) => d.minPrice)
    assert.deepEqual(prices, [...prices].sort((a, b) => b - a))
    res = await request(app).get('/api/destinations?q=tidak-ada-destinasi-ini')
    assert.deepEqual(res.body.items, [])
  })

  test('destinasi yang belum aktif tidak tampil publik', async () => {
    const res = await request(app).get('/api/destinations/monumen-pers-nasional')
    assert.equal(res.status, 404)
    const list = await request(app).get('/api/destinations?q=Monumen')
    assert.equal(list.body.items.length, 0)
  })

  test('ketersediaan memperhitungkan hari tutup', async () => {
    const friday = nextWeekday(5)
    const res = await request(app).get(`/api/destinations/keraton-kasunanan-surakarta/availability?date=${friday}`)
    assert.equal(res.body.availability.open, false)
    assert.match(res.body.availability.reason, /tutup/)
  })
})

describe('Reservasi, pembayaran, dan e-tiket (SRS 3.5–3.7)', () => {
  const date = () => nextOpenDay([5])
  const book = (a, body) =>
    a.post('/api/reservations').send({
      destinationId: 'dst_keraton',
      date: date(),
      quantities: { 'krt-dewasa': 2, 'krt-anak': 1 },
      contact: { name: 'Dimas Prasetyo', email: 'wisatawan@exploresolo.id', phone: '081234567890' },
      ...body,
    })

  test('menolak tanggal lampau, hari tutup, dan kuota kurang', async () => {
    const w = await agent(...ACCOUNTS.wisatawan)
    assert.equal((await book(w, { date: addDays(todayWIB(), -1) })).status, 409)
    assert.equal((await book(w, { date: nextWeekday(5) })).status, 409)
    await pool.query('UPDATE destinations SET daily_quota = 2 WHERE id = ?', ['dst_keraton'])
    const res = await book(w)
    assert.equal(res.status, 409)
    assert.match(res.body.message, /Kuota tidak mencukupi/)
    await pool.query('UPDATE destinations SET daily_quota = 400 WHERE id = ?', ['dst_keraton'])
    assert.equal((await book(w, { quantities: { 'tiket-asing': 1 } })).status, 422)
  })

  test('alur bayar berhasil: Menunggu Pembayaran → Lunas, e-tiket terkirim, PDF tersedia', async () => {
    const w = await agent(...ACCOUNTS.wisatawan)
    const res = await book(w)
    assert.equal(res.status, 201)
    const r = res.body.reservation
    assert.equal(r.status, 'MENUNGGU_PEMBAYARAN')
    assert.equal(r.total, 2 * 20000 + 10000)
    assert.match(r.code, /^ES-[A-Z2-9]{6}$/)
    assert.ok(r.expiresAt - Date.now() > 59 * 60_000)

    const start = await w.post(`/api/reservations/${r.id}/payment`)
    assert.equal(start.body.mode, 'simulation')
    outbox.length = 0
    const paid = await w.post(`/api/reservations/${r.id}/payment/simulate`).send({ method: 'qris' })
    assert.equal(paid.status, 200)
    assert.equal(paid.body.reservation.status, 'LUNAS')
    assert.equal(paid.body.reservation.payment.method, 'qris')
    assert.equal(outbox.at(-1).to, 'wisatawan@exploresolo.id')
    assert.deepEqual(outbox.at(-1).attachments, [`e-tiket-${r.code}.pdf`, `qr-${r.code}.png`])

    const pdf = await w.get(`/api/reservations/${r.id}/ticket.pdf`)
    assert.equal(pdf.status, 200)
    assert.equal(pdf.headers['content-type'], 'application/pdf')
    assert.equal(pdf.body.subarray(0, 4).toString(), '%PDF')

    assert.equal((await w.post(`/api/reservations/${r.id}/cancel`)).status, 409)
    const other = await agent('bagus.santoso@contoh.id', 'password123')
    assert.equal((await other.get(`/api/reservations/${r.id}`)).status, 404)
  })

  test('pembayaran ditolak membatalkan reservasi dan mengembalikan kuota', async () => {
    const w = await agent(...ACCOUNTS.wisatawan)
    const before = (await request(app).get(`/api/destinations/keraton-kasunanan-surakarta/availability?date=${date()}`)).body.availability.remaining
    const r = (await book(w)).body.reservation
    const during = (await request(app).get(`/api/destinations/keraton-kasunanan-surakarta/availability?date=${date()}`)).body.availability.remaining
    assert.equal(during, before - 3)
    const res = await w.post(`/api/reservations/${r.id}/payment/simulate`).send({ method: 'gopay', outcome: 'failure' })
    assert.equal(res.body.reservation.status, 'DIBATALKAN')
    const after = (await request(app).get(`/api/destinations/keraton-kasunanan-surakarta/availability?date=${date()}`)).body.availability.remaining
    assert.equal(after, before)
  })

  test('reservasi yang melewati 60 menit otomatis dibatalkan', async () => {
    const w = await agent(...ACCOUNTS.wisatawan)
    const r = (await book(w)).body.reservation
    await pool.query('UPDATE reservations SET expires_at = UTC_TIMESTAMP() - INTERVAL 1 MINUTE WHERE id = ?', [r.id])
    const res = await w.get(`/api/reservations/${r.id}`)
    assert.equal(res.body.reservation.status, 'DIBATALKAN')
    assert.equal(res.body.reservation.cancelReason, 'Batas waktu pembayaran terlewati')
    assert.equal((await w.post(`/api/reservations/${r.id}/payment/simulate`).send({ method: 'qris' })).status, 410)
  })

  test('wisatawan membatalkan reservasi yang belum dibayar', async () => {
    const w = await agent(...ACCOUNTS.wisatawan)
    const r = (await book(w)).body.reservation
    const res = await w.post(`/api/reservations/${r.id}/cancel`)
    assert.equal(res.body.reservation.status, 'DIBATALKAN')
    const list = (await w.get('/api/reservations')).body.reservations
    assert.ok(list.some((x) => x.id === r.id && x.status === 'DIBATALKAN'))
  })

  test('tiket gratis langsung lunas', async () => {
    const w = await agent(...ACCOUNTS.wisatawan)
    const res = await w.post('/api/reservations').send({
      destinationId: 'dst_sheikhzayed',
      date: addDays(todayWIB(), 3),
      quantities: { 'msz-umum': 4 },
      contact: { name: 'Dimas', email: 'wisatawan@exploresolo.id', phone: '081234567890' },
    })
    assert.equal(res.status, 201)
    assert.equal(res.body.reservation.status, 'LUNAS')
    assert.equal(res.body.reservation.total, 0)
  })

  test('pemesanan bersamaan tidak melampaui kuota', async () => {
    await pool.query('UPDATE destinations SET daily_quota = 5 WHERE id = ?', ['dst_lokananta'])
    const d = nextOpenDay([1])
    const users = await Promise.all(['citra.maharani', 'dewi.anggraini', 'eko.prasetyo', 'fajar.nugroho'].map((u) => agent(`${u}@contoh.id`, 'password123')))
    const results = await Promise.all(
      users.map((a) =>
        a.post('/api/reservations').send({
          destinationId: 'dst_lokananta',
          date: d,
          quantities: { 'lkn-dewasa': 2 },
          contact: { name: 'Uji', email: 'uji@contoh.id', phone: '081200001111' },
        }),
      ),
    )
    const ok = results.filter((r) => r.status === 201).length
    assert.equal(ok, 2, `seharusnya hanya 2 reservasi (4 tiket) yang muat dalam kuota 5, didapat ${ok}`)
    assert.ok(results.filter((r) => r.status !== 201).every((r) => r.status === 409))
    await pool.query('UPDATE destinations SET daily_quota = 300 WHERE id = ?', ['dst_lokananta'])
  })
})

describe('Check-in, ulasan, dan balasan (SRS 3.8, 3.11)', () => {
  test('check-in valid sekali, ditolak bila diulang atau bukan destinasinya', async () => {
    const other = await agent(...ACCOUNTS.pengelola2)
    let res = await other.post('/api/manager/check-in').send({ code: 'ES-HR7K2M' })
    assert.equal(res.body.valid, false)
    assert.match(res.body.reason, /bukan untuk destinasi/)

    const p = await agent(...ACCOUNTS.pengelola)
    res = await p.post('/api/manager/check-in').send({ code: 'es-hr7k2m' })
    assert.equal(res.body.valid, true)
    assert.equal(res.body.reservation.status, 'SUDAH_DIGUNAKAN')
    assert.equal(res.body.reservation.contact.name, 'Dimas Prasetyo')
    res = await p.post('/api/manager/check-in').send({ code: 'ES-HR7K2M' })
    assert.equal(res.body.valid, false)
    assert.match(res.body.reason, /sudah digunakan/)
    res = await p.post('/api/manager/check-in').send({ code: 'ES-ZZZZZZ' })
    assert.equal(res.body.reason, 'Kode booking tidak ditemukan.')
  })

  test('check-in menolak tiket di luar tanggal kunjungan', async () => {
    const [[r]] = await pool.query(
      `SELECT code FROM reservations WHERE destination_id = 'dst_lokananta' AND status = 'LUNAS' AND visit_date > ? LIMIT 1`,
      [todayWIB()],
    )
    const p = await agent(...ACCOUNTS.pengelola2)
    const res = await p.post('/api/manager/check-in').send({ code: r.code })
    assert.equal(res.body.valid, false)
    assert.match(res.body.reason, /bukan hari ini/)
  })

  test('ulasan hanya untuk tiket yang sudah digunakan, satu kali, lalu dibalas pengelola', async () => {
    const w = await agent(...ACCOUNTS.wisatawan)
    const list = (await w.get('/api/reservations')).body.reservations
    const lunas = list.find((r) => r.status === 'LUNAS')
    assert.equal((await w.post(`/api/reservations/${lunas.id}/review`).send({ rating: 5 })).status, 409)

    const keraton = list.find((r) => r.code === 'ES-HR7K2M')
    assert.equal(keraton.status, 'SUDAH_DIGUNAKAN')
    assert.equal((await w.post(`/api/reservations/${keraton.id}/review`).send({ rating: 0 })).status, 422)
    assert.equal((await w.post(`/api/reservations/${keraton.id}/review`).send({ rating: 4, comment: 'x'.repeat(501) })).status, 422)
    const res = await w.post(`/api/reservations/${keraton.id}/review`).send({ rating: 4, comment: 'Pendapanya megah.' })
    assert.equal(res.status, 201)
    assert.equal((await w.post(`/api/reservations/${keraton.id}/review`).send({ rating: 5 })).status, 409)

    const other = await agent(...ACCOUNTS.pengelola2)
    assert.equal((await other.post(`/api/manager/reviews/${res.body.review.id}/reply`).send({ text: 'Halo' })).status, 404)
    const p = await agent(...ACCOUNTS.pengelola)
    const reply = await p.post(`/api/manager/reviews/${res.body.review.id}/reply`).send({ text: 'Terima kasih!' })
    assert.equal(reply.body.review.reply.text, 'Terima kasih!')
    const pub = await request(app).get('/api/destinations/dst_keraton/reviews')
    assert.equal(pub.body.reviews[0].reply.by, 'Sri Handayani')
  })
})

describe('Kelola destinasi dan verifikasi Admin (SRS 3.9)', () => {
  let p
  let admin
  beforeEach(async () => {
    p = await agent(...ACCOUNTS.pengelola)
    admin = await agent(...ACCOUNTS.admin)
  })

  test('validasi data destinasi', async () => {
    const res = await p.post('/api/manager/destinations').send({ name: '', photos: [], tickets: [], hours: { open: '10:00', close: '09:00' } })
    assert.equal(res.status, 422)
    for (const f of ['name', 'category', 'description', 'photos', 'tickets', 'hours', 'location']) assert.ok(res.body.fields[f], f)
  })

  test('perubahan destinasi aktif menunggu verifikasi; disetujui Admin baru tampil publik', async () => {
    const d = (await p.get('/api/manager/destinations/dst_keraton')).body.destination
    const edited = { ...d, name: 'Keraton Surakarta Hadiningrat', tickets: [...d.tickets, { name: 'Pelajar', price: 7500, desc: 'Kartu pelajar' }] }
    let res = await p.put('/api/manager/destinations/dst_keraton').send(edited)
    assert.equal(res.status, 200)
    assert.equal(res.body.destination.pendingChanges.name, 'Keraton Surakarta Hadiningrat')
    assert.equal((await request(app).get('/api/destinations/keraton-kasunanan-surakarta')).body.destination.name, 'Keraton Kasunanan Surakarta')

    res = await admin.post('/api/admin/destinations/dst_keraton/verify').send({ approve: false, note: '' })
    assert.equal(res.status, 422)
    res = await admin.post('/api/admin/destinations/dst_keraton/verify').send({ approve: true })
    assert.equal(res.body.destination.pendingChanges, null)
    const pub = (await request(app).get('/api/destinations/keraton-kasunanan-surakarta')).body.destination
    assert.equal(pub.name, 'Keraton Surakarta Hadiningrat')
    assert.equal(pub.tickets.length, 4)
    assert.equal(pub.tickets[3].name, 'Pelajar')
  })

  test('destinasi baru ditolak dengan catatan lalu diajukan ulang', async () => {
    const body = {
      name: 'Solo Techno Park',
      category: 'edukasi-museum',
      description: 'Kawasan sains dan teknologi dengan wahana edukasi untuk pelajar dan keluarga.',
      address: 'Jl. Ki Hajar Dewantara, Jebres, Surakarta',
      lat: -7.5594,
      lng: 110.8569,
      photos: [{ src: '/images/jurug-1.jpg' }],
      hours: { open: '08:00', close: '15:00' },
      tickets: [{ name: 'Umum', price: 15000 }],
      dailyQuota: 100,
    }
    let res = await p.post('/api/manager/destinations').send(body)
    assert.equal(res.status, 201)
    const id = res.body.destination.id
    assert.equal(res.body.destination.status, 'MENUNGGU_VERIFIKASI')
    assert.ok((await p.get('/api/manager/destinations')).body.destinations.some((d) => d.id === id))

    res = await admin.post(`/api/admin/destinations/${id}/verify`).send({ approve: false, note: 'Foto belum sesuai lokasi.' })
    assert.equal(res.body.destination.status, 'DITOLAK')
    assert.equal(res.body.destination.reviewNote, 'Foto belum sesuai lokasi.')
    res = await p.put(`/api/manager/destinations/${id}`).send(body)
    assert.equal(res.body.destination.status, 'MENUNGGU_VERIFIKASI')
    assert.equal(res.body.destination.reviewNote, null)
    res = await admin.post(`/api/admin/destinations/${id}/verify`).send({ approve: true })
    assert.equal(res.body.destination.status, 'AKTIF')
  })

  test('pengelola tidak bisa mengubah destinasi milik orang lain', async () => {
    const d = (await p.get('/api/manager/destinations/dst_keraton')).body.destination
    const res = await p.put('/api/manager/destinations/dst_jurug').send(d)
    assert.equal(res.status, 404)
  })

  test('unggah foto destinasi: format salah ditolak', async () => {
    let res = await p.upload('/api/manager/uploads/photo', 'photo', Buffer.from('bukan gambar'), { filename: 'a.txt', contentType: 'text/plain' })
    assert.equal(res.status, 422)
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
    res = await p.upload('/api/manager/uploads/photo', 'photo', png, { filename: 'a.png', contentType: 'image/png' })
    assert.equal(res.status, 201)
    assert.match(res.body.photo.src, /^\/uploads\/destinations\/img_\w+\.png$/)
    assert.equal((await request(app).get(res.body.photo.src)).status, 200)
  })
})

describe('Laporan dan kelola pengguna (SRS 3.10, 3.13)', () => {
  test('laporan pengelola terbatas pada destinasinya; ekspor Excel dan PDF', async () => {
    const p = await agent(...ACCOUNTS.pengelola)
    const from = addDays(todayWIB(), -60)
    const to = addDays(todayWIB(), 30)
    let res = await p.get(`/api/reports/reservations?from=${from}&to=${to}`)
    assert.equal(res.status, 200)
    const mine = new Set(['dst_keraton', 'dst_radyapustaka', 'dst_vastenburg', 'dst_monpers'])
    assert.ok(res.body.rows.length > 0)
    assert.ok(res.body.rows.every((r) => mine.has(r.destinationId)))
    const s = res.body.summary
    assert.equal(s.reservations, res.body.rows.length)
    assert.ok(s.revenue > 0 && s.visitors > 0)
    assert.equal((await p.get('/api/reports/reservations?destinationId=dst_jurug')).status, 403)

    res = await p.get(`/api/reports/reservations?from=${from}&to=${to}&format=xlsx`).buffer(true).parse((r, cb) => {
      const chunks = []
      r.on('data', (c) => chunks.push(c))
      r.on('end', () => cb(null, Buffer.concat(chunks)))
    })
    assert.match(res.headers['content-type'], /spreadsheetml/)
    assert.equal(res.body.subarray(0, 2).toString(), 'PK')
    res = await p.get(`/api/reports/reservations?from=${from}&to=${to}&format=pdf`)
    assert.equal(res.headers['content-type'], 'application/pdf')

    const admin = await agent(...ACCOUNTS.admin)
    const all = (await admin.get(`/api/reports/reservations?from=${from}&to=${to}`)).body
    assert.ok(all.summary.reservations > s.reservations)
  })

  test('Admin membuat akun pengelola tertaut destinasi, lalu menonaktifkannya', async () => {
    const admin = await agent(...ACCOUNTS.admin)
    let res = await admin.post('/api/admin/users').send({ name: 'Pengelola Baru', email: 'baru@exploresolo.id', phone: '081299990000', role: 'pengelola', password: 'awal12345', destinationIds: [] })
    assert.equal(res.status, 422)
    assert.ok(res.body.fields.destinationIds)
    res = await admin.post('/api/admin/users').send({ name: 'Pengelola Baru', email: 'baru@exploresolo.id', phone: '081299990000', role: 'pengelola', password: 'awal12345', destinationIds: ['dst_pasargede'] })
    assert.equal(res.status, 201)
    const id = res.body.user.id
    assert.deepEqual(res.body.user.destinationIds, ['dst_pasargede'])

    const baru = await agent('baru@exploresolo.id', 'awal12345')
    assert.equal((await baru.get('/api/manager/destinations')).body.destinations[0].id, 'dst_pasargede')

    assert.equal((await admin.patch('/api/admin/users/usr_admin/status').send({ active: false })).status, 403)
    res = await admin.patch(`/api/admin/users/${id}/status`).send({ active: false })
    assert.equal(res.body.user.active, false)
    assert.equal((await baru.get('/api/manager/destinations')).status, 401)
    assert.equal((await (await agent()).login('baru@exploresolo.id', 'awal12345')).status, 403)
  })
})
