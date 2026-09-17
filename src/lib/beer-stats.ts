import { formatDateISO } from './date-utils'
import type { BeerLogEntry } from './beer'

export type Bucket = { label: string; count: number }

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// beer_log_date is "yyyy-MM-dd HH:mm:ss", naive local wall-clock - parsed via
// its date portion only, never through the UTC-parsing ISO Date constructor.
function parseLocalDate(raw: string): Date {
  const [y, m, d] = raw.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

// Direct port of urs-android's BeerStats.dailyCounts: last 30 calendar days
// (inclusive of today), one bucket per day even if empty, label = day-of-month.
export function dailyCounts(entries: BeerLogEntry[], today: Date = new Date(), days = 30): Bucket[] {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1))
  const counts = new Map<string, number>()
  for (const entry of entries) {
    const key = formatDateISO(parseLocalDate(entry.beer_log_date))
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const buckets: Bucket[] = []
  for (let i = 0; i < days; i++) {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    buckets.push({ label: String(day.getDate()), count: counts.get(formatDateISO(day)) ?? 0 })
  }
  return buckets
}

// Direct port of urs-android's BeerStats.monthlyCounts: last 12 calendar
// months, one bucket per month, label = 3-letter month abbreviation.
export function monthlyCounts(entries: BeerLogEntry[], today: Date = new Date(), months = 12): Bucket[] {
  const start = new Date(today.getFullYear(), today.getMonth() - (months - 1), 1)
  const counts = new Map<string, number>()
  for (const entry of entries) {
    const d = parseLocalDate(entry.beer_log_date)
    const key = `${d.getFullYear()}-${d.getMonth()}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const buckets: Bucket[] = []
  for (let i = 0; i < months; i++) {
    const month = new Date(start.getFullYear(), start.getMonth() + i, 1)
    const key = `${month.getFullYear()}-${month.getMonth()}`
    buckets.push({ label: MONTH_LABELS[month.getMonth()], count: counts.get(key) ?? 0 })
  }
  return buckets
}

const BATHTUB_LITERS = 150

export function totalLitersThisYear(entries: BeerLogEntry[], year: number = new Date().getFullYear()): number {
  const totalMl = entries
    .filter((e) => parseLocalDate(e.beer_log_date).getFullYear() === year)
    .reduce((sum, e) => sum + (Number(e.beer_log_amount_ml) || 0), 0)
  return totalMl / 1000
}

export function bathtubs(liters: number): number {
  return liters / BATHTUB_LITERS
}
