// Konstanta katalog yang dipakai bersama halaman. Data destinasi sendiri berasal dari API;
// daftar kategori dan fasilitas harus sama dengan backend/src/utils/schemas.js.

export const CATEGORIES = [
  { id: 'sejarah-budaya', label: 'Sejarah dan Budaya', icon: 'Landmark' },
  { id: 'religi', label: 'Religi', icon: 'MoonStar' },
  { id: 'alam-taman', label: 'Alam dan Taman', icon: 'Trees' },
  { id: 'belanja-kuliner', label: 'Belanja dan Kuliner', icon: 'ShoppingBag' },
  { id: 'edukasi-museum', label: 'Edukasi dan Museum', icon: 'Library' },
  { id: 'rekreasi-keluarga', label: 'Rekreasi Keluarga', icon: 'FerrisWheel' },
]

export const FACILITIES = [
  'Parkir',
  'Toilet',
  'Mushola',
  'Pemandu wisata',
  'Kantin',
  'Akses kursi roda',
  'Area foto',
  'Toko suvenir',
  'Wi-Fi',
  'Loker',
  'Ruang menyusui',
  'P3K',
]

export function categoryLabel(id) {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id
}
