// Local-component formatting throughout - avoids the UTC-conversion
// off-by-one that new Date().toISOString() can introduce near midnight.
export function formatDateISO(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Inverse of formatDateISO - constructed from local y/m/d components, never
// via the ISO-string Date constructor (which parses as UTC and can shift a
// day near midnight in non-UTC timezones).
export function parseDateISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// Local wall-clock "yyyy-MM-dd HH:mm:ss" - the wire format urs-android's
// naive-datetime fields use (beer log, fuel fills, baking plans). Never a
// UTC conversion, matching the backend's own tolerance for device-local time.
export function formatDateTimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${formatDateISO(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

// Inverse of formatDateTimeLocal - parses "yyyy-MM-dd HH:mm:ss" as local wall-
// clock components, never through the UTC-parsing ISO Date constructor.
export function parseDateTimeLocal(raw: string): Date {
  const [datePart, timePart] = raw.split(' ')
  const [y, m, d] = datePart.split('-').map(Number)
  const [h, min, s] = (timePart ?? '00:00:00').split(':').map(Number)
  return new Date(y, m - 1, d, h, min, s ?? 0)
}

// Standard ISO 8601 week number (Monday-first weeks, week 1 contains the
// year's first Thursday) - used for Journal's month-grid week-number column
// (mcfx-urs/urs-web#28).
export function isoWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = (d.getUTCDay() + 6) % 7 // Mon=0..Sun=6
  d.setUTCDate(d.getUTCDate() - dayNum + 3) // nearest Thursday
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3)
  return 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86_400_000))
}

// Monday-first grid: leading `null`s pad out to the month's first weekday.
export function monthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const firstWeekday = (first.getDay() + 6) % 7 // 0=Mon..6=Sun
  const days: (Date | null)[] = Array(firstWeekday).fill(null)
  for (let d = 1; d <= last.getDate(); d++) {
    days.push(new Date(year, month, d))
  }
  return days
}
