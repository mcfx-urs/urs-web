import { apiFetch } from './api'

export type TrackerType = {
  tracker_type_id: string
  tracker_type_user_id: string
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

export type TrackerTypeInput = {
  tracker_type_name: string
  tracker_type_color: string
  tracker_type_icon: string
  tracker_type_calendar?: string
  tracker_type_expected_interval_days?: number
}

export type TrackerEvent = {
  tracker_event_id: string
  tracker_event_user_id: string
  tracker_event_tracker_type_id: string
  tracker_event_occurred_on: string
  tracker_event_occurred_at?: string
  tracker_event_note?: string
  tracker_event_source: string
  created_at: string
  updated_at: string
}

export type TrackerEventInput = {
  tracker_event_tracker_type_id: string
  tracker_event_occurred_on: string
  tracker_event_occurred_at?: string
  tracker_event_note?: string
  tracker_event_source?: string
}

async function json<T>(res: Response, action: string): Promise<T> {
  if (!res.ok) throw new Error(`${action} failed (${res.status})`)
  return res.json()
}

export async function fetchTrackerTypes(): Promise<TrackerType[]> {
  const res = await apiFetch('/api/v1/tracker-type')
  return json(res, 'load chore types')
}

export async function createTrackerType(input: TrackerTypeInput): Promise<TrackerType> {
  const res = await apiFetch('/api/v1/tracker-type', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return json(res, 'create chore type')
}

export async function updateTrackerType(id: string, input: TrackerTypeInput): Promise<void> {
  const res = await apiFetch(`/api/v1/tracker-type/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(`update chore type failed (${res.status})`)
}

export async function archiveTrackerType(id: string): Promise<void> {
  const res = await apiFetch(`/api/v1/tracker-type/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`archive chore type failed (${res.status})`)
}

export async function reactivateTrackerType(id: string): Promise<void> {
  const res = await apiFetch(`/api/v1/tracker-type/${id}/reactivate`, { method: 'PUT' })
  if (!res.ok) throw new Error(`reactivate chore type failed (${res.status})`)
}

export async function fetchTrackerEvents(from: string, to: string): Promise<TrackerEvent[]> {
  const res = await apiFetch(`/api/v1/tracker-event?from=${from}&to=${to}`)
  return json(res, 'load chore events')
}

export async function createTrackerEvent(input: TrackerEventInput): Promise<TrackerEvent> {
  const res = await apiFetch('/api/v1/tracker-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return json(res, 'log chore event')
}

export async function updateTrackerEvent(id: string, input: TrackerEventInput): Promise<void> {
  const res = await apiFetch(`/api/v1/tracker-event/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(`update chore event failed (${res.status})`)
}

export async function deleteTrackerEvent(id: string): Promise<void> {
  const res = await apiFetch(`/api/v1/tracker-event/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`delete chore event failed (${res.status})`)
}
