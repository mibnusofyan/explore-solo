// Metode pembayaran yang ditampilkan pada simulasi Midtrans Snap (sandbox).
export const PAYMENT_GROUPS = [
  {
    id: 'va',
    label: 'Virtual Account',
    methods: [
      { id: 'bca_va', label: 'BCA Virtual Account', short: 'BCA', color: '#0060AF' },
      { id: 'bni_va', label: 'BNI Virtual Account', short: 'BNI', color: '#F15A23' },
      { id: 'bri_va', label: 'BRI Virtual Account', short: 'BRI', color: '#00529C' },
      { id: 'mandiri_va', label: 'Mandiri Bill Payment', short: 'MDR', color: '#003D79' },
    ],
  },
  {
    id: 'qris',
    label: 'QRIS',
    methods: [{ id: 'qris', label: 'QRIS (semua e-wallet & m-banking)', short: 'QRIS', color: '#222222' }],
  },
  {
    id: 'ewallet',
    label: 'Dompet digital',
    methods: [
      { id: 'gopay', label: 'GoPay', short: 'GP', color: '#00AA13' },
      { id: 'shopeepay', label: 'ShopeePay', short: 'SP', color: '#EE4D2D' },
      { id: 'dana', label: 'DANA', short: 'DANA', color: '#118EEA' },
    ],
  },
]

export const ALL_METHODS = PAYMENT_GROUPS.flatMap((g) => g.methods.map((m) => ({ ...m, group: g.id })))

export function methodLabel(id) {
  if (id === 'gratis') return 'Tanpa biaya'
  return ALL_METHODS.find((m) => m.id === id)?.label ?? id
}

/** Nomor VA tiruan yang stabil per reservasi. */
export function vaNumber(method, code) {
  const prefix = { bca_va: '12345', bni_va: '8808', bri_va: '26215', mandiri_va: '89508' }[method] || '9000'
  const digits = [...code].map((c) => c.charCodeAt(0) % 10).join('')
  return `${prefix}${digits}081234`.slice(0, 16)
}
