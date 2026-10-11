import { useEffect, useRef, useState } from 'react'
import { Camera, CameraOff, CircleCheck, CircleX } from 'lucide-react'
import { reservations } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { DEMO_CHECKIN_CODE } from '../../data/seed'
import { Alert, Spinner } from '../../components/ui'
import { PageTitle } from '../../components/Guards'
import { formatDate, formatDateTime } from '../../lib/format'

/** Pemindai QR memakai BarcodeDetector bawaan peramban (Chrome/Edge/Android). */
function QrScanner({ onCode, onClose }) {
  const videoRef = useRef(null)
  const onCodeRef = useRef(onCode)
  const [error, setError] = useState('')

  useEffect(() => {
    onCodeRef.current = onCode
  }, [onCode])

  useEffect(() => {
    let stream
    let raf
    let stopped = false
    const start = async () => {
      if (!('BarcodeDetector' in window)) {
        setError('Peramban ini belum mendukung pemindaian QR. Gunakan Chrome/Edge terbaru atau masukkan kode booking secara manual.')
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        const video = videoRef.current
        video.srcObject = stream
        await video.play()
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
        const tick = async () => {
          if (stopped) return
          try {
            const codes = await detector.detect(video)
            if (codes[0]?.rawValue) {
              onCodeRef.current(codes[0].rawValue)
              return
            }
          } catch {
            // Bingkai belum siap, coba lagi.
          }
          raf = requestAnimationFrame(tick)
        }
        tick()
      } catch {
        setError('Izin kamera ditolak atau kamera tidak tersedia. Izinkan akses kamera pada peramban, atau masukkan kode booking.')
      }
    }
    start()
    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  return (
    <div className="mt-4">
      {error ? (
        <Alert tone="warn">{error}</Alert>
      ) : (
        <div className="relative overflow-hidden rounded-2xl bg-black">
          <video ref={videoRef} className="aspect-square w-full object-cover sm:aspect-video" muted playsInline />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="size-52 rounded-3xl border-4 border-white/90 shadow-[0_0_0_9999px_rgb(0_0_0/0.35)]" />
          </div>
        </div>
      )}
      <button className="btn-ghost mt-2 underline" onClick={onClose}>
        <CameraOff className="size-4" /> Tutup kamera
      </button>
    </div>
  )
}

/** SRS 3.8 Verifikasi Tiket (Check-in). */
export default function CheckIn() {
  const { user } = useAuth()
  const [code, setCode] = useState('')
  const [scan, setScan] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])
  const inputRef = useRef(null)

  const verify = async (raw) => {
    const value = (raw ?? code).trim()
    if (!value) return
    setScan(false)
    setBusy(true)
    const res = await reservations.checkIn(user, value)
    setResult({ ...res, code: value.toUpperCase(), at: Date.now() })
    setHistory((h) => [{ ...res, code: value.toUpperCase(), at: Date.now() }, ...h].slice(0, 8))
    setBusy(false)
    setCode('')
    inputRef.current?.focus()
  }

  const r = result?.reservation

  return (
    <>
      <PageTitle title="Verifikasi tiket" subtitle="Pindai kode QR e-tiket atau masukkan kode booking wisatawan." />

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="card p-6">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              verify()
            }}
          >
            <label htmlFor="code" className="label">
              Kode booking
            </label>
            <div className="flex gap-2">
              <input
                id="code"
                ref={inputRef}
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ES-XXXXXX"
                className="field font-mono text-lg tracking-wider uppercase"
                autoComplete="off"
              />
              <button className="btn-dark shrink-0" disabled={busy || !code.trim()}>
                {busy ? <Spinner className="size-5" /> : 'Verifikasi'}
              </button>
            </div>
          </form>
          {!scan ? (
            <button className="btn-outline mt-4 w-full" onClick={() => setScan(true)}>
              <Camera className="size-4" /> Pindai QR dengan kamera
            </button>
          ) : (
            <QrScanner onCode={verify} onClose={() => setScan(false)} />
          )}
          <p className="mt-4 text-xs text-muted">
            Demo: coba kode <button className="font-mono font-semibold text-ink underline" onClick={() => verify(DEMO_CHECKIN_CODE)}>{DEMO_CHECKIN_CODE}</button>{' '}
            (tiket Keraton hari ini). Memverifikasi kode yang sama dua kali akan ditolak.
          </p>
        </section>

        <section aria-live="polite">
          {result ? (
            <div className={`overflow-hidden rounded-2xl border-2 ${result.valid ? 'border-emerald-500' : 'border-brand-500'}`}>
              <div className={`flex items-center gap-3 px-6 py-5 text-white ${result.valid ? 'bg-emerald-600' : 'bg-brand-600'}`}>
                {result.valid ? <CircleCheck className="size-8" /> : <CircleX className="size-8" />}
                <div>
                  <div className="text-xl font-bold">{result.valid ? 'Tiket valid' : 'Tiket tidak valid'}</div>
                  <div className="text-sm opacity-90">{result.valid ? 'Silakan persilakan masuk. Status: Sudah Digunakan.' : result.reason}</div>
                </div>
              </div>
              {r && (
                <dl className="grid grid-cols-2 gap-4 p-6 text-[15px]">
                  <Item label="Kode booking" value={<span className="font-mono font-bold">{r.code}</span>} />
                  <Item label="Nama pemesan" value={r.contact.name} />
                  <Item label="Destinasi" value={r.destination?.name} />
                  <Item label="Tanggal kunjungan" value={formatDate(r.date)} />
                  <Item label="Tiket" value={r.items.map((i) => `${i.qty} × ${i.name}`).join(', ')} wide />
                  {r.checkedInAt && <Item label="Waktu check-in" value={formatDateTime(r.checkedInAt)} wide />}
                </dl>
              )}
            </div>
          ) : (
            <div className="flex h-full min-h-60 flex-col items-center justify-center rounded-2xl border border-dashed border-line p-8 text-center text-muted">
              Hasil verifikasi akan tampil di sini.
            </div>
          )}

          {history.length > 1 && (
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-semibold">Riwayat sesi ini</h3>
              <ul className="divide-y divide-line rounded-xl border border-line text-sm">
                {history.slice(1).map((h) => (
                  <li key={h.at} className="flex items-center justify-between px-4 py-2.5">
                    <span className="font-mono">{h.code}</span>
                    <span className={h.valid ? 'font-semibold text-emerald-700' : 'text-brand-700'}>{h.valid ? 'Valid' : 'Ditolak'}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </>
  )
}

function Item({ label, value, wide }) {
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  )
}
