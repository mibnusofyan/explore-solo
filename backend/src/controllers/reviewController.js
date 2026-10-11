import { isManager } from '../models/destinationModel.js'
import { findReview, reviewsForDestinations, setReply } from '../models/reviewModel.js'
import { notFound, unprocessable } from '../utils/httpError.js'

/** SRS 3.11 langkah 6: Pengelola melihat ulasan destinasinya (Admin melihat semua). */
export async function listForManager(req, res) {
  const scope = req.user.role === 'admin' ? null : req.user.destinationIds
  res.json({ reviews: await reviewsForDestinations(scope) })
}

export async function reply(req, res) {
  const text = String(req.body?.text || '').trim()
  if (!text) throw unprocessable('Balasan tidak boleh kosong.', { text: 'Wajib diisi.' })
  if (text.length > 500) throw unprocessable('Balasan maksimal 500 karakter.', { text: 'Terlalu panjang.' })
  const review = await findReview(req.params.id)
  if (!review || !(await isManager(req.user.id, review.destinationId))) throw notFound('Ulasan tidak ditemukan.')
  res.json({ review: await setReply(review.id, text, req.user.name) })
}
