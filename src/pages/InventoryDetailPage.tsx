import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import CatalogPicker from '@/components/CatalogPicker'
import TopBar from '@/components/TopBar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { fetchCatalogCategories, fetchCatalogProducts, type CatalogProduct } from '@/lib/catalog'
import { GLASS_BACKGROUND_GRADIENT_CLASS, GLASS_CARD_CLASS } from '@/lib/glass-style'
import {
  addInventoryProduct,
  deleteInventoryProduct,
  fetchInventories,
  fetchInventoryProducts,
  updateInventoryProductQuantity,
  updateInventoryProductSettings,
  type InventoryProduct,
} from '@/lib/inventory'

const WARNING_COLOR = '#E0813F'
const CRITICAL_COLOR = '#D64545'

function warningColor(product: InventoryProduct): string | null {
  const qty = Number(product.inventory_product_quantity)
  const second = Number(product.inventory_product_second_threshold)
  const first = Number(product.inventory_product_first_threshold)
  if (!Number.isFinite(qty)) return null
  if (Number.isFinite(second) && product.inventory_product_second_threshold && qty <= second) return CRITICAL_COLOR
  if (Number.isFinite(first) && product.inventory_product_first_threshold && qty <= first) return WARNING_COLOR
  return null
}

export default function InventoryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const inventoryId = id as string
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<InventoryProduct | null>(null)

  const { data: inventories } = useQuery({ queryKey: ['inventories'], queryFn: fetchInventories })
  const inventory = inventories?.find((i) => i.inventory_id === inventoryId)

  const { data: products, isLoading } = useQuery({
    queryKey: ['inventory-products', inventoryId],
    queryFn: () => fetchInventoryProducts(inventoryId),
  })
  const { data: catalogProducts } = useQuery({ queryKey: ['catalog-products'], queryFn: fetchCatalogProducts })
  const { data: catalogCategories } = useQuery({ queryKey: ['catalog-categories'], queryFn: fetchCatalogCategories })

  const catalogById = useMemo(
    () => new Map((catalogProducts ?? []).map((p) => [p.catalog_product_id, p])),
    [catalogProducts],
  )
  const categoryById = useMemo(
    () => new Map((catalogCategories ?? []).map((c) => [c.catalog_category_id, c])),
    [catalogCategories],
  )

  const grouped = useMemo(() => {
    const map = new Map<string, InventoryProduct[]>()
    for (const p of products ?? []) {
      const catalogProduct = catalogById.get(p.inventory_product_catalog_product_id)
      const key = catalogProduct?.catalog_product_catalog_category_id || ''
      const list = map.get(key) ?? []
      list.push(p)
      map.set(key, list)
    }
    return map
  }, [products, catalogById])

  const addMutation = useMutation({
    mutationFn: (catalogProduct: CatalogProduct) => addInventoryProduct(inventoryId, catalogProduct.catalog_product_id, '1'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inventory-products', inventoryId] }),
  })

  const quantityMutation = useMutation({
    mutationFn: ({ productId, quantity }: { productId: string; quantity: string }) =>
      updateInventoryProductQuantity(productId, quantity),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inventory-products', inventoryId] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (productId: string) => deleteInventoryProduct(productId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inventory-products', inventoryId] }),
  })

  function adjustQuantity(product: InventoryProduct, delta: number) {
    const current = Number(product.inventory_product_quantity) || 0
    const next = Math.max(0, current + delta)
    quantityMutation.mutate({ productId: product.inventory_product_id, quantity: String(next) })
  }

  return (
    <div className={`min-h-svh bg-background ${GLASS_BACKGROUND_GRADIENT_CLASS}`}>
      <TopBar />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <button
              type="button"
              onClick={() => navigate('/inventory')}
              className="mb-1 text-xs text-muted-foreground hover:text-foreground"
            >
              &larr; Inventory
            </button>
            <h1 className="text-base font-bold">{inventory?.inventory_name ?? '...'}</h1>
          </div>
          <Button onClick={() => setPickerOpen(true)}>Add product</Button>
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {!isLoading && (products ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">No products yet.</p>
        )}

        <div className="flex flex-col gap-6">
          {Array.from(grouped.entries()).map(([categoryId, items]) => (
            <div key={categoryId || 'uncategorized'}>
              <div className="mb-2 text-xs font-semibold text-muted-foreground uppercase">
                {categoryById.get(categoryId)?.catalog_category_name ?? 'Other'}
              </div>
              <div className="flex flex-col gap-2">
                {items.map((product) => {
                  const catalogProduct = catalogById.get(product.inventory_product_catalog_product_id)
                  const warn = warningColor(product)
                  return (
                    <div
                      key={product.inventory_product_id}
                      className={`flex items-center gap-3 rounded-xl p-3 ${GLASS_CARD_CLASS}`}
                    >
                      <div className="flex-1">
                        <div className="text-sm font-bold" style={warn ? { color: warn } : undefined}>
                          {catalogProduct?.catalog_product_name ?? 'Unknown product'}
                        </div>
                      </div>
                      <Button size="icon-sm" variant="outline" onClick={() => adjustQuantity(product, -1)}>
                        -
                      </Button>
                      <span className="w-8 text-center text-sm font-semibold">
                        {product.inventory_product_quantity}
                      </span>
                      <Button size="icon-sm" variant="outline" onClick={() => adjustQuantity(product, 1)}>
                        +
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingProduct(product)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deleteMutation.mutate(product.inventory_product_id)}
                      >
                        Delete
                      </Button>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </main>

      <CatalogPicker open={pickerOpen} onOpenChange={setPickerOpen} onPick={(p) => addMutation.mutate(p)} />

      {editingProduct && (
        <InventoryProductSettingsDialog
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['inventory-products', inventoryId] })
            setEditingProduct(null)
          }}
        />
      )}
    </div>
  )
}

function InventoryProductSettingsDialog({
  product,
  onClose,
  onSaved,
}: {
  product: InventoryProduct
  onClose: () => void
  onSaved: () => void
}) {
  const [firstThreshold, setFirstThreshold] = useState(product.inventory_product_first_threshold)
  const [secondThreshold, setSecondThreshold] = useState(product.inventory_product_second_threshold)
  const [reminderThreshold, setReminderThreshold] = useState(product.inventory_product_reminder_threshold)
  const [reminderHour, setReminderHour] = useState(product.inventory_product_reminder_hour)
  const [reminderMinute, setReminderMinute] = useState(product.inventory_product_reminder_minute)

  const saveMutation = useMutation({
    mutationFn: () =>
      updateInventoryProductSettings(product.inventory_product_id, {
        first_threshold: firstThreshold,
        second_threshold: secondThreshold,
        reminder_threshold: reminderThreshold,
        reminder_hour: reminderHour,
        reminder_minute: reminderMinute,
      }),
    onSuccess: onSaved,
  })

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thresholds &amp; reminder</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            saveMutation.mutate()
          }}
        >
          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="first-threshold">Low (warning)</Label>
              <Input
                id="first-threshold"
                type="number"
                value={firstThreshold}
                onChange={(e) => setFirstThreshold(e.target.value)}
              />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="second-threshold">Very low (critical)</Label>
              <Input
                id="second-threshold"
                type="number"
                value={secondThreshold}
                onChange={(e) => setSecondThreshold(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="reminder-threshold">Reminder threshold</Label>
            <Input
              id="reminder-threshold"
              type="number"
              value={reminderThreshold}
              onChange={(e) => setReminderThreshold(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="reminder-hour">Reminder hour</Label>
              <Input
                id="reminder-hour"
                type="number"
                min={0}
                max={23}
                value={reminderHour}
                onChange={(e) => setReminderHour(e.target.value)}
              />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="reminder-minute">Reminder minute</Label>
              <Input
                id="reminder-minute"
                type="number"
                min={0}
                max={59}
                value={reminderMinute}
                onChange={(e) => setReminderMinute(e.target.value)}
              />
            </div>
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
