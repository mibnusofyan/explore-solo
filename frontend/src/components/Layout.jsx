import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Menu, CircleUserRound, Globe } from 'lucide-react'
import { useAuth, homePathFor } from '../context/AuthContext'
import { Avatar } from './ui'

export function Logo({ compact = false }) {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-1.5 text-brand-500" aria-label="Explore Solo, beranda">
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
        <path
          fill="currentColor"
          d="M16 2C9.4 2 4 7.2 4 13.6 4 22 14 30 15 30.8c.6.4 1.4.4 2 0C18 30 28 22 28 13.6 28 7.2 22.6 2 16 2Zm0 5.2c1.2 0 2.3.6 2.9 1.6l3.4 5.6c.4.7.2 1.6-.5 2a1.4 1.4 0 0 1-.8.2h-1.4v4.6c0 .6-.5 1-1 1h-5.2c-.6 0-1-.4-1-1v-4.6h-1.4a1.5 1.5 0 0 1-1.3-2.2l3.4-5.6c.6-1 1.7-1.6 2.9-1.6Z"
        />
      </svg>
      {!compact && <span className="text-xl font-extrabold tracking-tight">explore solo</span>}
    </Link>
  )
}

function UserMenu() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()
  const location = useLocation()

  const [path, setPath] = useState(location.pathname)
  if (path !== location.pathname) {
    // Tutup menu setiap kali halaman berganti.
    setPath(location.pathname)
    setOpen(false)
  }
  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const item = 'block px-4 py-3 text-sm hover:bg-soft'
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-3 rounded-full border border-line py-1.5 pr-1.5 pl-3.5 transition hover:shadow-pill"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menu pengguna"
      >
        <Menu className="size-4" />
        {user ? <Avatar user={user} /> : <CircleUserRound className="size-8 text-muted" strokeWidth={1.25} />}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-xl bg-white py-2 shadow-float ring-1 ring-black/5">
          {user ? (
            <>
              <div className="px-4 pt-2 pb-3">
                <div className="text-sm font-semibold">{user.name}</div>
                <div className="truncate text-xs text-muted">{user.email}</div>
              </div>
              <hr className="my-1 border-line" />
              {user.role === 'wisatawan' && (
                <Link to="/reservasi" className={`${item} font-semibold`}>
                  Reservasi saya
                </Link>
              )}
              {user.role !== 'wisatawan' && (
                <Link to={homePathFor(user)} className={`${item} font-semibold`}>
                  Dasbor {user.role === 'admin' ? 'Admin' : 'Pengelola'}
                </Link>
              )}
              <Link to="/profil" className={item}>
                Profil akun
              </Link>
              <hr className="my-1 border-line" />
              <Link to="/bantuan" className={item}>
                Pusat bantuan
              </Link>
              <button
                className={`${item} w-full text-left`}
                onClick={() => {
                  logout()
                  navigate('/')
                }}
              >
                Keluar
              </button>
            </>
          ) : (
            <>
              <Link to="/masuk" className={`${item} font-semibold`}>
                Masuk
              </Link>
              <Link to="/daftar" className={item}>
                Daftar
              </Link>
              <hr className="my-1 border-line" />
              <Link to="/bantuan" className={item}>
                Pusat bantuan
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export function Header({ children, wide = true }) {
  const { user } = useAuth()
  return (
    <header className="no-print sticky top-0 z-40 border-b border-line bg-white">
      <div className={`${wide ? 'container-page' : 'mx-auto max-w-6xl px-4 sm:px-6'} flex h-20 items-center justify-between gap-4`}>
        <div className="flex-1">
          <span className="md:hidden">
            <Logo compact />
          </span>
          <span className="hidden md:inline-flex">
            <Logo />
          </span>
        </div>
        {children && <div className="min-w-0 flex-[2] md:flex md:justify-center">{children}</div>}
        <nav className="flex flex-1 items-center justify-end gap-1">
          {user?.role === 'wisatawan' && (
            <NavLink to="/reservasi" className="hidden rounded-full px-4 py-3 text-sm font-semibold hover:bg-soft lg:block">
              Reservasi saya
            </NavLink>
          )}
          {user && user.role !== 'wisatawan' && (
            <NavLink to={homePathFor(user)} className="hidden rounded-full px-4 py-3 text-sm font-semibold hover:bg-soft lg:block">
              Dasbor
            </NavLink>
          )}
          <span className="hidden rounded-full p-3 hover:bg-soft lg:block" title="Bahasa Indonesia · IDR · WIB">
            <Globe className="size-4" />
          </span>
          <UserMenu />
        </nav>
      </div>
    </header>
  )
}

export function Footer() {
  return (
    <footer className="no-print mt-16 border-t border-line bg-soft">
      <div className="container-page grid gap-8 py-12 text-sm sm:grid-cols-3">
        <div>
          <h3 className="mb-3 font-semibold">Dukungan</h3>
          <ul className="space-y-3 text-muted">
            <li><Link className="hover:underline" to="/bantuan">Pusat bantuan & FAQ</Link></li>
            <li><Link className="hover:underline" to="/bantuan#reservasi">Cara reservasi</Link></li>
            <li><Link className="hover:underline" to="/bantuan#e-tiket">Menggunakan e-tiket</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 font-semibold">Jelajahi Solo</h3>
          <ul className="space-y-3 text-muted">
            <li><Link className="hover:underline" to="/?kategori=sejarah-budaya">Sejarah dan budaya</Link></li>
            <li><Link className="hover:underline" to="/?kategori=edukasi-museum">Museum</Link></li>
            <li><Link className="hover:underline" to="/?kategori=belanja-kuliner">Belanja dan kuliner</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 font-semibold">Explore Solo</h3>
          <ul className="space-y-3 text-muted">
            <li><Link className="hover:underline" to="/kredit-foto">Kredit foto</Link></li>
            <li><Link className="hover:underline" to="/daftar">Daftar sebagai wisatawan</Link></li>
          </ul>
        </div>
      </div>
      <div className="container-page flex flex-col justify-between gap-2 border-t border-line py-6 text-sm text-muted sm:flex-row">
        <span>© 2026 Explore Solo · Sistem Reservasi Destinasi Wisata Kota Surakarta</span>
        <span>Bahasa Indonesia · Rp IDR · WIB</span>
      </div>
    </footer>
  )
}

export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
