const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** Today in the user's local time zone as YYYY-MM-DD. */
export function todayISO(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

/** True for real calendar dates written as YYYY-MM-DD ("2026-02-30" is not). */
export function isValidISODate(value: string): boolean {
  const match = ISO_DATE.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

/** "2026-03-12" -> "12 Mar 2026" */
export function formatDate(value: string): string {
  const match = ISO_DATE.exec(value)
  if (!match) return value
  const month = MONTHS[Number(match[2]) - 1]
  return month ? `${Number(match[3])} ${month} ${match[1]}` : value
}

/** "2026-03" -> "Mar 2026" */
export function formatMonth(value: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(value)
  const month = match ? MONTHS[Number(match[2]) - 1] : undefined
  return match && month ? `${month} ${match[1]}` : value
}
