import { z } from 'zod'

// Aturan validasi bersama. Pesan galat dalam Bahasa Indonesia karena ditampilkan ke pengguna.
export const CATEGORIES = ['sejarah-budaya', 'religi', 'alam-taman', 'belanja-kuliner', 'edukasi-museum', 'rekreasi-keluarga']
export const FACILITIES = ['Parkir', 'Toilet', 'Mushola', 'Pemandu wisata', 'Kantin', 'Akses kursi roda', 'Area foto', 'Toko suvenir', 'Wi-Fi', 'Loker', 'Ruang menyusui', 'P3K']

const trimmed = (max, msg) => z.string({ error: msg }).trim().min(1, msg).max(max, `Maksimal ${max} karakter.`)

export const email = z.string({ error: 'Email wajib diisi.' }).trim().toLowerCase().email('Format email tidak valid.').max(190)
export const phone = z
  .string({ error: 'Nomor HP wajib diisi.' })
  .transform((s) => s.replace(/[\s-]/g, ''))
  .pipe(z.string().regex(/^(\+62|0)8\d{7,12}$/, 'Nomor HP tidak valid (contoh: 0812xxxxxxx).'))
export const password = z.string({ error: 'Password wajib diisi.' }).min(8, 'Password minimal 8 karakter.').max(72, 'Password maksimal 72 karakter.')
export const name = trimmed(120, 'Nama wajib diisi.')
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD.')
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Format jam HH:MM.')

export const registerSchema = z
  .object({ name, email, phone, password, confirm: z.string().optional() })
  .refine((d) => d.password === d.confirm, { path: ['confirm'], message: 'Konfirmasi password tidak sama.' })

export const loginSchema = z.object({
  email: z.string({ error: 'Email wajib diisi.' }).trim().toLowerCase().min(1, 'Email wajib diisi.'),
  password: z.string({ error: 'Password wajib diisi.' }).min(1, 'Password wajib diisi.'),
})

export const profileSchema = z.object({ name, phone })

export const passwordChangeSchema = z
  .object({ oldPassword: z.string().min(1, 'Password lama wajib diisi.'), newPassword: password, confirm: z.string().optional() })
  .refine((d) => d.newPassword === d.confirm, { path: ['confirm'], message: 'Konfirmasi password tidak sama.' })

const num = (schema) => z.preprocess((v) => (v === '' || v == null ? undefined : Number(v)), schema)

export const searchSchema = z.object({
  q: z.string().trim().max(100).optional().default(''),
  category: z.enum(CATEGORIES).optional().catch(undefined),
  minPrice: num(z.number().min(0).optional()),
  maxPrice: num(z.number().min(0).optional()),
  minRating: num(z.number().min(0).max(5).optional()),
  sort: z.enum(['rekomendasi', 'nama', 'harga-terendah', 'harga-tertinggi', 'rating']).optional().catch('rekomendasi'),
  date: isoDate.optional().catch(undefined),
  guests: num(z.number().int().min(0).max(100).optional()),
})

const photo = z.object({
  src: z.string().regex(/^\/(images|uploads)\/[\w./-]+$/, 'Foto tidak valid.'),
  credit: z.string().max(200).optional().default(''),
  source: z.string().max(500).optional().default(''),
})

export const destinationSchema = z.object({
    name: trimmed(160, 'Nama destinasi wajib diisi.'),
    category: z.enum(CATEGORIES, { error: 'Pilih kategori.' }),
    area: z.string().trim().max(120).optional().default(''),
    short: z.string().trim().max(160).optional().default(''),
    description: z.string({ error: 'Deskripsi wajib diisi.' }).trim().min(30, 'Deskripsi minimal 30 karakter.').max(5000),
    address: trimmed(255, 'Alamat wajib diisi.'),
    lat: num(z.number({ error: 'Tentukan titik koordinat lokasi.' }).min(-90).max(90)),
    lng: num(z.number({ error: 'Tentukan titik koordinat lokasi.' }).min(-180).max(180)),
    photos: z.array(photo).min(1, 'Unggah minimal satu foto.').max(8, 'Maksimal 8 foto.'),
    facilities: z.array(z.enum(FACILITIES)).max(FACILITIES.length).default([]),
    hours: z.object({ open: time, close: time }).refine((h) => h.open < h.close, 'Jam buka harus lebih awal dari jam tutup.'),
    closedDays: z.array(z.number().int().min(0).max(6)).max(7).default([]),
    holidays: z.array(isoDate).max(366).default([]),
    tickets: z
      .array(
        z.object({
          id: z.string().max(32).optional(),
          name: trimmed(80, 'Isi nama setiap jenis tiket.'),
          price: num(z.number({ error: 'Isi harga setiap jenis tiket.' }).int('Harga harus bilangan bulat.').min(0).max(10_000_000)),
          desc: z.string().trim().max(160).optional().default(''),
        }),
      )
      .min(1, 'Tambahkan minimal satu jenis tiket.')
      .max(10),
    dailyQuota: num(z.number({ error: 'Kuota harian harus lebih dari 0.' }).int().min(1, 'Kuota harian harus lebih dari 0.').max(100_000)),
  })

export const reservationSchema = z.object({
  destinationId: z.string().min(1).max(32),
  date: isoDate,
  quantities: z.record(z.string().max(32), z.number().int().min(0).max(20)),
  contact: z.object({ name, email, phone }),
})

export const reviewSchema = z.object({
  rating: z.number({ error: 'Beri rating 1 sampai 5 bintang.' }).int().min(1, 'Beri rating 1 sampai 5 bintang.').max(5),
  comment: z.string().trim().max(500, 'Ulasan maksimal 500 karakter.').optional().default(''),
})

export const reportQuerySchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  status: z.enum(['MENUNGGU_PEMBAYARAN', 'LUNAS', 'SUDAH_DIGUNAKAN', 'DIBATALKAN']).optional().catch(undefined),
  destinationId: z.string().max(32).optional(),
  format: z.enum(['json', 'xlsx', 'pdf']).optional().default('json'),
})

export const adminUserSchema = z.object({
  name,
  email,
  phone,
  role: z.enum(['wisatawan', 'pengelola', 'admin']),
  password: password.optional(),
  destinationIds: z.array(z.string().max(32)).default([]),
})
