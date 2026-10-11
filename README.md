# Explore Solo — Frontend

Frontend aplikasi **Explore Solo**, sistem reservasi destinasi wisata Kota Surakarta, sesuai dokumen SRS versi 1.0 (10 Oktober 2026). Dibangun dengan **React + Tailwind CSS** (SRS Tabel 2.3); tampilannya mengacu pada pola desain Airbnb: bilah pencarian berbentuk pil, tab kategori berikon, kartu foto persegi, galeri mosaik, kartu pemesanan yang menempel di samping, dan pin harga di peta.

Tahap ini **frontend saja**. Seluruh data berasal dari API tiruan di `src/services/api.js` yang disimpan di `localStorage`, sehingga semua alur bisa dicoba tanpa server. Saat backend Express + MySQL siap, cukup ganti isi berkas tersebut dengan pemanggilan `fetch` ke endpoint yang sama (lihat [Kontrak API](#kontrak-api-untuk-backend)).

## Menjalankan

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # hasil produksi di dist/
npm run lint
```

Butuh Node.js 20.19+ atau 22.12+ (syarat Vite 8).

### Akun demo

| Peran | Email | Password |
|---|---|---|
| Wisatawan | `wisatawan@exploresolo.id` | `wisata123` |
| Pengelola Destinasi | `pengelola@exploresolo.id` | `pengelola123` |
| Admin | `admin@exploresolo.id` | `admin12345` |

Tombol akun demo juga tersedia di halaman Masuk. Kode booking `ES-HR7K2M` adalah tiket Keraton untuk **hari ini** yang dapat dipakai menguji check-in. Data demo bisa dikembalikan ke kondisi awal lewat tautan **Atur ulang data demo** di footer.

## Pemetaan fitur SRS

| SRS | Fitur | Halaman / rute |
|---|---|---|
| 3.1 | Login (redirect sesuai role, akun nonaktif ditolak) | `/masuk` |
| 3.2 | Registrasi Wisatawan (validasi email, HP, password ≥ 8, konfirmasi) | `/daftar` |
| 3.3 | Pencarian: nama/area, kategori, rentang harga, rating, urutan; cek kuota per tanggal | `/` |
| 3.4 | Detail destinasi: galeri, peta Leaflet/OSM, jam buka, tiket, fasilitas, sisa kuota, ulasan | `/destinasi/:slug` |
| 3.5 | Reservasi: tanggal, jenis & jumlah tiket, validasi tanggal/kuota, kode booking, kuota ditahan 60 menit | kartu pemesanan → `/pesan/:slug` |
| 3.6 | Pembayaran (simulasi Midtrans Snap sandbox: VA, QRIS, e-wallet), sukses/gagal/kedaluwarsa | `/pembayaran/:id` |
| 3.7 | Riwayat reservasi per status, e-tiket QR, unduh PDF, batalkan yang belum dibayar | `/reservasi`, `/reservasi/:id` |
| 3.8 | Verifikasi tiket: pindai QR kamera (BarcodeDetector) atau input kode | `/pengelola/check-in` |
| 3.9 | Kelola destinasi (foto, koordinat via peta, fasilitas, jam, hari libur, tiket, kuota) + verifikasi Admin | `/pengelola/destinasi`, `/admin/destinasi` |
| 3.10 | Reservasi & laporan: filter tanggal/status/destinasi, rekap pengunjung & pendapatan, unduh Excel (CSV) / PDF | `/pengelola/reservasi`, `/admin/laporan` |
| 3.11 | Rating 1–5 + ulasan ≤ 500 karakter untuk tiket "Sudah Digunakan", sekali per reservasi; balasan pengelola | `/reservasi`, `/pengelola/ulasan` |
| 3.12 | Profil: nama, HP, foto, ganti password, logout | `/profil` |
| 3.13 | Kelola pengguna: buat akun Pengelola + tautkan destinasi, ubah, nonaktifkan/aktifkan | `/admin/pengguna` |

Ringkasan dasbor tambahan: `/pengelola` dan `/admin`. Halaman bantuan/FAQ (SRS 2.6): `/bantuan`.

## Struktur

```
src/
  services/api.js      API tiruan (auth, destinasi, reservasi, ulasan, pengguna)
  services/db.js       penyimpanan localStorage + reset
  data/destinations.js 13 destinasi contoh, kategori, fasilitas
  data/seed.js         pengguna, reservasi, dan ulasan awal (tanggal relatif hari ini)
  context/             sesi login (AuthContext) dan toast
  components/          Layout (header/footer), Guards (RBAC + layout dasbor), kartu, peta, UI dasar
  pages/               halaman publik & wisatawan
  pages/pengelola/     dasbor Pengelola Destinasi
  pages/admin/         dasbor Admin
  pages/shared/        laporan reservasi (dipakai Pengelola dan Admin)
  lib/                 format Rupiah/tanggal WIB, metode bayar, status, helper
public/images/         foto destinasi (Wikimedia Commons, diperkecil)
```

Aturan bisnis yang sudah ditegakkan di API tiruan dan harus diulang di backend: kuota dihitung dari reservasi yang belum dibatalkan; reservasi `MENUNGGU_PEMBAYARAN` kedaluwarsa setelah 60 menit dan kuotanya kembali; check-in hanya untuk tiket `LUNAS`, tanggal kunjungan hari ini, di destinasi milik pengelola tersebut; perubahan data destinasi yang sudah aktif disimpan sebagai `pendingChanges` sampai disetujui Admin. Pemeriksaan role di frontend (`RequireRole`) hanya untuk tampilan; backend tetap wajib memeriksa role di setiap endpoint.

## Kontrak API untuk backend

Usulan endpoint Express yang menggantikan fungsi di `src/services/api.js`:

| Fungsi tiruan | Endpoint |
|---|---|
| `auth.login`, `auth.register`, `auth.me` | `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/auth/me` |
| `auth.updateProfile`, `auth.changePassword` | `PATCH /api/me`, `PUT /api/me/password` |
| `destinations.search`, `destinations.get` | `GET /api/destinations?q=&category=&minPrice=&maxPrice=&minRating=&sort=`, `GET /api/destinations/:slug` |
| `destinations.availability` | `GET /api/destinations/:id/availability?date=` |
| `destinations.listManaged`, `getManaged`, `save` | `GET /api/manager/destinations`, `GET/POST/PUT /api/manager/destinations/:id` |
| `destinations.listAll`, `verify`, `setActive` | `GET /api/admin/destinations`, `POST /api/admin/destinations/:id/verify`, `PATCH /api/admin/destinations/:id` |
| `reservations.create`, `get`, `listMine`, `cancel` | `POST /api/reservations`, `GET /api/reservations/:id`, `GET /api/reservations`, `POST /api/reservations/:id/cancel` |
| `reservations.pay` | `POST /api/reservations/:id/pay` (Snap token) + webhook `POST /api/payments/midtrans/notification` |
| `reservations.checkIn` | `POST /api/manager/check-in` |
| `reservations.report` | `GET /api/reports/reservations?from=&to=&status=&destinationId=` (+ `format=pdf|xlsx`) |
| `reviews.forDestination`, `create`, `forManager`, `reply` | `GET /api/destinations/:id/reviews`, `POST /api/reservations/:id/review`, `GET /api/manager/reviews`, `POST /api/reviews/:id/reply` |
| `users.list`, `save`, `setActive` | `GET/POST /api/admin/users`, `PUT /api/admin/users/:id`, `PATCH /api/admin/users/:id` |

Respons galat sebaiknya berbentuk `{ message, fields }` dengan status HTTP 401/403/404/409/422, sama seperti `ApiError` di frontend.

## Yang masih disimulasikan

- **Pembayaran**: tombol "Saya sudah membayar" dan "Simulasikan pembayaran ditolak" menggantikan notifikasi Midtrans.
- **Email** verifikasi dan e-tiket: hanya ditampilkan sebagai pesan.
- **PDF**: e-tiket dan laporan memakai dialog cetak peramban ("Simpan sebagai PDF"); laporan Excel diunduh sebagai CSV (UTF-8, pemisah `;`).
- **Data destinasi**: harga, jam buka, dan kuota bersifat ilustratif.

## Kredit

Foto destinasi dari Wikimedia Commons dengan lisensi CC0, CC BY, atau CC BY-SA; nama pembuat dan tautan sumber tercantum di halaman `/kredit-foto` dan pada galeri foto setiap destinasi. Peta © kontributor OpenStreetMap. Ikon: Lucide. Huruf: Plus Jakarta Sans.
