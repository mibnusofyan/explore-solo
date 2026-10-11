// Akun dan kode demo dari seed backend (npm run db:seed). Panel akun demo hanya tampil saat
// pengembangan atau bila VITE_SHOW_DEMO=true.
export const SHOW_DEMO = import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO === 'true'

export const DEMO_ACCOUNTS = [
  { role: 'wisatawan', label: 'Wisatawan', email: 'wisatawan@exploresolo.id', password: 'wisata123' },
  { role: 'pengelola', label: 'Pengelola Destinasi', email: 'pengelola@exploresolo.id', password: 'pengelola123' },
  { role: 'admin', label: 'Admin', email: 'admin@exploresolo.id', password: 'admin12345' },
]

export const DEMO_CHECKIN_CODE = 'ES-HR7K2M'
