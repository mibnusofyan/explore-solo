import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth, homePathFor } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { auth, ApiError } from '../services/api'
import { DEMO_ACCOUNTS, SHOW_DEMO } from '../data/demo'
import { Alert, FieldError, Spinner } from '../components/ui'

function AuthShell({ title, children }) {
  return (
    <div className="flex min-h-[calc(100vh-5rem)] items-start justify-center bg-white px-4 py-10 sm:bg-soft sm:py-16">
      <div className="w-full max-w-[568px] overflow-hidden bg-white sm:rounded-2xl sm:shadow-card sm:ring-1 sm:ring-line">
        <header className="flex h-16 items-center justify-center border-b border-line">
          <h1 className="text-base font-bold">{title}</h1>
        </header>
        <div className="p-6 sm:p-8">{children}</div>
      </div>
    </div>
  )
}

export function PasswordInput({ id, value, onChange, invalid, autoComplete, placeholder }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        aria-invalid={invalid || undefined}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="field pr-12"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted hover:text-ink"
        aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'}
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}

/** SRS 3.1 Login. */
export function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sp] = useSearchParams()
  const [email, setEmail] = useState(location.state?.email || '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const next = sp.get('next')

  if (user) return <Navigate to={next || homePathFor(user)} replace />

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!email || !password) return setError('Email dan password wajib diisi.')
    setBusy(true)
    try {
      const u = await login(email, password)
      navigate(next && (u.role === 'wisatawan' || !next.startsWith('/pesan')) ? next : homePathFor(u), { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal masuk. Coba lagi.')
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Masuk">
      <h2 className="mb-6 text-[22px] font-semibold">Selamat datang di Explore Solo</h2>
      {location.state?.reason && !error && (
        <Alert tone="info" className="mb-4">
          {location.state.reason}
        </Alert>
      )}
      {sp.get('verifikasi') && (
        <Alert tone={sp.get('verifikasi') === 'berhasil' ? 'success' : 'error'} className="mb-4">
          {sp.get('verifikasi') === 'berhasil'
            ? 'Email Anda berhasil diverifikasi. Silakan masuk.'
            : 'Tautan verifikasi tidak valid atau sudah dipakai.'}
        </Alert>
      )}
      {location.state?.registered && (
        <Alert tone="success" className="mb-4">
          Registrasi berhasil. Kami telah mengirim email verifikasi ke {location.state.email}. Silakan masuk.
        </Alert>
      )}
      {error && (
        <Alert className="mb-4" tone="error">
          {error}
        </Alert>
      )}
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="email" className="label">
            Email
          </label>
          <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field" placeholder="nama@email.com" />
        </div>
        <div>
          <label htmlFor="password" className="label">
            Password
          </label>
          <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </div>
        <button className="btn-brand w-full py-3.5" disabled={busy}>
          {busy ? <Spinner className="size-5" /> : 'Lanjutkan'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm">
        Belum punya akun?{' '}
        <Link to={`/daftar${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold underline">
          Daftar sebagai wisatawan
        </Link>
      </p>

      {SHOW_DEMO && (
        <div className="mt-8 rounded-xl bg-soft p-4">
          <div className="mb-3 text-xs font-semibold tracking-wide text-muted uppercase">Akun demo</div>
          <div className="grid gap-2 sm:grid-cols-3">
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.role}
                type="button"
                onClick={() => {
                  setEmail(a.email)
                  setPassword(a.password)
                }}
                className="rounded-lg border border-line bg-white px-3 py-2 text-left text-sm transition hover:border-ink"
              >
                <div className="font-semibold">{a.label}</div>
                <div className="truncate text-xs text-muted">{a.email}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </AuthShell>
  )
}

/** SRS 3.2 Registrasi. */
export function Register() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [sp] = useSearchParams()
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '' })
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={homePathFor(user)} replace />

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    setErrors({})
    try {
      await auth.register(form)
      toast('Registrasi berhasil')
      const next = sp.get('next')
      navigate(`/masuk${next ? `?next=${encodeURIComponent(next)}` : ''}`, { state: { registered: true, email: form.email } })
    } catch (err) {
      setError(err.message)
      setErrors(err.fields || {})
      setBusy(false)
    }
  }

  const field = (k, label, props = {}) => (
    <div>
      <label htmlFor={k} className="label">
        {label}
      </label>
      <input id={k} value={form[k]} onChange={set(k)} aria-invalid={!!errors[k] || undefined} className="field" {...props} />
      <FieldError>{errors[k]}</FieldError>
    </div>
  )

  return (
    <AuthShell title="Daftar">
      <h2 className="mb-1 text-[22px] font-semibold">Buat akun wisatawan</h2>
      <p className="mb-6 text-sm text-muted">Akun dibutuhkan untuk memesan tiket dan menyimpan e-tiket Anda.</p>
      {error && (
        <Alert className="mb-4" tone="error">
          {error}
        </Alert>
      )}
      <form onSubmit={submit} className="space-y-4" noValidate>
        {field('name', 'Nama lengkap', { autoComplete: 'name', placeholder: 'Sesuai identitas' })}
        {field('email', 'Email', { type: 'email', autoComplete: 'email', placeholder: 'nama@email.com' })}
        {field('phone', 'Nomor HP', { type: 'tel', autoComplete: 'tel', placeholder: '0812xxxxxxxx' })}
        <div>
          <label htmlFor="password" className="label">
            Password
          </label>
          <PasswordInput id="password" value={form.password} onChange={set('password')} invalid={!!errors.password} autoComplete="new-password" placeholder="Minimal 8 karakter" />
          <FieldError>{errors.password}</FieldError>
        </div>
        <div>
          <label htmlFor="confirm" className="label">
            Konfirmasi password
          </label>
          <PasswordInput id="confirm" value={form.confirm} onChange={set('confirm')} invalid={!!errors.confirm} autoComplete="new-password" />
          <FieldError>{errors.confirm}</FieldError>
        </div>
        <p className="text-xs text-muted">
          Dengan memilih <b>Setuju dan lanjutkan</b>, Anda menyetujui ketentuan layanan dan kebijakan privasi Explore Solo.
        </p>
        <button className="btn-brand w-full py-3.5" disabled={busy}>
          {busy ? <Spinner className="size-5" /> : 'Setuju dan lanjutkan'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm">
        Sudah punya akun?{' '}
        <Link to="/masuk" className="font-semibold underline">
          Masuk
        </Link>
      </p>
    </AuthShell>
  )
}
