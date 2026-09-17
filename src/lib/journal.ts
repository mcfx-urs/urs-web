import { apiFetch } from './api'

// Adapted from lib/chores.ts as a starting point (mcfx-urs/urs-web#28) -
// kept as its own file rather than editing chores.ts in place, since Chores
// keeps running unchanged until Journal is confirmed working end to end.

export type JournalDomain = {
  journal_domain_id: string
  journal_domain_user_id: string
  journal_domain_name: string
  journal_domain_color: string
  journal_domain_icon: string
  journal_domain_position: number
  created_at: string
  updated_at: string
}

export type JournalDomainInput = {
  journal_domain_name: string
  journal_domain_color: string
  journal_domain_icon: string
}

export type JournalType = {
  tracker_type_id: string
  tracker_type_user_id: string
  tracker_type_domain_id: string
  tracker_type_name: string
  tracker_type_color: string
  tracker_type_icon: string
  tracker_type_calendar?: string
  tracker_type_expected_interval_days?: number
  tracker_type_archived_at?: string
  tracker_type_last_exported_at?: string
  created_at: string
  updated_at: string
}

export type JournalTypeInput = {
  tracker_type_domain_id: string
  tracker_type_name: string
  tracker_type_color: string
  tracker_type_icon: string
  tracker_type_calendar?: string
  tracker_type_expected_interval_days?: number
}

// OccurredOnEnd/OccurredAtEnd (mcfx-urs/urs-backend#8): both independent and
// optional. A missing/empty OccurredOnEnd means single-day; a missing/empty
// OccurredAtEnd means no specific end time (all-day for that/those days).
export type JournalEvent = {
  tracker_event_id: string
  tracker_event_user_id: string
  tracker_event_tracker_type_id: string
  tracker_event_occurred_on: string
  tracker_event_occurred_on_end?: string
  tracker_event_occurred_at?: string
  tracker_event_occurred_at_end?: string
  tracker_event_note?: string
  tracker_event_source: string
  created_at: string
  updated_at: string
}

export type JournalEventInput = {
  tracker_event_tracker_type_id: string
  tracker_event_occurred_on: string
  tracker_event_occurred_on_end?: string
  tracker_event_occurred_at?: string
  tracker_event_occurred_at_end?: string
  tracker_event_note?: string
  tracker_event_source?: string
}

async function json<T>(res: Response, action: string): Promise<T> {
  if (!res.ok) throw new Error(`${action} failed (${res.status})`)
  return res.json()
}

export async function fetchJournalDomains(): Promise<JournalDomain[]> {
  const res = await apiFetch('/api/v1/journal-domain')
  return json(res, 'load journal domains')
}

export async function createJournalDomain(input: JournalDomainInput): Promise<JournalDomain> {
  const res = await apiFetch('/api/v1/journal-domain', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return json(res, 'create journal domain')
}

export async function updateJournalDomain(id: string, input: JournalDomainInput): Promise<void> {
  const res = await apiFetch(`/api/v1/journal-domain/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(`update journal domain failed (${res.status})`)
}

export async function deleteJournalDomain(id: string): Promise<void> {
  const res = await apiFetch(`/api/v1/journal-domain/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`delete journal domain failed (${res.status})`)
}

export async function fetchJournalTypes(): Promise<JournalType[]> {
  const res = await apiFetch('/api/v1/tracker-type')
  return json(res, 'load journal types')
}

export async function createJournalType(input: JournalTypeInput): Promise<JournalType> {
  const res = await apiFetch('/api/v1/tracker-type', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return json(res, 'create journal type')
}

export async function updateJournalType(id: string, input: JournalTypeInput): Promise<void> {
  const res = await apiFetch(`/api/v1/tracker-type/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(`update journal type failed (${res.status})`)
}

export async function archiveJournalType(id: string): Promise<void> {
  const res = await apiFetch(`/api/v1/tracker-type/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`archive journal type failed (${res.status})`)
}

export async function fetchJournalEvents(from: string, to: string): Promise<JournalEvent[]> {
  const res = await apiFetch(`/api/v1/tracker-event?from=${from}&to=${to}`)
  return json(res, 'load journal events')
}

export async function createJournalEvent(input: JournalEventInput): Promise<JournalEvent> {
  const res = await apiFetch('/api/v1/tracker-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return json(res, 'log journal event')
}

export async function updateJournalEvent(id: string, input: JournalEventInput): Promise<void> {
  const res = await apiFetch(`/api/v1/tracker-event/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(`update journal event failed (${res.status})`)
}

export async function deleteJournalEvent(id: string): Promise<void> {
  const res = await apiFetch(`/api/v1/tracker-event/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`delete journal event failed (${res.status})`)
}
