import { apiFetch } from './api'
import { formatDateTimeLocal } from './date-utils'

// Mirrors urs-android's BeerLogDto - amount is a string on the wire, not a
// number, and is immutable after creation (only the date is ever edited).
export type BeerLogEntry = {
  beer_log_id: string
  beer_log_amount_ml: string
  beer_log_date: string
}

// Already sorted DESC by date server-side, scoped to the caller.
export async function fetchBeerLog(): Promise<BeerLogEntry[]> {
  const res = await apiFetch('/api/v1/beer-log')
  if (!res.ok) throw new Error(`load beer log failed (${res.status})`)
  return res.json()
}

export async function createBeerLogEntry(amountMl: number): Promise<void> {
  const res = await apiFetch('/api/v1/beer-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ beer_log_amount_ml: String(amountMl), beer_log_date: formatDateTimeLocal(new Date()) }),
  })
  if (!res.ok) throw new Error(`log beer failed (${res.status})`)
}

// Only the date is ever editable - amount is locked once logged.
export async function updateBeerLogDate(id: string, date: string): Promise<void> {
  const res = await apiFetch(`/api/v1/beer-log/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ beer_log_date: date }),
  })
  if (!res.ok) throw new Error(`update beer log failed (${res.status})`)
}

export async function deleteBeerLogEntry(id: string): Promise<void> {
  const res = await apiFetch(`/api/v1/beer-log/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`delete beer log failed (${res.status})`)
}

// "500" -> "5dl", "330" -> "33cl", anything else -> "N ml" - matches
// urs-android's formatAmount() exactly.
export function formatBeerAmount(amountMl: string): string {
  if (amountMl === '500') return '5dl'
  if (amountMl === '330') return '33cl'
  return `${amountMl} ml`
}
