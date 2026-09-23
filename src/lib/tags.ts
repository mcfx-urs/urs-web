import { apiFetch } from './api'

// Server-assigned and never changes once created (mcfx-urs/urs-backend#7,
// extended to Kanban card tags by mcfx-urs/urs-backend#11 — Notes and
// Kanban now share one per-user tag pool/color).
export type Tag = { name: string; color: string }

async function json<T>(res: Response, action: string): Promise<T> {
  if (!res.ok) throw new Error(`${action} failed (${res.status})`)
  return res.json()
}

// The caller's full tag pool, for autocomplete that isn't limited to tags
// already attached to already-fetched notes/cards.
export async function fetchTags(): Promise<Tag[]> {
  const res = await apiFetch('/api/v1/tags')
  return json(res, 'load tags')
}
