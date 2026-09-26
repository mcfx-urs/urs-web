import { apiFetch } from './api'

export type LocationHistoryEntry = {
  location_history_id: string
  location_history_user_id: string
  location_history_latitude: string
  location_history_longitude: string
  location_history_accuracy_m?: string
  location_history_captured_at: string
  created_at: string
  updated_at: string
}

export type LifeMapPoint = {
  id: string
  latitude: number
  longitude: number
  capturedAt: Date
}

// `today`'s `days` value is never read - sinceDate special-cases it below to
// a real calendar-day boundary rather than a rolling window, unlike every
// other preset. Kept at 1 (same order of magnitude as `last_day`) purely for
// type-shape consistency with the rest of this list.
export const TIME_RANGES = [
  { key: 'today', label: 'Today', days: 1 },
  { key: 'last_day', label: 'Last day', days: 1 },
  { key: 'last_week', label: 'Last week', days: 7 },
  { key: 'last_month', label: 'Last month', days: 30 },
  { key: 'last_3_months', label: 'Last 3 months', days: 90 },
  { key: 'last_6_months', label: 'Last 6 months', days: 180 },
  { key: 'last_year', label: 'Last year', days: 365 },
  { key: 'all', label: 'All time', days: null },
] as const

export type TimeRangeKey = (typeof TIME_RANGES)[number]['key']

export function sinceDate(rangeKey: TimeRangeKey): Date | null {
  if (rangeKey === 'today') {
    const midnight = new Date()
    midnight.setHours(0, 0, 0, 0)
    return midnight
  }
  const range = TIME_RANGES.find((r) => r.key === rangeKey)
  if (!range || range.days === null) return null
  const since = new Date()
  since.setDate(since.getDate() - range.days)
  return since
}

// Backend timestamps are "YYYY-MM-DD HH:mm:ss" (space-separated, no
// timezone) - parsed/formatted by hand rather than via `new Date(str)`,
// since that non-ISO shape isn't guaranteed to parse as local time across
// engines (unlike the "YYYY-MM-DDTHH:mm:ss" case NotesPage relies on).
function parseBackendTimestamp(value: string): Date {
  const [datePart, timePart] = value.split(' ')
  const [y, mo, d] = datePart.split('-').map(Number)
  const [h, mi, s] = timePart.split(':').map(Number)
  return new Date(y, mo - 1, d, h, mi, s)
}

function formatBackendTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

const PAGE_SIZE = 10000
const EPOCH_START = '1970-01-01 00:00:00'

// The backend encodes an empty result set as JSON `null`, not `[]`.
async function jsonOrEmpty<T>(res: Response, action: string): Promise<T[]> {
  if (!res.ok) throw new Error(`${action} failed (${res.status})`)
  const data = await res.json()
  return (data ?? []) as T[]
}

async function fetchLocationHistoryPage(from: string): Promise<LocationHistoryEntry[]> {
  const res = await apiFetch(`/api/v1/location-history?from=${encodeURIComponent(from)}&limit=${PAGE_SIZE}&order=ASC`)
  return jsonOrEmpty<LocationHistoryEntry>(res, 'load location history')
}

/**
 * Walks every page oldest-to-newest, advancing `from` to one second past the
 * last row of each page - mirrors urs-android's
 * `LocationHistoryRepository.fetchAllPages`, needed for the same reason: the
 * endpoint's hard cap (10000 rows/call) is nowhere near "the whole history"
 * once a life map has been running for a while.
 */
export async function fetchLocationHistory(): Promise<LifeMapPoint[]> {
  const points: LifeMapPoint[] = []
  let from = EPOCH_START
  while (true) {
    const page = await fetchLocationHistoryPage(from)
    if (page.length === 0) break
    points.push(
      ...page.map((entry) => ({
        id: entry.location_history_id,
        latitude: Number(entry.location_history_latitude),
        longitude: Number(entry.location_history_longitude),
        capturedAt: parseBackendTimestamp(entry.location_history_captured_at),
      })),
    )
    if (page.length < PAGE_SIZE) break
    from = formatBackendTimestamp(
      new Date(parseBackendTimestamp(page[page.length - 1].location_history_captured_at).getTime() + 1000),
    )
  }
  return points
}
