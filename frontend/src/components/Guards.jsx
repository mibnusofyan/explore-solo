import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Footer, Header } from './Layout'
import { Icon, PageLoader } from './ui'
import { Forbidden } from '../pages/InfoPages'

/** Middleware sisi klien (RBAC). Backend tetap wajib memeriksa role di setiap endpoint. */
export function RequireRole({ roles }) {
  const { user, ready } = useAuth()
  const location = useLocation()
  if (!ready) return <PageLoader />
  if (!user)
    return (
      <Navigate
        to={`/masuk?next=${encodeURIComponent(location.pathname + location.search)}`}
        replace
        state={{ reason: 'Silakan masuk untuk melanjutkan.' }}
      />
    )
  if (roles && !roles.includes(user.role)) return <Forbidden />
  return <Outlet />
}

const NAV = {
  pengelola: [
    { to: '/pengelola', label: 'Ringkasan', icon: 'TrendingUp', end: true },
    { to: '/pengelola/check-in', label: 'Verifikasi tiket', icon: 'ScanLine' },
    { to: '/pengelola/reservasi', label: 'Reservasi & laporan', icon: 'ClipboardList' },
    { to: '/pengelola/destinasi', label: 'Destinasi saya', icon: 'Building2' },
    { to: '/pengelola/ulasan', label: 'Ulasan', icon: 'MessageSquare' },
  ],
  admin: [
    { to: '/admin', label: 'Ringkasan', icon: 'TrendingUp', end: true },
    { to: '/admin/destinasi', label: 'Verifikasi destinasi', icon: 'ShieldCheck' },
    { to: '/admin/laporan', label: 'Laporan reservasi', icon: 'ClipboardList' },
    { to: '/admin/pengguna', label: 'Kelola pengguna', icon: 'Users' },
  ],
}

export function DashboardLayout({ role }) {
  const items = NAV[role]
  const link = ({ isActive }) =>
    `flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2.5 text-[15px] transition ${
      isActive ? 'bg-soft font-semibold text-ink' : 'text-muted hover:bg-soft hover:text-ink'
    }`
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="container-page flex flex-1 flex-col gap-6 py-6 md:flex-row md:gap-10 md:py-10">
        <nav className="no-print no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 md:sticky md:top-28 md:mx-0 md:w-60 md:shrink-0 md:flex-col md:self-start md:px-0" aria-label="Menu dasbor">
          <div className="mb-3 hidden px-3 text-xs font-semibold tracking-wide text-muted uppercase md:block">
            {role === 'admin' ? 'Admin' : 'Pengelola Destinasi'}
          </div>
          {items.map((i) => (
            <NavLink key={i.to} to={i.to} end={i.end} className={link}>
              <Icon name={i.icon} className="size-5" strokeWidth={1.75} />
              {i.label}
            </NavLink>
          ))}
        </nav>
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
      <Footer />
    </div>
  )
}

export function PageTitle({ title, subtitle, actions }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-[28px] font-bold tracking-tight md:text-[32px]">{title}</h1>
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
