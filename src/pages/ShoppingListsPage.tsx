import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import ShareSheet from '@/components/ShareSheet'
import TopBar from '@/components/TopBar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  addShoppingListShare,
  createShoppingList,
  deleteShoppingList,
  fetchShoppingLists,
  fetchShoppingListShares,
  removeShoppingListShare,
  renameShoppingList,
} from '@/lib/shopping-list'
import { currentUserId } from '@/lib/users'

export default function ShoppingListsPage() {
  const queryClient = useQueryClient()
  const myId = currentUserId()
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [sharingId, setSharingId] = useState<string | null>(null)

  const { data: lists, isLoading } = useQuery({ queryKey: ['shopping-lists'], queryFn: fetchShoppingLists })

  const createMutation = useMutation({
    mutationFn: (name: string) => createShoppingList(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping-lists'] })
      setNewName('')
    },
  })

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameShoppingList(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping-lists'] })
      setRenamingId(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteShoppingList(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shopping-lists'] }),
  })

  const { data: shares } = useQuery({
    queryKey: ['shopping-list-shares', sharingId],
    queryFn: () => fetchShoppingListShares(sharingId as string),
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
        <h1 className="mb-6 text-base font-bold">Shopping lists</h1>

        <form className="mb-6 flex gap-2" onSubmit={handleCreate}>
          <Input placeholder="New list name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Button type="submit" disabled={createMutation.isPending}>
            Create
          </Button>
        </form>

        {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {!isLoading && lists?.length === 0 && <p className="text-sm text-muted-foreground">No lists yet.</p>}

        <div className="flex flex-col gap-3">
          {lists?.map((list) => (
            <div key={list.list_id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                {renamingId === list.list_id ? (
                  <form
                    className="flex flex-1 gap-2"
                    onSubmit={(e) => {
                      e.preventDefault()
                      renameMutation.mutate({ id: list.list_id, name: renameValue })
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
                  <Link to={`/shopping/${list.list_id}`} className="flex-1">
                    <div className="text-sm font-bold">{list.list_name}</div>
                    {list.list_owner_user_id !== myId && (
                      <span className="text-xs text-muted-foreground">Shared with you</span>
                    )}
                  </Link>
                )}
                {list.list_owner_user_id === myId && renamingId !== list.list_id && (
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setRenamingId(list.list_id)
                        setRenameValue(list.list_name)
                      }}
                    >
                      Rename
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setSharingId(list.list_id)}>
                      Share
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => deleteMutation.mutate(list.list_id)}>
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
        sharedUserIds={(shares ?? []).map((s) => s.list_share_user_id)}
        sharesQueryKey={['shopping-list-shares', sharingId]}
        onAdd={(userId) => addShoppingListShare(sharingId as string, userId)}
        onRemove={(userId) => removeShoppingListShare(sharingId as string, userId)}
      />
    </div>
  )
}
