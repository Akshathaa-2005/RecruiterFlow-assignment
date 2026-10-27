/** Largest expense allowed, in paise: ₹10,00,000.00 */
export const MAX_AMOUNT = 100_000_000

const SCALE = 100
const INDIAN = new Intl.NumberFormat('en-IN')

/** 125050 -> "₹1,250.50", 100000000 -> "₹10,00,000.00" */
export function formatINR(paise: number): string {
  const sign = paise < 0 ? '-' : ''
  const abs = Math.abs(paise)
  const rupees = Math.floor(abs / SCALE)
  const rest = String(abs % SCALE).padStart(2, '0')
  return `${sign}₹${INDIAN.format(rupees)}.${rest}`
}

/** 149999 -> "1499.99", 100000 -> "1000": a number as the user would type it. */
export function toInputString(scaled: number): string {
  return formatPercent(scaled)
}

/** 3333 -> "33.33", 5000 -> "50", 1250 -> "12.5" */
export function formatPercent(basisPoints: number): string {
  const sign = basisPoints < 0 ? '-' : ''
  const abs = Math.abs(basisPoints)
  const whole = Math.floor(abs / SCALE)
  const rest = String(abs % SCALE)
    .padStart(2, '0')
    .replace(/0+$/, '')
  return rest === '' ? `${sign}${whole}` : `${sign}${whole}.${rest}`
}

export type DecimalParse =
  | { kind: 'ok'; value: number }
  | { kind: 'empty' }
  | { kind: 'invalid' }
  | { kind: 'too-many-decimals' }
  | { kind: 'too-large' }

const DECIMAL = /^(-?)(\d*)(?:\.(\d*))?$/
const MAX_WHOLE_DIGITS = 12

/**
 * Parses a decimal string with at most 2 decimals into an integer scaled by
 * 100, without going through floating point. "12.5" -> 1250, "-3" -> -300.
 * Used for rupees (-> paise) and for percentages (-> basis points).
 */
export function parseDecimal(input: string): DecimalParse {
  const text = input.trim()
  if (text === '') return { kind: 'empty' }

  const match = DECIMAL.exec(text)
  if (!match) return { kind: 'invalid' }

  const negative = match[1] === '-'
  const whole = match[2] ?? ''
  const fraction = match[3] ?? ''
  if (whole === '' && fraction === '') return { kind: 'invalid' }
  if (fraction.length > 2) return { kind: 'too-many-decimals' }
  if (whole.replace(/^0+/, '').length > MAX_WHOLE_DIGITS) {
    return { kind: 'too-large' }
  }

  const scaled = Number(whole || '0') * SCALE + Number(fraction.padEnd(2, '0'))
  return { kind: 'ok', value: negative && scaled !== 0 ? -scaled : scaled }
}
