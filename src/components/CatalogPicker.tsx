import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { fetchCatalogCategories, fetchCatalogProducts, findOrCreateCatalogProduct, type CatalogProduct } from '@/lib/catalog'

type CatalogPickerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (product: CatalogProduct) => void
}

// Reused by both Inventory and Shopping List - search + category-grouped
// browse of the shared catalog, with a find-or-create fallback when the
// search doesn't match anything yet. Simplified from urs-android's
// AddProductScreen (which also has separate "frequent"/"recently used"
// tabs) to one search+browse view for the initial web port.
export default function CatalogPicker({ open, onOpenChange, onPick }: CatalogPickerProps) {
  const [query, setQuery] = useState('')
  const queryClient = useQueryClient()

  const { data: products } = useQuery({ queryKey: ['catalog-products'], queryFn: fetchCatalogProducts, enabled: open })
  const { data: categories } = useQuery({ queryKey: ['catalog-categories'], queryFn: fetchCatalogCategories, enabled: open })
  const categoryById = useMemo(() => new Map((categories ?? []).map((c) => [c.catalog_category_id, c])), [categories])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return products ?? []
    return (products ?? []).filter(
      (p) =>
        p.catalog_product_name.toLowerCase().includes(q) ||
        p.catalog_product_search_terms.toLowerCase().includes(q) ||
        p.catalog_product_brands.toLowerCase().includes(q),
    )
  }, [products, query])

  const grouped = useMemo(() => {
    const map = new Map<string, CatalogProduct[]>()
    for (const p of filtered) {
      const key = p.catalog_product_catalog_category_id || ''
      const list = map.get(key) ?? []
      list.push(p)
      map.set(key, list)
    }
    return map
  }, [filtered])

  const createMutation = useMutation({
    mutationFn: () => findOrCreateCatalogProduct(query.trim()),
    onSuccess: (product) => {
      queryClient.invalidateQueries({ queryKey: ['catalog-products'] })
      setQuery('')
      onOpenChange(false)
      onPick(product)
    },
  })

  function pick(product: CatalogProduct) {
    setQuery('')
    onOpenChange(false)
    onPick(product)
  }

  const exactMatch = filtered.some((p) => p.catalog_product_name.toLowerCase() === query.trim().toLowerCase())

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add product</DialogTitle>
        </DialogHeader>
        <Input placeholder="Search..." value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
        <div className="flex max-h-80 flex-col gap-3 overflow-y-auto">
          {Array.from(grouped.entries()).map(([categoryId, items]) => (
            <div key={categoryId || 'uncategorized'}>
              <div className="mb-1 text-xs font-semibold text-muted-foreground">
                {categoryById.get(categoryId)?.catalog_category_name ?? 'Other'}
              </div>
              <div className="flex flex-col gap-1">
                {items.map((p) => (
                  <button
                    key={p.catalog_product_id}
                    type="button"
                    onClick={() => pick(p)}
                    className="rounded-lg border border-border px-3 py-2 text-left text-sm hover:bg-muted"
                  >
                    {p.catalog_product_name}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {query.trim() && !exactMatch && (
            <Button
              type="button"
              variant="outline"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
            >
              Add &quot;{query.trim()}&quot; as new product
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
