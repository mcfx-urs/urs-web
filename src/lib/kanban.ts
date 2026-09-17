import { apiFetch } from './api'

// yyyy-MM-dd HH:mm:ss, device-local - matches the last-write-wins guard
// format urs-backend expects on board/column/card updates.
function nowStamp(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export type KanbanPriority = 'low' | 'medium' | 'high'

export type KanbanBoard = {
  kanban_board_id: string
  kanban_board_user_id: string
  kanban_board_name: string
  created_at: string
  updated_at: string
}

export type KanbanChecklistItem = {
  kanban_checklist_item_id: string
  kanban_checklist_item_card_id: string
  kanban_checklist_item_text: string
  kanban_checklist_item_done: boolean
  kanban_checklist_item_index: number
}

export type KanbanCard = {
  kanban_card_id: string
  kanban_card_column_id: string
  kanban_card_note_id: string | null
  kanban_card_title: string
  kanban_card_description?: string
  kanban_card_due_date: string
  kanban_card_priority: KanbanPriority
  kanban_card_index: number
  tags: string[]
  checklist: KanbanChecklistItem[]
  created_at: string
  updated_at: string
}

export type KanbanColumn = {
  kanban_column_id: string
  kanban_column_board_id: string
  kanban_column_name: string
  kanban_column_index: number
  cards: KanbanCard[]
  created_at: string
  updated_at: string
}

export type KanbanBoardDetail = KanbanBoard & { columns: KanbanColumn[] }

export type KanbanCardInput = {
  title: string
  description: string
  due_date: string
  priority: KanbanPriority
  note_id: string
  tags: string[]
}

async function json<T>(res: Response, action: string): Promise<T> {
  if (!res.ok) throw new Error(`${action} failed (${res.status})`)
  return res.json()
}

async function ok(res: Response, action: string): Promise<void> {
  if (!res.ok) throw new Error(`${action} failed (${res.status})`)
}

export async function fetchKanbanBoards(): Promise<KanbanBoard[]> {
  const res = await apiFetch('/api/v1/kanban/board')
  return json(res, 'load boards')
}

export async function fetchKanbanBoard(boardId: string): Promise<KanbanBoardDetail> {
  const res = await apiFetch(`/api/v1/kanban/board/${boardId}`)
  return json(res, 'load board')
}

export async function createKanbanBoard(name: string): Promise<KanbanBoard> {
  const res = await apiFetch('/api/v1/kanban/board', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  return json(res, 'create board')
}

export async function renameKanbanBoard(id: string, name: string): Promise<void> {
  const res = await apiFetch(`/api/v1/kanban/board/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, updated_at: nowStamp() }),
  })
  await ok(res, 'rename board')
}

export async function deleteKanbanBoard(id: string): Promise<void> {
  const res = await apiFetch(`/api/v1/kanban/board/${id}`, { method: 'DELETE' })
  await ok(res, 'delete board')
}

export async function createKanbanColumn(boardId: string, name: string): Promise<KanbanColumn> {
  const res = await apiFetch('/api/v1/kanban/column', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ board_id: boardId, name }),
  })
  return json(res, 'create column')
}

export async function renameKanbanColumn(id: string, name: string): Promise<void> {
  const res = await apiFetch(`/api/v1/kanban/column/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, updated_at: nowStamp() }),
  })
  await ok(res, 'rename column')
}

export async function moveKanbanColumn(id: string, index: number): Promise<void> {
  const res = await apiFetch(`/api/v1/kanban/column/${id}/move`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ index }),
  })
  await ok(res, 'move column')
}

export async function deleteKanbanColumn(id: string): Promise<void> {
  const res = await apiFetch(`/api/v1/kanban/column/${id}`, { method: 'DELETE' })
  await ok(res, 'delete column')
}

export async function createKanbanCard(columnId: string, input: Partial<KanbanCardInput> & { title: string }): Promise<KanbanCard> {
  const res = await apiFetch('/api/v1/kanban/card', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ column_id: columnId, ...input }),
  })
  return json(res, 'create card')
}

export async function updateKanbanCard(id: string, input: KanbanCardInput): Promise<KanbanCard> {
  const res = await apiFetch(`/api/v1/kanban/card/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, updated_at: nowStamp() }),
  })
  return json(res, 'update card')
}

export async function moveKanbanCard(id: string, columnId: string, index: number): Promise<void> {
  const res = await apiFetch(`/api/v1/kanban/card/${id}/move`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ column_id: columnId, index }),
  })
  await ok(res, 'move card')
}

export async function deleteKanbanCard(id: string): Promise<void> {
  const res = await apiFetch(`/api/v1/kanban/card/${id}`, { method: 'DELETE' })
  await ok(res, 'delete card')
}

export async function createKanbanChecklistItem(cardId: string, text: string): Promise<KanbanChecklistItem> {
  const res = await apiFetch('/api/v1/kanban/checklist-item', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ card_id: cardId, text }),
  })
  return json(res, 'add checklist item')
}

export async function updateKanbanChecklistItem(id: string, text: string, done: boolean): Promise<void> {
  const res = await apiFetch(`/api/v1/kanban/checklist-item/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, done }),
  })
  await ok(res, 'update checklist item')
}

export async function deleteKanbanChecklistItem(id: string): Promise<void> {
  const res = await apiFetch(`/api/v1/kanban/checklist-item/${id}`, { method: 'DELETE' })
  await ok(res, 'delete checklist item')
}
