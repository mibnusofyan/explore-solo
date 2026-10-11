import { Link } from 'react-router-dom'
import { DESTINATIONS } from '../data/destinations'
import { PAYMENT_WINDOW_MIN } from '../services/api'
import { EmptyState } from '../components/ui'

const FAQ = [
  {
    id: 'reservasi',
    title: 'Cara melakukan reservasi',
    items: [
      ['Apakah saya perlu akun untuk melihat destinasi?', 'Tidak. Daftar destinasi, detail, peta, dan ulasan dapat dilihat tanpa login. Akun Wisatawan dibutuhkan saat memesan tiket.'],
      ['Bagaimana memesan tiket?', 'Buka halaman destinasi, pilih tanggal kunjungan dan jumlah tiket per jenis, lalu tekan “Pesan sekarang”. Periksa ringkasan, isi data pemesan, dan konfirmasi. Sistem menerbitkan kode booking dengan status Menunggu Pembayaran.'],
      ['Mengapa tanggal tertentu tidak bisa dipilih?', 'Destinasi mungkin tutup pada hari tersebut (misalnya hari Senin untuk beberapa museum), sedang libur khusus, atau kuota hariannya sudah habis.'],
    ],
  },
  {
    id: 'pembayaran',
    title: 'Pembayaran',
    items: [
      ['Metode pembayaran apa saja yang tersedia?', 'Virtual account (BCA, BNI, BRI, Mandiri), QRIS, dan dompet digital (GoPay, ShopeePay, DANA) melalui Midtrans.'],
      ['Berapa lama batas waktu pembayaran?', `Kuota ditahan selama ${PAYMENT_WINDOW_MIN} menit sejak reservasi dibuat. Setelah itu reservasi otomatis dibatalkan dan kuota dikembalikan.`],
      ['Apakah bisa refund?', 'Reservasi yang belum dibayar bisa Anda batalkan sendiri. Pengembalian dana untuk tiket yang sudah lunas tidak diproses otomatis; hubungi pengelola destinasi.'],
    ],
  },
  {
    id: 'e-tiket',
    title: 'Menggunakan e-tiket',
    items: [
      ['Di mana saya menemukan e-tiket?', 'Setelah pembayaran berhasil, e-tiket dengan kode QR muncul di menu Reservasi saya dan dikirim ke email Anda. Anda juga dapat mengunduhnya dalam format PDF.'],
      ['Bagaimana proses check-in?', 'Tunjukkan kode QR kepada petugas. Petugas memindai QR atau memasukkan kode booking. Tiket hanya berlaku pada tanggal kunjungan dan untuk satu kali masuk.'],
      ['Kapan saya bisa memberi ulasan?', 'Setelah tiket Anda dipindai (status Sudah Digunakan). Setiap reservasi dapat diulas satu kali.'],
    ],
  },
]

export function Help() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 md:py-16">
      <h1 className="text-[32px] font-bold tracking-tight">Pusat bantuan</h1>
      <p className="mt-2 text-muted">Panduan reservasi, pembayaran, dan penggunaan e-tiket Explore Solo.</p>
      <nav className="mt-6 flex flex-wrap gap-2">
        {FAQ.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:border-ink">
            {s.title}
          </a>
        ))}
      </nav>
      {FAQ.map((s) => (
        <section key={s.id} id={s.id} className="scroll-mt-28 border-b border-line py-10">
          <h2 className="text-[22px] font-semibold">{s.title}</h2>
          <div className="mt-4 divide-y divide-line">
            {s.items.map(([q, a]) => (
              <details key={q} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                  {q}
                  <span className="text-xl text-muted transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-[15px] leading-relaxed text-muted">{a}</p>
              </details>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

export function PhotoCredits() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 md:py-16">
      <h1 className="text-[32px] font-bold tracking-tight">Kredit foto</h1>
      <p className="mt-2 text-muted">
        Foto destinasi berasal dari Wikimedia Commons dan digunakan sesuai lisensi masing-masing (CC0, CC BY, atau CC BY-SA). Foto telah diperkecil.
      </p>
      <ul className="mt-8 divide-y divide-line">
        {DESTINATIONS.flatMap((d) =>
          d.photos.map((p) => (
            <li key={p.src} className="flex items-center gap-4 py-3">
              <img src={p.src} alt="" className="size-14 shrink-0 rounded-lg object-cover" loading="lazy" />
              <div className="min-w-0 text-sm">
                <div className="font-semibold">{d.name}</div>
                <a href={p.source} target="_blank" rel="noreferrer" className="text-muted underline">
                  {p.credit}
                </a>
              </div>
            </li>
          )),
        )}
      </ul>
    </div>
  )
}

export function NotFound() {
  return (
    <EmptyState
      icon="Compass"
      title="Halaman tidak ditemukan"
      action={
        <Link to="/" className="btn-dark">
          Kembali ke beranda
        </Link>
      }
    >
      Tautan yang Anda buka mungkin salah atau halaman sudah dipindahkan.
    </EmptyState>
  )
}

export function Forbidden() {
  return (
    <EmptyState icon="Lock" title="Akses ditolak" action={<Link to="/" className="btn-dark">Kembali ke beranda</Link>}>
      Halaman ini hanya untuk peran tertentu. Masuk dengan akun yang sesuai.
    </EmptyState>
  )
}
