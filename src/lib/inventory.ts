import { apiFetch } from './api'

export type Inventory = {
  inventory_id: string
  inventory_name: string
  inventory_owner_user_id: string
  created_at: string
  updated_at: string
}

export type InventoryProduct = {
  inventory_product_id: string
  inventory_product_inventory_id: string
  inventory_product_catalog_product_id: string
  inventory_product_quantity: string
  inventory_product_first_threshold: string
  inventory_product_second_threshold: string
  inventory_product_reminder_threshold: string
  inventory_product_reminder_hour: string
  inventory_product_reminder_minute: string
  created_at: string
  updated_at: string
}

export type InventoryShare = {
  inventory_share_id: string
  inventory_share_inventory_id: string
  inventory_share_user_id: string
  created_at: string
}

async function json<T>(res: Response, action: string): Promise<T> {
  if (!res.ok) throw new Error(`${action} failed (${res.status})`)
  return res.json()
}

// yyyy-MM-dd HH:mm:ss, device-local - matches the last-write-wins guard
// format urs-backend expects on inventory-product/list quantity updates.
function nowStamp(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export async function fetchInventories(): Promise<Inventory[]> {
  const res = await apiFetch('/api/v1/inventory')
  return json(res, 'load inventories')
}

export async function createInventory(name: string): Promise<Inventory> {
  const res = await apiFetch('/api/v1/inventory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inventory_name: name }),
  })
  return json(res, 'create inventory')
}

export async function renameInventory(id: string, name: string): Promise<void> {
  const res = await apiFetch(`/api/v1/inventory/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inventory_name: name }),
  })
  if (!res.ok) throw new Error(`rename inventory failed (${res.status})`)
}

export async function deleteInventory(id: string): Promise<void> {
  const res = await apiFetch(`/api/v1/inventory/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`delete inventory failed (${res.status})`)
}

export async function fetchInventoryProducts(inventoryId: string): Promise<InventoryProduct[]> {
  const res = await apiFetch(`/api/v1/inventory-product/${inventoryId}`)
  return json(res, 'load inventory products')
}

export async function addInventoryProduct(
  inventoryId: string,
  catalogProductId: string,
  quantity: string,
): Promise<InventoryProduct> {
  const res = await apiFetch('/api/v1/inventory-product', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      inventory_product_inventory_id: inventoryId,
      inventory_product_catalog_product_id: catalogProductId,
      inventory_product_quantity: quantity,
    }),
  })
  return json(res, 'add inventory product')
}

export async function updateInventoryProductQuantity(id: string, quantity: string): Promise<void> {
  const res = await apiFetch(`/api/v1/inventory-product/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      inventory_product_quantity: quantity,
      inventory_product_updated_at: nowStamp(),
    }),
  })
  if (!res.ok) throw new Error(`update quantity failed (${res.status})`)
}

export type InventoryProductSettingsInput = {
  first_threshold: string
  second_threshold: string
  reminder_threshold: string
  reminder_hour: string
  reminder_minute: string
}

export async function updateInventoryProductSettings(id: string, input: InventoryProductSettingsInput): Promise<void> {
  const res = await apiFetch(`/api/v1/inventory-product/${id}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      inventory_product_first_threshold: input.first_threshold,
      inventory_product_second_threshold: input.second_threshold,
      inventory_product_reminder_threshold: input.reminder_threshold,
      inventory_product_reminder_hour: input.reminder_hour,
      inventory_product_reminder_minute: input.reminder_minute,
    }),
  })
  if (!res.ok) throw new Error(`update settings failed (${res.status})`)
}

export async function deleteInventoryProduct(id: string): Promise<void> {
  const res = await apiFetch(`/api/v1/inventory-product/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`delete inventory product failed (${res.status})`)
}

export async function fetchInventoryShares(inventoryId: string): Promise<InventoryShare[]> {
  const res = await apiFetch(`/api/v1/inventory/${inventoryId}/share`)
  return json(res, 'load inventory shares')
}

export async function addInventoryShare(inventoryId: string, userId: string): Promise<void> {
  const res = await apiFetch(`/api/v1/inventory/${inventoryId}/share`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inventory_share_user_id: userId }),
  })
  if (!res.ok) throw new Error(`share inventory failed (${res.status})`)
}

export async function removeInventoryShare(inventoryId: string, userId: string): Promise<void> {
  const res = await apiFetch(`/api/v1/inventory/${inventoryId}/share/${userId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`unshare inventory failed (${res.status})`)
}
