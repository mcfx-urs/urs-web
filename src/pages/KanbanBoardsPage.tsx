import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import TopBar from '@/components/TopBar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createKanbanBoard, deleteKanbanBoard, fetchKanbanBoards, renameKanbanBoard } from '@/lib/kanban'
import { KANBAN_BACKGROUND_GRADIENT_CLASS, KANBAN_GLASS_CARD_CLASS } from '@/lib/kanban-glass'

export default function KanbanBoardsPage() {
  const queryClient = useQueryClient()
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const { data: boards, isLoading } = useQuery({ queryKey: ['kanban-boards'], queryFn: fetchKanbanBoards })

  const createMutation = useMutation({
    mutationFn: (name: string) => createKanbanBoard(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban-boards'] })
      setNewName('')
    },
  })

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameKanbanBoard(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban-boards'] })
      setRenamingId(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteKanbanBoard(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['kanban-boards'] }),
  })

  function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (newName.trim()) createMutation.mutate(newName.trim())
  }

  return (
    <div className={`min-h-svh bg-background ${KANBAN_BACKGROUND_GRADIENT_CLASS}`}>
      <TopBar />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="mb-6 text-base font-bold">Kanban boards</h1>

        <form className="mb-6 flex gap-2" onSubmit={handleCreate}>
          <Input placeholder="New board name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Button type="submit" disabled={createMutation.isPending}>
            Create
          </Button>
        </form>

        {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {!isLoading && boards?.length === 0 && <p className="text-sm text-muted-foreground">No boards yet.</p>}

        <div className="flex flex-col gap-3">
          {boards?.map((board) => (
            <div key={board.kanban_board_id} className={`rounded-xl p-4 ${KANBAN_GLASS_CARD_CLASS}`}>
              <div className="flex items-center justify-between gap-3">
                {renamingId === board.kanban_board_id ? (
                  <form
                    className="flex flex-1 gap-2"
                    onSubmit={(e) => {
                      e.preventDefault()
                      renameMutation.mutate({ id: board.kanban_board_id, name: renameValue })
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
                  <Link to={`/kanban/${board.kanban_board_id}`} className="flex-1">
                    <div className="text-sm font-bold">{board.kanban_board_name}</div>
                  </Link>
                )}
                {renamingId !== board.kanban_board_id && (
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setRenamingId(board.kanban_board_id)
                        setRenameValue(board.kanban_board_name)
                      }}
                    >
                      Rename
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => deleteMutation.mutate(board.kanban_board_id)}>
                      Delete
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
