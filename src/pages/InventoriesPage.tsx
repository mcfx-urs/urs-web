import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import ShareSheet from '@/components/ShareSheet'
import TopBar from '@/components/TopBar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  addInventoryShare,
  createInventory,
  deleteInventory,
  fetchInventories,
  fetchInventoryShares,
  removeInventoryShare,
  renameInventory,
} from '@/lib/inventory'
import { currentUserId } from '@/lib/users'

export default function InventoriesPage() {
  const queryClient = useQueryClient()
  const myId = currentUserId()
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [sharingId, setSharingId] = useState<string | null>(null)

  const { data: inventories, isLoading } = useQuery({ queryKey: ['inventories'], queryFn: fetchInventories })

  const createMutation = useMutation({
    mutationFn: (name: string) => createInventory(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventories'] })
      setNewName('')
    },
  })

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameInventory(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventories'] })
      setRenamingId(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteInventory(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inventories'] }),
  })

  const { data: shares } = useQuery({
    queryKey: ['inventory-shares', sharingId],
    queryFn: () => fetchInventoryShares(sharingId as string),
    enabled: Boolean(sharingId),
  })

  function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (newName.trim()) createMutation.mutate(newName.trim())
  }

  return (
    <div className="min-h-svh bg-background">
      <TopBar />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="mb-6 text-base font-bold">Inventory</h1>

        <form className="mb-6 flex gap-2" onSubmit={handleCreate}>
          <Input placeholder="New inventory name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Button type="submit" disabled={createMutation.isPending}>
            Create
          </Button>
        </form>

        {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {!isLoading && inventories?.length === 0 && (
          <p className="text-sm text-muted-foreground">No inventories yet.</p>
        )}

        <div className="flex flex-col gap-3">
          {inventories?.map((inv) => (
            <div key={inv.inventory_id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                {renamingId === inv.inventory_id ? (
                  <form
                    className="flex flex-1 gap-2"
                    onSubmit={(e) => {
                      e.preventDefault()
                      renameMutation.mutate({ id: inv.inventory_id, name: renameValue })
                    }}
                  >
                    <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus />
                    <Button type="submit" size="sm">
                      Save
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setRenamingId(null)}>
                      Cancel
                    </Button>
                  </form>
                ) : (
                  <Link to={`/inventory/${inv.inventory_id}`} className="flex-1">
                    <div className="text-sm font-bold">{inv.inventory_name}</div>
                    {inv.inventory_owner_user_id !== myId && (
                      <span className="text-xs text-muted-foreground">Shared with you</span>
                    )}
                  </Link>
                )}
                {inv.inventory_owner_user_id === myId && renamingId !== inv.inventory_id && (
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setRenamingId(inv.inventory_id)
                        setRenameValue(inv.inventory_name)
                      }}
                    >
                      Rename
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setSharingId(inv.inventory_id)}>
                      Share
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => deleteMutation.mutate(inv.inventory_id)}>
                      Delete
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>

      <ShareSheet
        open={sharingId !== null}
        onOpenChange={(open) => !open && setSharingId(null)}
        sharedUserIds={(shares ?? []).map((s) => s.inventory_share_user_id)}
        sharesQueryKey={['inventory-shares', sharingId]}
        onAdd={(userId) => addInventoryShare(sharingId as string, userId)}
        onRemove={(userId) => removeInventoryShare(sharingId as string, userId)}
      />
    </div>
  )
}
