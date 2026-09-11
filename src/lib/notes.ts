import { apiFetch } from './api'

export type NoteStatus = 'active' | 'completed'

export type Note = {
  note_id: string
  note_user_id: string
  note_title: string
  note_content: string
  note_reminder_at: string | null
  note_status: NoteStatus
  note_completed_at: string | null
  tags: string[]
  created_at: string
  updated_at: string
}

export type NoteInput = {
  title: string
  content: string
  reminder_at?: string
  tags: string[]
}

async function json<T>(res: Response, action: string): Promise<T> {
  if (!res.ok) throw new Error(`${action} failed (${res.status})`)
  return res.json()
}

export async function fetchNotes(status?: NoteStatus): Promise<Note[]> {
  const qs = status ? `?status=${status}` : ''
  const res = await apiFetch(`/api/v1/note${qs}`)
  return json(res, 'load notes')
}

export async function createNote(input: NoteInput): Promise<Note> {
  const res = await apiFetch('/api/v1/note', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return json(res, 'create note')
}

export async function updateNote(id: string, input: NoteInput): Promise<Note> {
  const res = await apiFetch(`/api/v1/note/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return json(res, 'update note')
}

export async function setNoteStatus(id: string, status: NoteStatus): Promise<void> {
  const res = await apiFetch(`/api/v1/note/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })
  if (!res.ok) throw new Error(`update note status failed (${res.status})`)
}

export async function deleteNote(id: string): Promise<void> {
  const res = await apiFetch(`/api/v1/note/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`delete note failed (${res.status})`)
}
