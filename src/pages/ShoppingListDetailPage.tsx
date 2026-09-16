import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import CatalogPicker from '@/components/CatalogPicker'
import TopBar from '@/components/TopBar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { fetchCatalogProducts, type CatalogProduct } from '@/lib/catalog'
import { GLASS_BACKGROUND_GRADIENT_CLASS, GLASS_CARD_CLASS } from '@/lib/glass-style'
import {
  addShoppingListItem,
  deleteShoppingListItem,
  fetchRecentlyUsedProducts,
  fetchShoppingListItems,
  fetchShoppingLists,
  updateShoppingListItem,
  type ShoppingListItem,
} from '@/lib/shopping-list'

export default function ShoppingListDetailPage() {
  const { id } = useParams<{ id: string }>()
  const listId = id as string
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ShoppingListItem | null>(null)

  const { data: lists } = useQuery({ queryKey: ['shopping-lists'], queryFn: fetchShoppingLists })
  const list = lists?.find((l) => l.list_id === listId)

  const { data: items, isLoading } = useQuery({
    queryKey: ['shopping-list-items', listId],
    queryFn: () => fetchShoppingListItems(listId),
  })

  const { data: recentlyUsed } = useQuery({
    queryKey: ['recently-used-products', listId],
    queryFn: () => fetchRecentlyUsedProducts(listId),
  })
  const { data: catalogProducts } = useQuery({ queryKey: ['catalog-products'], queryFn: fetchCatalogProducts })
  const catalogById = useMemo(
    () => new Map((catalogProducts ?? []).map((p) => [p.catalog_product_id, p])),
    [catalogProducts],
  )
  const onListCatalogProductIds = useMemo(
    () => new Set((items ?? []).map((i) => i.list_item_catalog_product_id)),
    [items],
  )
  const recentSuggestions = (recentlyUsed ?? []).filter((r) => !onListCatalogProductIds.has(r.catalog_product_id))

  const grouped = useMemo(() => {
    const map = new Map<string, ShoppingListItem[]>()
    for (const item of items ?? []) {
      const key = item.catalog_category_name || 'Other'
      const list = map.get(key) ?? []
      list.push(item)
      map.set(key, list)
    }
    return map
  }, [items])

  const addMutation = useMutation({
    mutationFn: (catalogProductId: string) => addShoppingListItem(listId, catalogProductId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shopping-list-items', listId] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (itemId: string) => deleteShoppingListItem(itemId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shopping-list-items', listId] }),
  })

  const onSaleMutation = useMutation({
    mutationFn: (item: ShoppingListItem) =>
      updateShoppingListItem(item.list_item_id, {
        note: item.list_item_note,
        quantity: item.list_item_quantity,
        onSale: !item.list_item_on_sale,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shopping-list-items', listId] }),
  })

  return (
    <div className={`min-h-svh bg-background ${GLASS_BACKGROUND_GRADIENT_CLASS}`}>
      <TopBar />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <button
              type="button"
              onClick={() => navigate('/shopping')}
              className="mb-1 text-xs text-muted-foreground hover:text-foreground"
            >
              &larr; Shopping lists
            </button>
            <h1 className="text-base font-bold">{list?.list_name ?? '...'}</h1>
          </div>
          <Button onClick={() => setPickerOpen(true)}>Add product</Button>
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {!isLoading && (items ?? []).length === 0 && <p className="text-sm text-muted-foreground">List is empty.</p>}

        <div className="flex flex-col gap-6">
          {Array.from(grouped.entries()).map(([category, categoryItems]) => (
            <div key={category}>
              <div className="mb-2 text-xs font-semibold text-muted-foreground uppercase">{category}</div>
              <div className="flex flex-col gap-2">
                {categoryItems.map((item) => (
                  <div
                    key={item.list_item_id}
                    className={`flex items-center gap-3 rounded-xl p-3 ${GLASS_CARD_CLASS}`}
                  >
                    <div className="flex-1">
                      <div className="text-sm font-bold" style={item.list_item_on_sale ? { color: '#E0813F' } : undefined}>
                        {item.catalog_product_name}
                        {item.list_item_quantity ? ` (${item.list_item_quantity})` : ''}
                      </div>
                      {item.list_item_note && (
                        <div className="text-xs text-muted-foreground">{item.list_item_note}</div>
                      )}
                    </div>
                    <label className="flex items-center gap-1 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={item.list_item_on_sale}
                        onChange={() => onSaleMutation.mutate(item)}
                        className="size-4 accent-primary"
                      />
                      Sale
                    </label>
                    <Button size="sm" variant="outline" onClick={() => setEditingItem(item)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => deleteMutation.mutate(item.list_item_id)}>
                      Done
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {recentSuggestions.length > 0 && (
          <div className="mt-8">
            <div className="mb-2 text-xs font-semibold text-muted-foreground uppercase">Recently used</div>
            <div className="flex flex-wrap gap-2">
              {recentSuggestions.map((r) => (
                <button
                  key={r.catalog_product_id}
                  type="button"
                  onClick={() => addMutation.mutate(r.catalog_product_id)}
                  className={`rounded-full px-3 py-1.5 text-xs hover:bg-accent ${GLASS_CARD_CLASS}`}
                >
                  + {catalogById.get(r.catalog_product_id)?.catalog_product_name ?? 'Product'}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      <CatalogPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onPick={(p: CatalogProduct) => addMutation.mutate(p.catalog_product_id)}
      />

      {editingItem && (
        <ShoppingListItemEditDialog
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['shopping-list-items', listId] })
            setEditingItem(null)
          }}
        />
      )}
    </div>
  )
}

function ShoppingListItemEditDialog({
  item,
  onClose,
  onSaved,
}: {
  item: ShoppingListItem
  onClose: () => void
  onSaved: () => void
}) {
  const [note, setNote] = useState(item.list_item_note)
  const [quantity, setQuantity] = useState(item.list_item_quantity != null ? String(item.list_item_quantity) : '')

  const saveMutation = useMutation({
    mutationFn: () =>
      updateShoppingListItem(item.list_item_id, {
        note,
        quantity: quantity.trim() === '' ? null : Number(quantity),
        onSale: item.list_item_on_sale,
      }),
    onSuccess: onSaved,
  })

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item.catalog_product_name}</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            saveMutation.mutate()
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="item-quantity">Quantity</Label>
            <Input
              id="item-quantity"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="item-note">Note</Label>
            <Input id="item-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={saveMutation.isPending}>
              Save
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
