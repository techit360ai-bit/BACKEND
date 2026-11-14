// Exact conversion between minor units (the platform's stored unit: cents,
// kobo, pesewas) and provider major units. Stripe and Paystack take minor
// units; Flutterwave takes and reports MAJOR units. Floating-point math
// (`19.99 * 100 === 1998.9999999999998`) is avoided by working on decimal
// strings.

const ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF',
  'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
])
const THREE_DECIMAL_CURRENCIES = new Set(['BHD', 'JOD', 'KWD', 'OMR', 'TND'])

export function currencyExponent(currency) {
  const code = String(currency || '').trim().toUpperCase()
  if (ZERO_DECIMAL_CURRENCIES.has(code)) return 0
  if (THREE_DECIMAL_CURRENCIES.has(code)) return 3
  return 2
}

// Integer minor units -> major-unit decimal string (e.g. 199900 NGN -> "1999.00").
export function minorToMajorString(minor, currency) {
  const value = Number(minor)
  if (!Number.isFinite(value)) throw new Error('invalid_amount')
  const integer = Math.round(value)
  const exponent = currencyExponent(currency)
  if (exponent === 0) return String(integer)
  const sign = integer < 0 ? '-' : ''
  const digits = String(Math.abs(integer)).padStart(exponent + 1, '0')
  return `${sign}${digits.slice(0, -exponent)}.${digits.slice(-exponent)}`
}

// Major units (number or decimal string) -> integer minor units, half-up.
// Returns null when the input is not a plain decimal amount.
export function majorToMinor(major, currency) {
  if (major === null || major === undefined || major === '') return null
  const textValue = typeof major === 'number' ? (Number.isFinite(major) ? String(major) : '') : String(major).trim()
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(textValue)
  if (!match) return null
  const [, sign, whole, fraction = ''] = match
  const exponent = currencyExponent(currency)
  const kept = (fraction + '0'.repeat(exponent)).slice(0, exponent)
  const roundUp = fraction.length > exponent && Number(fraction[exponent]) >= 5
  const minor = Number(`${whole}${kept}`) + (roundUp ? 1 : 0)
  return sign === '-' ? -minor : minor
}
