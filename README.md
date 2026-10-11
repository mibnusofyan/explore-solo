# Explore Solo

Sistem reservasi destinasi wisata Kota Surakarta, sesuai SRS versi 1.0 (10 Oktober 2026).

| Bagian | Teknologi |
|---|---|
| `frontend/` | React 19 + Tailwind CSS 4 (Vite), tampilan mengacu pola desain Airbnb |
| `backend/` | Express 5, pola MVC (model · controller · route), REST API JSON |
| Basis data | MySQL 8.0 |
| Layanan pihak ketiga | Midtrans Snap (pembayaran), Leaflet + OpenStreetMap (peta), SMTP (email) |

## Menjalankan di komputer sendiri

Butuh **Node.js 22** (minimal 20.19) dan **MySQL 8.0**.

1. Buat basis data dan pengguna MySQL:

   ```sql
   CREATE DATABASE explore_solo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE DATABASE explore_solo_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER 'explore_solo'@'localhost' IDENTIFIED BY 'explore_solo_dev';
   GRANT ALL PRIVILEGES ON explore_solo.* TO 'explore_solo'@'localhost';
   GRANT ALL PRIVILEGES ON explore_solo_test.* TO 'explore_solo'@'localhost';
   ```

2. Pasang dependensi, siapkan konfigurasi, isi data demo:

   ```bash
   npm run setup                              # install root, backend, frontend
   cp backend/.env.example backend/.env       # sesuaikan DB_PASSWORD bila berbeda
   npm run db:reset                           # buat tabel + data demo
   ```

3. Jalankan backend dan frontend sekaligus:

   ```bash
   npm run dev
   ```

   Buka **http://localhost:5173**. API berjalan di http://localhost:4000; Vite meneruskan `/api` dan `/uploads` ke sana, sehingga cookie sesi berada di origin yang sama.

### Akun demo

| Peran | Email | Password |
|---|---|---|
| Wisatawan | `wisatawan@exploresolo.id` | `wisata123` |
| Pengelola Destinasi | `pengelola@exploresolo.id` | `pengelola123` |
| Pengelola Destinasi (Mangkunegaran dkk.) | `mangkunegaran@exploresolo.id` | `pengelola123` |
| Admin | `admin@exploresolo.id` | `admin12345` |

Kode booking `ES-HR7K2M` adalah tiket Keraton untuk **hari ini** (tanggal seed), untuk mencoba check-in. Jalankan `npm run db:reset` kapan saja untuk mengembalikan data demo; tanggal reservasi dibuat relatif terhadap hari itu.

### Perintah lain

| Perintah | Fungsi |
|---|---|
| `npm test` | Uji integrasi API (26 skenario) terhadap database `explore_solo_test` |
| `npm run lint` | ESLint backend dan frontend |
| `npm run build` lalu `npm start` | Mode satu server: Express melayani hasil build React di port 4000 |

## Pembayaran dan email

- **Tanpa kunci Midtrans** (bawaan pengembangan), halaman pembayaran memakai mode simulasi: pilih metode, lalu "Saya sudah membayar" atau "Simulasikan pembayaran ditolak". Simulasi otomatis mati di produksi.
- **Dengan Midtrans sandbox**: isi `MIDTRANS_SERVER_KEY` dan `MIDTRANS_CLIENT_KEY` di `backend/.env` (dashboard sandbox → Settings → Access Keys). Halaman pembayaran membuka Snap. Daftarkan Notification URL `https://<domain>/api/payments/midtrans/notification` di dashboard Midtrans; server memverifikasi `signature_key` dan nominal sebelum mengubah status. Bila notifikasi belum sampai (mis. di localhost), status disinkronkan dengan menanyakan Midtrans saat pengguna kembali ke halaman.
- **Email** verifikasi akun dan e-tiket (dengan lampiran PDF dan QR) dikirim lewat SMTP bila `SMTP_HOST` diisi; tanpa SMTP, isi email dicetak ke konsol backend.

## Struktur

```
backend/
  src/config/          konfigurasi dari variabel lingkungan
  src/db/              koneksi pool, schema.sql, migrasi, seed data demo
  src/models/          query SQL per entitas (users, destinations, reservations, reviews)
  src/controllers/     logika tiap fitur SRS
  src/routes/          daftar endpoint + middleware role
  src/middleware/      sesi MySQL, CSRF, RBAC, validasi zod, upload, error
  src/services/        Midtrans, email, PDF e-tiket, ekspor laporan (PDF/Excel)
  test/                uji integrasi node:test + supertest
frontend/
  src/services/api.js  klien REST (cookie sesi + token CSRF)
  src/pages/           halaman publik & wisatawan, pengelola/, admin/, shared/
  src/components/      header, kartu, peta, UI dasar
  public/images/       foto destinasi (Wikimedia Commons)
```

## Endpoint API

| SRS | Endpoint | Akses |
|---|---|---|
| 3.1, 3.2 | `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `GET /api/auth/csrf`, `GET /api/auth/verify-email` | publik |
| 3.12 | `PATCH /api/me`, `PUT /api/me/password`, `POST /api/me/avatar` | login |
| 3.3, 3.4 | `GET /api/destinations?q=&category=&minPrice=&maxPrice=&minRating=&sort=&date=&guests=`, `GET /api/destinations/:slug`, `GET /api/destinations/:slug/availability?date=`, `GET /api/destinations/:id/reviews` | publik |
| 3.5, 3.7 | `POST /api/reservations`, `GET /api/reservations`, `GET /api/reservations/:id`, `POST /api/reservations/:id/cancel`, `GET /api/reservations/:id/ticket.pdf` | wisatawan |
| 3.6 | `POST /api/reservations/:id/payment`, `…/payment/simulate`, `…/payment/sync`; webhook `POST /api/payments/midtrans/notification` | wisatawan / Midtrans |
| 3.8 | `POST /api/manager/check-in` | pengelola |
| 3.9 | `GET/POST /api/manager/destinations`, `GET/PUT /api/manager/destinations/:id`, `POST /api/manager/uploads/photo`; `GET /api/admin/destinations`, `POST /api/admin/destinations/:id/verify`, `PATCH /api/admin/destinations/:id/status` | pengelola / admin |
| 3.10 | `GET /api/reports/reservations?from=&to=&status=&destinationId=&format=json\|xlsx\|pdf` | pengelola (destinasinya) / admin |
| 3.11 | `POST /api/reservations/:id/review`, `GET /api/manager/reviews`, `POST /api/manager/reviews/:id/reply` | wisatawan / pengelola |
| 3.13 | `GET/POST /api/admin/users`, `PUT /api/admin/users/:id`, `PATCH /api/admin/users/:id/status` | admin |

Galat dikembalikan sebagai `{ message, fields? }` dengan status 401/403/404/409/410/422.

## Aturan bisnis dan keamanan

- **Kuota**: dihitung dari reservasi yang belum dibatalkan dan belum kedaluwarsa. Pembuatan reservasi mengunci baris destinasi (`SELECT … FOR UPDATE`), sehingga pemesanan bersamaan tidak melampaui kuota (ada ujinya).
- **Batas bayar 60 menit**: reservasi `MENUNGGU_PEMBAYARAN` dibatalkan otomatis oleh tugas berkala tiap menit dan sebelum kuota dihitung; kuotanya kembali.
- **Check-in** hanya untuk tiket `LUNAS`, di destinasi milik pengelola tersebut, pada tanggal kunjungan hari ini (WIB), dan hanya sekali.
- **Perubahan destinasi aktif** disimpan sebagai `pending_changes` sampai disetujui Admin; jenis tiket lama dinonaktifkan, tidak dihapus, agar riwayat reservasi tetap utuh.
- **Keamanan (SRS 2.5)**: password di-hash bcrypt; sesi di tabel MySQL dengan cookie httpOnly/SameSite (Secure di produksi) dan ID sesi diganti saat login; token CSRF wajib di setiap permintaan yang mengubah data; RBAC di setiap endpoint; akun yang dinonaktifkan langsung kehilangan sesinya; rate limit untuk login/registrasi; header keamanan helmet + CSP; unggahan dibatasi JPG/PNG/WebP dan ukuran.

## Deploy

Jalankan di belakang Nginx dengan HTTPS (cookie sesi bertanda Secure di produksi). Contoh:

```bash
npm run build
NODE_ENV=production SESSION_SECRET=<acak> APP_URL=https://exploresolo.id npm start
```

Express melayani React dan API dari satu origin. Folder `backend/uploads/` berisi foto unggahan dan perlu dicadangkan.

## Catatan

- SRS Tabel 2.2 menyebut server PHP 8.2, sedangkan Tabel 2.3 memilih Express JS. Implementasi ini memakai Express (Node.js); baris PHP pada Tabel 2.2 sebaiknya diperbarui.
- Harga, jam buka, dan kuota pada data demo bersifat ilustratif.
- `npm audit` di backend melaporkan 2 kerentanan tingkat moderate pada `uuid` lama yang dibawa `exceljs`; fungsi yang terdampak (v3/v5/v6 dengan buffer) tidak dipakai di aplikasi ini.
- Foto destinasi dari Wikimedia Commons (CC0, CC BY, CC BY-SA); pembuat dan sumber tercantum di halaman `/kredit-foto` dan galeri tiap destinasi. Peta © kontributor OpenStreetMap.
