import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { currentUserId, fetchHouseholdUsers } from '@/lib/users'

type ShareSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  sharedUserIds: string[]
  sharesQueryKey: unknown[]
  onAdd: (userId: string) => Promise<unknown>
  onRemove: (userId: string) => Promise<unknown>
}

// Reused by both Inventory and Shopping List - toggle household members
// on/off, matching urs-android's UrsShareSheet (owner-only, binary
// share/unshare, no acceptance/rejection or permission levels).
export default function ShareSheet({
  open,
  onOpenChange,
  sharedUserIds,
  sharesQueryKey,
  onAdd,
  onRemove,
}: ShareSheetProps) {
  const queryClient = useQueryClient()
  const { data: users } = useQuery({ queryKey: ['household-users'], queryFn: fetchHouseholdUsers, enabled: open })
  const myId = currentUserId()
  const shared = useMemo(() => new Set(sharedUserIds), [sharedUserIds])

  const toggleMutation = useMutation({
    mutationFn: (userId: string) => (shared.has(userId) ? onRemove(userId) : onAdd(userId)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sharesQueryKey }),
  })

  const others = (users ?? []).filter((u) => u.user_id !== myId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {others.length === 0 && <p className="text-sm text-muted-foreground">No other household members.</p>}
          {others.map((u) => (
            <label
              key={u.user_id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border p-2"
            >
              <span className="text-sm">
                {u.user_firstname || u.user_name} {u.user_lastname}
              </span>
              <input
                type="checkbox"
                checked={shared.has(u.user_id)}
                onChange={() => toggleMutation.mutate(u.user_id)}
                disabled={toggleMutation.isPending}
                className="size-4 accent-primary"
              />
            </label>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
