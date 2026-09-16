import { useMemo, useState, type FormEvent } from 'react'
import {
  DndContext,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { GripVertical, Plus, Trash2, X as XIcon } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import TopBar from '@/components/TopBar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  createKanbanCard,
  createKanbanChecklistItem,
  createKanbanColumn,
  deleteKanbanCard,
  deleteKanbanChecklistItem,
  deleteKanbanColumn,
  fetchKanbanBoard,
  moveKanbanCard,
  moveKanbanColumn,
  updateKanbanCard,
  updateKanbanChecklistItem,
  type KanbanCard,
  type KanbanCardInput,
  type KanbanColumn,
  type KanbanPriority,
} from '@/lib/kanban'
import { fetchNotes } from '@/lib/notes'

const COL_PREFIX = 'col:'
const CARD_PREFIX = 'card:'

const PRIORITY_DOT_COLOR: Record<KanbanPriority, string> = {
  low: 'bg-blue-500',
  medium: 'bg-yellow-500',
  high: 'bg-red-500',
}

export default function KanbanBoardPage() {
  const { id } = useParams<{ id: string }>()
  const boardId = id as string
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [newColumnName, setNewColumnName] = useState('')
  const [addingCardTo, setAddingCardTo] = useState<string | null>(null)
  const [newCardTitle, setNewCardTitle] = useState('')
  const [openCardId, setOpenCardId] = useState<string | null>(null)

  const { data: board, isLoading } = useQuery({
    queryKey: ['kanban-board', boardId],
    queryFn: () => fetchKanbanBoard(boardId),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['kanban-board', boardId] })

  const createColumnMutation = useMutation({
    mutationFn: (name: string) => createKanbanColumn(boardId, name),
    onSuccess: () => {
      invalidate()
      setNewColumnName('')
    },
  })

  const deleteColumnMutation = useMutation({
    mutationFn: (columnId: string) => deleteKanbanColumn(columnId),
    onSuccess: invalidate,
    onError: () => setError('Column still has cards - move or delete them first.'),
  })

  const moveColumnMutation = useMutation({
    mutationFn: ({ columnId, index }: { columnId: string; index: number }) => moveKanbanColumn(columnId, index),
    onSuccess: invalidate,
  })

  const createCardMutation = useMutation({
    mutationFn: ({ columnId, title }: { columnId: string; title: string }) => createKanbanCard(columnId, { title }),
    onSuccess: () => {
      invalidate()
      setAddingCardTo(null)
      setNewCardTitle('')
    },
  })

  const moveCardMutation = useMutation({
    mutationFn: ({ cardId, columnId, index }: { cardId: string; columnId: string; index: number }) =>
      moveKanbanCard(cardId, columnId, index),
    onSuccess: invalidate,
  })

  const columns = useMemo(() => board?.columns ?? [], [board])
  const cardIndexById = useMemo(() => {
    const map = new Map<string, { columnId: string; index: number }>()
    columns.forEach((col) => col.cards.forEach((card, index) => map.set(card.kanban_card_id, { columnId: col.kanban_column_id, index })))
    return map
  }, [columns])
  const openCard = openCardId ? columns.flatMap((c) => c.cards).find((c) => c.kanban_card_id === openCardId) : undefined

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return
    const activeId = String(active.id)
    const overId = String(over.id)
    if (activeId === overId) return

    if (activeId.startsWith(COL_PREFIX)) {
      if (!overId.startsWith(COL_PREFIX)) return
      const columnId = activeId.slice(COL_PREFIX.length)
      const overColumnId = overId.slice(COL_PREFIX.length)
      const newIndex = columns.findIndex((c) => c.kanban_column_id === overColumnId)
      if (newIndex >= 0) moveColumnMutation.mutate({ columnId, index: newIndex })
      return
    }

    if (activeId.startsWith(CARD_PREFIX)) {
      const cardId = activeId.slice(CARD_PREFIX.length)
      let targetColumnId: string
      let targetIndex: number
      if (overId.startsWith(CARD_PREFIX)) {
        const overCardId = overId.slice(CARD_PREFIX.length)
        const pos = cardIndexById.get(overCardId)
        if (!pos) return
        targetColumnId = pos.columnId
        targetIndex = pos.index
      } else if (overId.startsWith(COL_PREFIX)) {
        targetColumnId = overId.slice(COL_PREFIX.length)
        const col = columns.find((c) => c.kanban_column_id === targetColumnId)
        targetIndex = col?.cards.length ?? 0
      } else {
        return
      }
      moveCardMutation.mutate({ cardId, columnId: targetColumnId, index: targetIndex })
    }
  }

  function handleCreateColumn(e: FormEvent) {
    e.preventDefault()
    if (newColumnName.trim()) createColumnMutation.mutate(newColumnName.trim())
  }

  return (
    <div className="flex h-svh flex-col bg-background">
      <TopBar />
      <main className="flex flex-1 flex-col overflow-hidden px-6 py-6">
        <div className="mx-auto mb-4 flex w-full max-w-6xl shrink-0 items-center justify-between">
          <div>
            <button
              type="button"
              onClick={() => navigate('/kanban')}
              className="mb-1 text-xs text-muted-foreground hover:text-foreground"
            >
              &larr; Kanban boards
            </button>
            <h1 className="text-base font-bold">{board?.kanban_board_name ?? '...'}</h1>
          </div>
        </div>

        {error && (
          <div className="mx-auto mb-4 flex w-full max-w-6xl shrink-0 items-center justify-between rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
            <button type="button" onClick={() => setError(null)} aria-label="Dismiss">
              <XIcon className="size-4" />
            </button>
          </div>
        )}

        {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}

        {!isLoading && (
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <SortableContext items={columns.map((c) => COL_PREFIX + c.kanban_column_id)} strategy={horizontalListSortingStrategy}>
              <div className="flex flex-1 gap-4 overflow-x-auto pb-4">
                {columns.map((column) => (
                  <ColumnView
                    key={column.kanban_column_id}
                    column={column}
                    onDelete={() => deleteColumnMutation.mutate(column.kanban_column_id)}
                    onCardClick={setOpenCardId}
                    addingCard={addingCardTo === column.kanban_column_id}
                    newCardTitle={newCardTitle}
                    onNewCardTitleChange={setNewCardTitle}
                    onStartAddCard={() => {
                      setAddingCardTo(column.kanban_column_id)
                      setNewCardTitle('')
                    }}
                    onCancelAddCard={() => setAddingCardTo(null)}
                    onSubmitAddCard={() => {
                      if (newCardTitle.trim()) createCardMutation.mutate({ columnId: column.kanban_column_id, title: newCardTitle.trim() })
                    }}
                  />
                ))}

                <form onSubmit={handleCreateColumn} className="flex h-fit w-64 shrink-0 flex-col gap-2 rounded-xl border border-dashed border-border p-3">
                  <Input
                    placeholder="New column name"
                    value={newColumnName}
                    onChange={(e) => setNewColumnName(e.target.value)}
                  />
                  <Button type="submit" size="sm" disabled={createColumnMutation.isPending}>
                    Add column
                  </Button>
                </form>
              </div>
            </SortableContext>
          </DndContext>
        )}
      </main>

      {openCard && (
        <KanbanCardDialog
          card={openCard}
          onClose={() => setOpenCardId(null)}
          onSaved={invalidate}
          onDeleted={() => {
            invalidate()
            setOpenCardId(null)
          }}
        />
      )}
    </div>
  )
}

function ColumnView({
  column,
  onDelete,
  onCardClick,
  addingCard,
  newCardTitle,
  onNewCardTitleChange,
  onStartAddCard,
  onCancelAddCard,
  onSubmitAddCard,
}: {
  column: KanbanColumn
  onDelete: () => void
  onCardClick: (cardId: string) => void
  addingCard: boolean
  newCardTitle: string
  onNewCardTitleChange: (value: string) => void
  onStartAddCard: () => void
  onCancelAddCard: () => void
  onSubmitAddCard: () => void
}) {
  const dndId = COL_PREFIX + column.kanban_column_id
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: dndId })
  const { setNodeRef: setDroppableRef } = useDroppable({ id: dndId })

  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  return (
    <div ref={setNodeRef} style={style} className="flex h-full w-72 shrink-0 flex-col rounded-xl border border-border bg-card">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border p-3">
        <button type="button" {...attributes} {...listeners} className="cursor-grab text-muted-foreground active:cursor-grabbing" aria-label="Drag column">
          <GripVertical className="size-4" />
        </button>
        <span className="flex-1 truncate text-sm font-bold">{column.kanban_column_name}</span>
        <button type="button" onClick={onDelete} className="text-muted-foreground hover:text-destructive" aria-label="Delete column">
          <Trash2 className="size-4" />
        </button>
      </div>

      <div ref={setDroppableRef} className="flex min-h-16 flex-1 flex-col gap-2 overflow-y-auto p-3">
        <SortableContext items={column.cards.map((c) => CARD_PREFIX + c.kanban_card_id)} strategy={verticalListSortingStrategy}>
          {column.cards.map((card) => (
            <CardView key={card.kanban_card_id} card={card} onClick={() => onCardClick(card.kanban_card_id)} />
          ))}
        </SortableContext>

        {addingCard ? (
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              onSubmitAddCard()
            }}
          >
            <Input autoFocus placeholder="Card title" value={newCardTitle} onChange={(e) => onNewCardTitleChange(e.target.value)} />
            <div className="flex gap-2">
              <Button type="submit" size="sm">
                Add
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={onCancelAddCard}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={onStartAddCard}
            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted"
          >
            <Plus className="size-3.5" /> Add card
          </button>
        )}
      </div>
    </div>
  )
}

function CardView({ card, onClick }: { card: KanbanCard; onClick: () => void }) {
  const dndId = CARD_PREFIX + card.kanban_card_id
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: dndId })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  const doneCount = card.checklist.filter((i) => i.kanban_checklist_item_done).length

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="relative cursor-pointer rounded-lg border border-border bg-background p-2.5 text-left hover:border-primary"
    >
      <span
        className={`absolute right-2 top-2 size-2 rounded-full ${PRIORITY_DOT_COLOR[card.kanban_card_priority]}`}
      />
      <div className="pr-3 text-sm font-semibold">{card.kanban_card_title}</div>
      {card.kanban_card_due_date && (
        <div className="mt-1 text-[11px] text-muted-foreground">{card.kanban_card_due_date.slice(0, 10)}</div>
      )}
      {card.tags.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {card.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {tag}
            </span>
          ))}
        </div>
      )}
      {card.checklist.length > 0 && (
        <div className="mt-1 text-[11px] text-muted-foreground">
          {doneCount}/{card.checklist.length}
        </div>
      )}
    </div>
  )
}

function KanbanCardDialog({
  card,
  onClose,
  onSaved,
  onDeleted,
}: {
  card: KanbanCard
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
}) {
  const [title, setTitle] = useState(card.kanban_card_title)
  const [description, setDescription] = useState(card.kanban_card_description)
  const [dueDate, setDueDate] = useState(card.kanban_card_due_date ? card.kanban_card_due_date.slice(0, 10) : '')
  const [priority, setPriority] = useState<KanbanPriority>(card.kanban_card_priority)
  const [noteId, setNoteId] = useState(card.kanban_card_note_id ?? '')
  const [tags, setTags] = useState<string[]>(card.tags)
  const [tagInput, setTagInput] = useState('')
  const [checklistText, setChecklistText] = useState('')

  const { data: notes } = useQuery({ queryKey: ['notes', 'all'], queryFn: () => fetchNotes() })

  const saveMutation = useMutation({
    mutationFn: () => {
      const input: KanbanCardInput = {
        title,
        description,
        due_date: dueDate,
        priority,
        note_id: noteId,
        tags,
      }
      return updateKanbanCard(card.kanban_card_id, input)
    },
    onSuccess: onSaved,
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteKanbanCard(card.kanban_card_id),
    onSuccess: onDeleted,
  })

  const addChecklistMutation = useMutation({
    mutationFn: (text: string) => createKanbanChecklistItem(card.kanban_card_id, text),
    onSuccess: () => {
      onSaved()
      setChecklistText('')
    },
  })

  const toggleChecklistMutation = useMutation({
    mutationFn: ({ id, text, done }: { id: string; text: string; done: boolean }) => updateKanbanChecklistItem(id, text, done),
    onSuccess: onSaved,
  })

  const deleteChecklistMutation = useMutation({
    mutationFn: (id: string) => deleteKanbanChecklistItem(id),
    onSuccess: onSaved,
  })

  function addTag(tag: string) {
    const trimmed = tag.trim()
    if (trimmed && !tags.includes(trimmed)) setTags([...tags, trimmed])
    setTagInput('')
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit card</DialogTitle>
        </DialogHeader>
        <form
          className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto"
          onSubmit={(e) => {
            e.preventDefault()
            saveMutation.mutate()
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="card-title">Title</Label>
            <Input id="card-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="card-description">Description</Label>
            <Textarea id="card-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>

          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="card-due-date">Due date</Label>
              <Input id="card-due-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="card-priority">Priority</Label>
              <select
                id="card-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as KanbanPriority)}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="card-note">Linked note</Label>
            <select
              id="card-note"
              value={noteId}
              onChange={(e) => setNoteId(e.target.value)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring"
            >
              <option value="">None</option>
              {notes?.map((note) => (
                <option key={note.note_id} value={note.note_id}>
                  {note.note_title}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="card-tag-input">Tags</Label>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tags.map((tag) => (
                  <span key={tag} className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {tag}
                    <button type="button" onClick={() => setTags(tags.filter((t) => t !== tag))} aria-label={`Remove ${tag}`}>
                      <XIcon className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <Input
              id="card-tag-input"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addTag(tagInput)
                }
              }}
              placeholder="Type and press Enter to add"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Checklist</Label>
            <div className="flex flex-col gap-1">
              {card.checklist.map((item) => (
                <label key={item.kanban_checklist_item_id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={item.kanban_checklist_item_done}
                    onChange={(e) =>
                      toggleChecklistMutation.mutate({
                        id: item.kanban_checklist_item_id,
                        text: item.kanban_checklist_item_text,
                        done: e.target.checked,
                      })
                    }
                    className="size-4 accent-primary"
                  />
                  <span className={item.kanban_checklist_item_done ? 'flex-1 text-muted-foreground line-through' : 'flex-1'}>
                    {item.kanban_checklist_item_text}
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteChecklistMutation.mutate(item.kanban_checklist_item_id)}
                    aria-label="Remove checklist item"
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <XIcon className="size-3.5" />
                  </button>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={checklistText}
                onChange={(e) => setChecklistText(e.target.value)}
                placeholder="New checklist item"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (checklistText.trim()) addChecklistMutation.mutate(checklistText.trim())
                  }
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => checklistText.trim() && addChecklistMutation.mutate(checklistText.trim())}
              >
                Add
              </Button>
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={saveMutation.isPending}>
              Save
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={() => deleteMutation.mutate()}>
              Delete
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
