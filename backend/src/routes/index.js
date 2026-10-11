import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { config } from '../config/index.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { imageUpload } from '../middleware/upload.js'
import { validate } from '../middleware/validate.js'
import * as auth from '../controllers/authController.js'
import * as dest from '../controllers/destinationController.js'
import * as rsv from '../controllers/reservationController.js'
import * as rev from '../controllers/reviewController.js'
import * as users from '../controllers/userController.js'
import {
  adminUserSchema,
  loginSchema,
  passwordChangeSchema,
  profileSchema,
  registerSchema,
  reportQuerySchema,
  reservationSchema,
  reviewSchema,
  searchSchema,
} from '../utils/schemas.js'

const r = Router()

const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: config.isTest ? 1000 : 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.' },
})

const wisatawan = requireRole('wisatawan')
const pengelola = requireRole('pengelola')
const admin = requireRole('admin')
const staff = requireRole('pengelola', 'admin')

// Autentikasi (SRS 3.1, 3.2)
r.get('/auth/csrf', auth.csrf)
r.get('/auth/me', auth.me)
r.post('/auth/register', authLimiter, validate(registerSchema), auth.register)
r.post('/auth/login', authLimiter, validate(loginSchema), auth.login)
r.post('/auth/logout', auth.logout)
r.get('/auth/verify-email', auth.verifyEmail)

// Profil (SRS 3.12)
r.patch('/me', requireAuth, validate(profileSchema), auth.updateProfile)
r.put('/me/password', requireAuth, validate(passwordChangeSchema), auth.changePassword)
r.post('/me/avatar', requireAuth, imageUpload('avatars', 2).single('avatar'), auth.uploadAvatar)

// Destinasi publik (SRS 3.3, 3.4)
r.get('/destinations', validate(searchSchema, 'query'), dest.search)
r.get('/destinations/:slug', dest.show)
r.get('/destinations/:slug/availability', dest.availability)
r.get('/destinations/:id/reviews', dest.reviews)

// Reservasi, pembayaran, e-tiket, ulasan (SRS 3.5, 3.6, 3.7, 3.11)
r.post('/reservations', wisatawan, validate(reservationSchema), rsv.create)
r.get('/reservations', wisatawan, rsv.listMine)
r.get('/reservations/:id', requireAuth, rsv.show)
r.post('/reservations/:id/cancel', wisatawan, rsv.cancel)
r.post('/reservations/:id/payment', wisatawan, rsv.startPayment)
r.post('/reservations/:id/payment/simulate', wisatawan, rsv.simulatePayment)
r.post('/reservations/:id/payment/sync', wisatawan, rsv.syncPayment)
r.get('/reservations/:id/ticket.pdf', requireAuth, rsv.ticketPdf)
r.post('/reservations/:id/review', wisatawan, validate(reviewSchema), rsv.createReview)
r.post('/payments/midtrans/notification', rsv.midtransNotification)

// Pengelola Destinasi (SRS 3.8, 3.9, 3.11)
r.get('/manager/destinations', pengelola, dest.listManaged)
r.post('/manager/destinations', pengelola, dest.create)
r.get('/manager/destinations/:id', pengelola, dest.showManaged)
r.put('/manager/destinations/:id', pengelola, dest.update)
r.post('/manager/uploads/photo', pengelola, imageUpload('destinations', 5).single('photo'), dest.uploadPhoto)
r.post('/manager/check-in', pengelola, rsv.checkIn)
r.get('/manager/reviews', staff, rev.listForManager)
r.post('/manager/reviews/:id/reply', pengelola, rev.reply)

// Laporan (SRS 3.10)
r.get('/reports/reservations', staff, validate(reportQuerySchema, 'query'), rsv.report)

// Admin (SRS 3.9, 3.13)
r.get('/admin/destinations', admin, dest.listAll)
r.post('/admin/destinations/:id/verify', admin, dest.verify)
r.patch('/admin/destinations/:id/status', admin, dest.setStatus)
r.get('/admin/users', admin, users.list)
r.post('/admin/users', admin, validate(adminUserSchema), users.create)
r.put('/admin/users/:id', admin, validate(adminUserSchema), users.update)
r.patch('/admin/users/:id/status', admin, users.setActive)

export default r
