import { createHash } from 'node:crypto'
import midtransClient from 'midtrans-client'
import { config } from '../config/index.js'

let snap
let core

function clients() {
  if (!config.midtrans.enabled) throw new Error('Midtrans belum dikonfigurasi.')
  snap ??= new midtransClient.Snap({
    isProduction: config.midtrans.isProduction,
    serverKey: config.midtrans.serverKey,
    clientKey: config.midtrans.clientKey,
  })
  core ??= new midtransClient.CoreApi({
    isProduction: config.midtrans.isProduction,
    serverKey: config.midtrans.serverKey,
    clientKey: config.midtrans.clientKey,
  })
  return { snap, core }
}

export const snapScriptUrl = () =>
  config.midtrans.isProduction ? 'https://app.midtrans.com/snap/snap.js' : 'https://app.sandbox.midtrans.com/snap/snap.js'

/** Buat transaksi Snap untuk satu reservasi; kedaluwarsa mengikuti sisa waktu tahan kuota. */
export async function createSnapTransaction({ orderId, reservation, destinationName, minutesLeft }) {
  const { snap } = clients()
  return snap.createTransaction({
    transaction_details: { order_id: orderId, gross_amount: reservation.total },
    item_details: reservation.items.map((i) => ({
      id: i.ticketId,
      price: i.price,
      quantity: i.qty,
      name: `${i.name} - ${destinationName}`.slice(0, 50),
    })),
    customer_details: {
      first_name: reservation.contact.name.slice(0, 50),
      email: reservation.contact.email,
      phone: reservation.contact.phone,
    },
    expiry: { unit: 'minute', duration: Math.max(1, minutesLeft) },
    callbacks: { finish: `${config.appUrl}/reservasi/${reservation.id}` },
  })
}

export async function fetchTransactionStatus(orderId) {
  const { core } = clients()
  return core.transaction.status(orderId)
}

/** Verifikasi signature_key notifikasi Midtrans: SHA512(order_id + status_code + gross_amount + server_key). */
export function verifySignature(n) {
  const expected = createHash('sha512')
    .update(`${n.order_id}${n.status_code}${n.gross_amount}${config.midtrans.serverKey}`)
    .digest('hex')
  return typeof n.signature_key === 'string' && n.signature_key === expected
}

/** Petakan status transaksi Midtrans menjadi hasil: 'paid' | 'failed' | 'pending'. */
export function outcomeOf(n) {
  const s = n.transaction_status
  if (s === 'settlement' || (s === 'capture' && (!n.fraud_status || n.fraud_status === 'accept'))) return 'paid'
  if (['deny', 'cancel', 'expire', 'failure'].includes(s)) return 'failed'
  return 'pending'
}
