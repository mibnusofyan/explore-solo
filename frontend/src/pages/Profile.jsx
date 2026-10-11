import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera } from 'lucide-react'
import { auth } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { Alert, Avatar, FieldError, Spinner } from '../components/ui'
import { PasswordInput } from './Auth'

const ROLE_LABEL = { wisatawan: 'Wisatawan', pengelola: 'Pengelola Destinasi', admin: 'Admin' }

/** Potong persegi dan kecilkan foto profil ke 512px sebelum diunggah. */
function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const size = 512
      const c = document.createElement('canvas')
      c.width = c.height = size
      const s = Math.min(img.width, img.height)
      c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size)
      URL.revokeObjectURL(img.src)
      c.toBlob((blob) => resolve(new File([blob], 'avatar.jpg', { type: 'image/jpeg' })), 'image/jpeg', 0.85)
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

/** SRS 3.12 Profile Page. */
export default function Profile() {
  const { user, refresh, logout } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const fileRef = useRef(null)
  const [form, setForm] = useState({ name: user.name, phone: user.phone })
  const [uploading, setUploading] = useState(false)
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [pw, setPw] = useState({ oldPassword: '', newPassword: '', confirm: '' })
  const [pwErrors, setPwErrors] = useState({})
  const [pwBusy, setPwBusy] = useState(false)
  const [error, setError] = useState('')

  const pickPhoto = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (!/^image\/(jpeg|png|webp)$/.test(f.type) || f.size > 2 * 1024 * 1024) {
      setError('Foto profil harus JPG, PNG, atau WebP dengan ukuran maksimal 2 MB.')
      return
    }
    setError('')
    setUploading(true)
    try {
      refresh(await auth.uploadAvatar(await resizeImage(f)))
      toast('Foto profil diperbarui')
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    setErrors({})
    setError('')
    try {
      refresh(await auth.updateProfile(user.id, form))
      toast('Profil diperbarui')
    } catch (err) {
      setErrors(err.fields || {})
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const changePw = async (e) => {
    e.preventDefault()
    setPwBusy(true)
    setPwErrors({})
    try {
      await auth.changePassword(user.id, pw.oldPassword, pw.newPassword, pw.confirm)
      setPw({ oldPassword: '', newPassword: '', confirm: '' })
      toast('Password berhasil diganti')
    } catch (err) {
      setPwErrors(err.fields || { oldPassword: err.message })
    } finally {
      setPwBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 md:py-12">
      <h1 className="text-[32px] font-bold tracking-tight">Profil akun</h1>

      <div className="mt-8 grid grid-cols-1 gap-10 md:grid-cols-[300px_minmax(0,1fr)]">
        <aside>
          <div className="card flex flex-col items-center p-8 text-center shadow-card">
            <div className="relative">
              <Avatar user={user} size="size-28" className={`text-3xl ${uploading ? 'opacity-40' : ''}`} />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="absolute right-0 bottom-0 flex size-9 items-center justify-center rounded-full border border-line bg-white shadow-pill hover:bg-soft"
                aria-label="Ganti foto profil"
              >
                <Camera className="size-4" />
              </button>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={pickPhoto} />
            </div>
            <div className="mt-4 text-2xl font-bold">{user.name}</div>
            <div className="text-sm text-muted">{ROLE_LABEL[user.role]}</div>
          </div>
          <button
            className="btn-outline mt-4 w-full"
            onClick={() => {
              logout()
              navigate('/')
            }}
          >
            Keluar
          </button>
        </aside>

        <div className="space-y-10">
          <form onSubmit={save} className="space-y-4" noValidate>
            <h2 className="text-[22px] font-semibold">Informasi pribadi</h2>
            {error && <Alert tone="error">{error}</Alert>}
            <div>
              <label className="label" htmlFor="p-name">Nama</label>
              <input id="p-name" className="field" value={form.name} aria-invalid={!!errors.name || undefined} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <FieldError>{errors.name}</FieldError>
            </div>
            <div>
              <label className="label" htmlFor="p-email">Email</label>
              <input id="p-email" className="field bg-soft text-muted" value={user.email} disabled />
              <p className="mt-1 text-xs text-muted">Email tidak dapat diubah karena dipakai untuk login dan pengiriman e-tiket.</p>
            </div>
            <div>
              <label className="label" htmlFor="p-phone">Nomor HP</label>
              <input id="p-phone" type="tel" className="field" value={form.phone} aria-invalid={!!errors.phone || undefined} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <FieldError>{errors.phone}</FieldError>
            </div>
            <button className="btn-dark" disabled={busy}>
              {busy ? <Spinner className="size-5" /> : 'Simpan perubahan'}
            </button>
          </form>

          <form onSubmit={changePw} className="space-y-4 border-t border-line pt-10" noValidate>
            <h2 className="text-[22px] font-semibold">Ganti password</h2>
            <div>
              <label className="label" htmlFor="pw-old">Password lama</label>
              <PasswordInput id="pw-old" value={pw.oldPassword} invalid={!!pwErrors.oldPassword} onChange={(e) => setPw({ ...pw, oldPassword: e.target.value })} autoComplete="current-password" />
              <FieldError>{pwErrors.oldPassword}</FieldError>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="pw-new">Password baru</label>
                <PasswordInput id="pw-new" value={pw.newPassword} invalid={!!pwErrors.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} autoComplete="new-password" placeholder="Minimal 8 karakter" />
                <FieldError>{pwErrors.newPassword}</FieldError>
              </div>
              <div>
                <label className="label" htmlFor="pw-confirm">Konfirmasi password baru</label>
                <PasswordInput id="pw-confirm" value={pw.confirm} invalid={!!pwErrors.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} autoComplete="new-password" />
                <FieldError>{pwErrors.confirm}</FieldError>
              </div>
            </div>
            <button className="btn-outline" disabled={pwBusy}>
              {pwBusy ? <Spinner className="size-5" /> : 'Perbarui password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
