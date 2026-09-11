import { apiFetch } from './api'

export type ShoppingList = {
  list_id: string
  list_name: string
  list_owner_user_id: string
  created_at: string
  updated_at: string
}

export type ShoppingListItem = {
  list_item_id: string
  list_item_list_id: string
  list_item_catalog_product_id: string
  catalog_product_name: string
  catalog_product_catalog_category_id: string
  catalog_category_name: string
  list_item_note: string
  list_item_quantity: number | null
  list_item_on_sale: boolean
  created_at: string
  updated_at: string
}

export type ShoppingListShare = {
  list_share_id: string
  list_share_list_id: string
  list_share_user_id: string
  created_at: string
}

export type RecentlyUsedProduct = {
  catalog_product_id: string
  last_used_at: string
}

async function json<T>(res: Response, action: string): Promise<T> {
  if (!res.ok) throw new Error(`${action} failed (${res.status})`)
  return res.json()
}

// yyyy-MM-dd HH:mm:ss, device-local - matches the last-write-wins guard
// format urs-backend expects on list/list-item updates.
function nowStamp(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export async function fetchShoppingLists(): Promise<ShoppingList[]> {
  const res = await apiFetch('/api/v1/list')
  return json(res, 'load lists')
}

export async function createShoppingList(name: string): Promise<ShoppingList> {
  const res = await apiFetch('/api/v1/list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ list_name: name }),
  })
  return json(res, 'create list')
}

export async function renameShoppingList(id: string, name: string): Promise<void> {
  const res = await apiFetch(`/api/v1/list/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ list_name: name, list_updated_at: nowStamp() }),
  })
  if (!res.ok) throw new Error(`rename list failed (${res.status})`)
}

export async function deleteShoppingList(id: string): Promise<void> {
  const res = await apiFetch(`/api/v1/list/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`delete list failed (${res.status})`)
}

export async function fetchShoppingListItems(listId: string): Promise<ShoppingListItem[]> {
  const res = await apiFetch(`/api/v1/list/${listId}/list-item`)
  return json(res, 'load list items')
}

export async function addShoppingListItem(
  listId: string,
  catalogProductId: string,
  options?: { note?: string; quantity?: number | null; onSale?: boolean },
): Promise<ShoppingListItem> {
  const res = await apiFetch('/api/v1/list-item', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      list_item_list_id: listId,
      list_item_catalog_product_id: catalogProductId,
      list_item_note: options?.note ?? '',
      list_item_quantity: options?.quantity ?? null,
      list_item_on_sale: options?.onSale ?? false,
    }),
  })
  return json(res, 'add list item')
}

export type ShoppingListItemUpdate = {
  note: string
  quantity: number | null
  onSale: boolean
}

export async function updateShoppingListItem(id: string, update: ShoppingListItemUpdate): Promise<void> {
  const res = await apiFetch(`/api/v1/list-item/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      list_item_note: update.note,
      list_item_quantity: update.quantity,
      list_item_on_sale: update.onSale,
      list_item_updated_at: nowStamp(),
    }),
  })
  if (!res.ok) throw new Error(`update list item failed (${res.status})`)
}

export async function deleteShoppingListItem(id: string): Promise<void> {
  const res = await apiFetch(`/api/v1/list-item/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`delete list item failed (${res.status})`)
}

export async function fetchRecentlyUsedProducts(listId: string): Promise<RecentlyUsedProduct[]> {
  const res = await apiFetch(`/api/v1/recently-used-product?list_id=${encodeURIComponent(listId)}`)
  return json(res, 'load recently used products')
}

export async function fetchShoppingListShares(listId: string): Promise<ShoppingListShare[]> {
  const res = await apiFetch(`/api/v1/list/${listId}/share`)
  return json(res, 'load list shares')
}

export async function addShoppingListShare(listId: string, userId: string): Promise<void> {
  const res = await apiFetch(`/api/v1/list/${listId}/share`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ list_share_user_id: userId }),
  })
  if (!res.ok) throw new Error(`share list failed (${res.status})`)
}

export async function removeShoppingListShare(listId: string, userId: string): Promise<void> {
  const res = await apiFetch(`/api/v1/list/${listId}/share/${userId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`unshare list failed (${res.status})`)
}
