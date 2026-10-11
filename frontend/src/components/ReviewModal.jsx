import { useState } from 'react'
import { reviews, REVIEW_MAX_CHARS } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { Alert, Modal, Spinner, Stars } from './ui'

const LABELS = ['', 'Buruk', 'Kurang', 'Cukup', 'Bagus', 'Luar biasa']

/** SRS 3.11: rating 1–5 dan ulasan untuk reservasi berstatus "Sudah Digunakan". */
export function ReviewModal({ reservation, open, onClose, onSaved }) {
  const { user } = useAuth()
  const toast = useToast()
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setError('')
    setBusy(true)
    try {
      await reviews.create(user, reservation.id, { rating, comment })
      toast('Terima kasih! Ulasan Anda sudah tayang.')
      onSaved?.()
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Tulis ulasan"
      footer={
        <div className="flex justify-end">
          <button className="btn-dark" disabled={busy} onClick={submit}>
            {busy ? <Spinner className="size-5" /> : 'Kirim ulasan'}
          </button>
        </div>
      }
    >
      <h3 className="text-xl font-semibold">Bagaimana kunjungan Anda ke {reservation?.destination?.name}?</h3>
      <div className="mt-6 flex items-center gap-4">
        <Stars value={rating} onChange={setRating} size="size-8" />
        <span className="text-sm font-semibold text-muted">{LABELS[rating]}</span>
      </div>
      <label htmlFor="review" className="label mt-8">
        Ceritakan pengalaman Anda <span className="font-normal text-muted">(opsional)</span>
      </label>
      <textarea
        id="review"
        rows={5}
        className="field resize-none"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Apa yang paling berkesan? Ada tips untuk wisatawan lain?"
        aria-invalid={comment.length > REVIEW_MAX_CHARS || undefined}
      />
      <div className={`mt-1 text-right text-xs ${comment.length > REVIEW_MAX_CHARS ? 'font-semibold text-brand-700' : 'text-muted'}`}>
        {comment.length}/{REVIEW_MAX_CHARS}
      </div>
      {error && (
        <Alert tone="error" className="mt-4">
          {error}
        </Alert>
      )}
    </Modal>
  )
}
