import { lazy, Suspense, useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { PublicLayout } from './components/Layout'
import { DashboardLayout, RequireRole } from './components/Guards'
import { PageLoader } from './components/ui'
import Home from './pages/Home'
import DestinationDetail from './pages/DestinationDetail'
import { Login, Register } from './pages/Auth'
import { Help, NotFound, PhotoCredits } from './pages/InfoPages'

const Checkout = lazy(() => import('./pages/Checkout'))
const Payment = lazy(() => import('./pages/Payment'))
const Trips = lazy(() => import('./pages/Trips'))
const TicketDetail = lazy(() => import('./pages/TicketDetail'))
const Profile = lazy(() => import('./pages/Profile'))
const ReportPage = lazy(() => import('./pages/shared/ReportPage'))
const PengelolaOverview = lazy(() => import('./pages/pengelola/Overview'))
const CheckIn = lazy(() => import('./pages/pengelola/CheckIn'))
const PengelolaReviews = lazy(() => import('./pages/pengelola/Reviews'))
const DestinationList = lazy(() => import('./pages/pengelola/Destinations').then((m) => ({ default: m.DestinationList })))
const DestinationForm = lazy(() => import('./pages/pengelola/Destinations').then((m) => ({ default: m.DestinationForm })))
const AdminOverview = lazy(() => import('./pages/admin/AdminPages').then((m) => ({ default: m.AdminOverview })))
const AdminDestinations = lazy(() => import('./pages/admin/AdminPages').then((m) => ({ default: m.AdminDestinations })))
const AdminUsers = lazy(() => import('./pages/admin/AdminPages').then((m) => ({ default: m.AdminUsers })))

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  const { pathname } = useLocation()
  useEffect(() => {
    if (!pathname.startsWith('/destinasi/')) document.title = 'Explore Solo · Reservasi Wisata Surakarta'
  }, [pathname])

  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<Home />} />
            <Route path="destinasi/:slug" element={<DestinationDetail />} />
            <Route path="masuk" element={<Login />} />
            <Route path="daftar" element={<Register />} />
            <Route path="bantuan" element={<Help />} />
            <Route path="kredit-foto" element={<PhotoCredits />} />

            <Route element={<RequireRole roles={['wisatawan']} />}>
              <Route path="pesan/:slug" element={<Checkout />} />
              <Route path="pembayaran/:id" element={<Payment />} />
              <Route path="reservasi" element={<Trips />} />
              <Route path="reservasi/:id" element={<TicketDetail />} />
            </Route>
            <Route element={<RequireRole />}>
              <Route path="profil" element={<Profile />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Route>

          <Route element={<RequireRole roles={['pengelola']} />}>
            <Route path="pengelola" element={<DashboardLayout role="pengelola" />}>
              <Route index element={<PengelolaOverview />} />
              <Route path="check-in" element={<CheckIn />} />
              <Route path="reservasi" element={<ReportPage />} />
              <Route path="destinasi" element={<DestinationList />} />
              <Route path="destinasi/:id" element={<DestinationForm />} />
              <Route path="ulasan" element={<PengelolaReviews />} />
            </Route>
          </Route>

          <Route element={<RequireRole roles={['admin']} />}>
            <Route path="admin" element={<DashboardLayout role="admin" />}>
              <Route index element={<AdminOverview />} />
              <Route path="destinasi" element={<AdminDestinations />} />
              <Route path="laporan" element={<ReportPage />} />
              <Route path="pengguna" element={<AdminUsers />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </>
  )
}
