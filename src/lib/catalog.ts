import { apiFetch } from './api'

// Shared product/category pool - global across all households, not
// per-user. GET returns everything unfiltered (a few thousand rows at
// most per urs-backend's own comment), client does search/filtering.
export type CatalogProduct = {
  catalog_product_id: string
  catalog_product_source: string
  catalog_product_catalog_category_id: string
  catalog_product_name: string
  catalog_product_search_terms: string
  catalog_product_brands: string
  catalog_product_catalog_image_id: string
  created_at: string
  updated_at: string
}

export type CatalogCategory = {
  catalog_category_id: string
  catalog_category_source: string
  catalog_category_name: string
  catalog_category_catalog_image_id: string
  created_at: string
  updated_at: string
}

async function json<T>(res: Response, action: string): Promise<T> {
  if (!res.ok) throw new Error(`${action} failed (${res.status})`)
  return res.json()
}

export async function fetchCatalogProducts(): Promise<CatalogProduct[]> {
  const res = await apiFetch('/api/v1/catalog-product')
  return json(res, 'load catalog products')
}

export async function fetchCatalogCategories(): Promise<CatalogCategory[]> {
  const res = await apiFetch('/api/v1/catalog-category')
  return json(res, 'load catalog categories')
}

// Lenient find-or-create (require_new: false) - matches urs-android's
// shopping-list/inventory quick-add flow, dedupes by name server-side.
export async function findOrCreateCatalogProduct(name: string, categoryId?: string): Promise<CatalogProduct> {
  const res = await apiFetch('/api/v1/catalog-product', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      catalog_product_name: name,
      catalog_product_catalog_category_id: categoryId ?? '',
      require_new: false,
    }),
  })
  return json(res, 'add catalog product')
}
