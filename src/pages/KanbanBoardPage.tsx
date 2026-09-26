import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { flushSync } from 'react-dom'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  GripVertical,
  Maximize2,
  Minimize2,
  Plus,
  Trash2,
  X as XIcon,
} from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import TopBar from '@/components/TopBar'
import RichTextField from '@/components/richtext/RichTextField'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  type KanbanBoardDetail,
  type KanbanCard,
  type KanbanCardInput,
  type KanbanColumn,
  type KanbanPriority,
} from '@/lib/kanban'
import { GLASS_BACKGROUND_GRADIENT_CLASS, GLASS_CARD_CLASS } from '@/lib/glass-style'
import { fetchNotes } from '@/lib/notes'
import { readableTextColor } from '@/lib/color'
import { fetchTags } from '@/lib/tags'

const COL_PREFIX = 'col:'
const CARD_PREFIX = 'card:'

const PRIORITY_DOT_COLOR: Record<KanbanPriority, string> = {
  low: 'bg-blue-500',
  medium: 'bg-yellow-500',
  high: 'bg-red-500',
}

// Glass-style column look - see glass-style.ts for the shared constants
// (also used by KanbanBoardsPage) and their full history.

// Optimistic local reorder, applied to the query cache synchronously the
// instant a drag ends (see applyCardMove below) - mirrors exactly what
// MoveKanbanCard does server-side (urs-backend-gitlab/src/data/db_kanban.go):
// remove the card from wherever it is, then insert at targetIndex counting
// only the *other* cards in targetColumnId. Without this, the real card
// stays rendered in its old slot until the mutation's round trip resolves,
// so DragOverlay's drop animation (which flies to wherever the real,
// non-overlay item currently sits) flew back to the old column first.
function reorderCardInBoard(board: KanbanBoardDetail, cardId: string, targetColumnId: string, targetIndex: number): KanbanBoardDetail {
  let movedCard: KanbanCard | undefined
  const withoutCard = board.columns.map((col) => {
    const card = col.cards.find((c) => c.kanban_card_id === cardId)
    if (!card) return col
    movedCard = card
    return { ...col, cards: col.cards.filter((c) => c.kanban_card_id !== cardId) }
  })
  if (!movedCard) return board
  const updatedCard = { ...movedCard, kanban_card_column_id: targetColumnId }
  return {
    ...board,
    columns: withoutCard.map((col) => {
      if (col.kanban_column_id !== targetColumnId) return col
      const cards = [...col.cards]
      cards.splice(Math.max(0, Math.min(targetIndex, cards.length)), 0, updatedCard)
      return { ...col, cards }
    }),
  }
}

/** Same reasoning as reorderCardInBoard above, for a column reorder. */
function reorderColumnInBoard(board: KanbanBoardDetail, columnId: string, targetIndex: number): KanbanBoardDetail {
  const moved = board.columns.find((c) => c.kanban_column_id === columnId)
  if (!moved) return board
  const columns = board.columns.filter((c) => c.kanban_column_id !== columnId)
  columns.splice(Math.max(0, Math.min(targetIndex, columns.length)), 0, moved)
  return { ...board, columns }
}

export default function KanbanBoardPage() {
  const { id } = useParams<{ id: string }>()
  const boardId = id as string
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [newColumnName, setNewColumnName] = useState('')
  const [newColumnDefaultTag, setNewColumnDefaultTag] = useState('')
  const [addingCardTo, setAddingCardTo] = useState<string | null>(null)
  const [newCardTitle, setNewCardTitle] = useState('')
  const [openCardId, setOpenCardId] = useState<string | null>(null)
  // Brief self-dismissing confirmation after a card save (GitHub issue #15).
  const [toast, setToast] = useState<string | null>(null)
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(timer)
  }, [toast])
  // Per-viewer, per-board UI preference (GitHub issue #12) - not synced
  // across devices, so plain localStorage rather than a backend field.
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(`kanban-collapsed:${boardId}`)
      return new Set(raw ? (JSON.parse(raw) as string[]) : [])
    } catch {
      return new Set()
    }
  })

  function toggleColumnCollapsed(columnId: string) {
    setCollapsedColumns((prev) => {
      const next = new Set(prev)
      if (next.has(columnId)) next.delete(columnId)
      else next.add(columnId)
      try {
        localStorage.setItem(`kanban-collapsed:${boardId}`, JSON.stringify([...next]))
      } catch {
        // Private browsing / quota - collapse state just won't persist.
      }
      return next
    })
  }

  const { data: queryBoard, isLoading } = useQuery({
    queryKey: ['kanban-board', boardId],
    queryFn: () => fetchKanbanBoard(boardId),
  })

  // Shared tag pool (mcfx-urs/urs-backend#11), for the card dialog's tag
  // autocomplete — not just tags already on this board's own cards.
  const { data: allTagsData } = useQuery({ queryKey: ['tags'], queryFn: fetchTags })
  const allTags = useMemo(() => (allTagsData ?? []).map((t) => t.name).sort(), [allTagsData])

  // Optimistic drag overlay for the board, kept as a plain, separate piece
  // of React state rather than writing straight into the query cache - see
  // applyCardMove's doc comment for why the cache route doesn't work here.
  // localBoard takes over from queryBoard the instant a drag ends, and is
  // cleared once the mutation's own refetch has landed fresh queryBoard data
  // (not right when the mutation itself resolves - clearing any earlier
  // would flash back to the stale pre-move queryBoard for one frame, before
  // the refetch catches up).
  const [localBoard, setLocalBoard] = useState<KanbanBoardDetail | null>(null)
  const board = localBoard ?? queryBoard

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['kanban-board', boardId] })

  const createColumnMutation = useMutation({
    mutationFn: ({ name, defaultTag }: { name: string; defaultTag: string }) => createKanbanColumn(boardId, name, defaultTag),
    onSuccess: () => {
      invalidate()
      setNewColumnName('')
      setNewColumnDefaultTag('')
    },
  })

  const deleteColumnMutation = useMutation({
    mutationFn: (columnId: string) => deleteKanbanColumn(columnId),
    onSuccess: invalidate,
    onError: () => setError('Column still has cards - move or delete them first.'),
  })

  // Column/card moves apply to localBoard synchronously via flushSync, not
  // by writing into the query cache. Writing the reorder straight into the
  // query cache (via queryClient.setQueryData, even inside flushSync) was
  // tried first and confirmed - by instrumenting both the pure reorder
  // output and the actual DOM position right after - not to work: the
  // reordered data itself was correct, but the real card still rendered in
  // its old column right after, because TanStack Query defers notifying
  // useQuery's subscribers via its own notifyManager (a microtask), so no
  // React state update is actually dispatched inside flushSync's callback
  // for it to flush - the real re-render only lands microtasks later, by
  // which point DragOverlay's drop animation had already measured the
  // stale position and started flying there. A plain useState (localBoard)
  // sidesteps that scheduling layer entirely; setting it is a synchronous
  // React update flushSync can actually flush.
  function applyColumnMove(columnId: string, index: number) {
    if (!board) return
    const reordered = reorderColumnInBoard(board, columnId, index)
    flushSync(() => setLocalBoard(reordered))
    moveKanbanColumn(columnId, index)
      .then(() => queryClient.invalidateQueries({ queryKey: ['kanban-board', boardId] }))
      .catch(() => setError('Could not move the column.'))
      .finally(() => setLocalBoard(null))
  }

  function applyCardMove(cardId: string, columnId: string, index: number) {
    if (!board) return
    const reordered = reorderCardInBoard(board, cardId, columnId, index)
    flushSync(() => setLocalBoard(reordered))
    moveKanbanCard(cardId, columnId, index)
      .then(() => queryClient.invalidateQueries({ queryKey: ['kanban-board', boardId] }))
      .catch(() => setError('Could not move the card.'))
      .finally(() => setLocalBoard(null))
  }

  const createCardMutation = useMutation({
    mutationFn: ({ columnId, title }: { columnId: string; title: string }) => createKanbanCard(columnId, { title }),
    onSuccess: () => {
      invalidate()
      setAddingCardTo(null)
      setNewCardTitle('')
    },
  })

  const columns = useMemo(() => board?.columns ?? [], [board])
  const cardIndexById = useMemo(() => {
    const map = new Map<string, { columnId: string; index: number }>()
    columns.forEach((col) => col.cards.forEach((card, index) => map.set(card.kanban_card_id, { columnId: col.kanban_column_id, index })))
    return map
  }, [columns])
  const openCard = openCardId ? columns.flatMap((c) => c.cards).find((c) => c.kanban_card_id === openCardId) : undefined

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // Drives DragOverlay below - a card/column being dragged renders its
  // cursor-following visual there (a portal outside every column's own
  // overflow-y-auto card list), not via its own inline transform. Without
  // this, the dragged item's transform tried to move it past its column's
  // bounds, but overflow-y-auto on that column (per the CSS overflow spec,
  // one axis forces the other to non-visible too) clips overflow-x just as
  // much, cutting the card off mid-drag - and gave dnd-kit's pointer-based
  // auto-scroll a horizontally-scrollable ancestor to try scrolling
  // instead of the actual board-level one.
  const [activeId, setActiveId] = useState<string | null>(null)
  const activeCard = activeId?.startsWith(CARD_PREFIX)
    ? columns.flatMap((c) => c.cards).find((c) => c.kanban_card_id === activeId.slice(CARD_PREFIX.length))
    : undefined
  const activeColumn = activeId?.startsWith(COL_PREFIX)
    ? columns.find((c) => c.kanban_column_id === activeId.slice(COL_PREFIX.length))
    : undefined

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return
    const activeId = String(active.id)
    const overId = String(over.id)
    if (activeId === overId) return

    // Both the column and card `index` fields the backend accepts are
    // positions within the *other* siblings, with the dragged item already
    // removed (see MoveKanbanColumn/MoveKanbanCard in urs-backend-gitlab,
    // both query "... WHERE id != draggedId" before inserting at `index`).
    // `columns` here is still the untouched pre-drop board state, so a
    // position read straight off it counts the dragged item itself too -
    // shift down by one whenever the drop target sits after the dragged
    // item's own current position, to land where the user actually dropped
    // it instead of one slot further along. Same off-by-one class of bug
    // urs-android had (fixed there in "Fix Kanban drag-and-drop not
    // reliably saving column/position changes", 2026-09-14) - different
    // drag mechanism (dnd-kit here vs. raw pointerInput there), same
    // "the backend's index excludes the item being moved" mismatch.
    if (activeId.startsWith(COL_PREFIX)) {
      if (!overId.startsWith(COL_PREFIX)) return
      const columnId = activeId.slice(COL_PREFIX.length)
      const overColumnId = overId.slice(COL_PREFIX.length)
      if (overColumnId === columnId) return
      const sourceIndex = columns.findIndex((c) => c.kanban_column_id === columnId)
      let newIndex = columns.findIndex((c) => c.kanban_column_id === overColumnId)
      if (sourceIndex < 0 || newIndex < 0) return
      if (sourceIndex < newIndex) newIndex -= 1
      applyColumnMove(columnId, newIndex)
      return
    }

    if (activeId.startsWith(CARD_PREFIX)) {
      const cardId = activeId.slice(CARD_PREFIX.length)
      const source = cardIndexById.get(cardId)
      if (!source) return
      let targetColumnId: string
      let targetIndex: number
      if (overId.startsWith(CARD_PREFIX)) {
        const overCardId = overId.slice(CARD_PREFIX.length)
        if (overCardId === cardId) return
        const overPos = cardIndexById.get(overCardId)
        if (!overPos) return
        targetColumnId = overPos.columnId
        targetIndex = overPos.index
        if (targetColumnId === source.columnId && source.index < targetIndex) targetIndex -= 1
      } else if (overId.startsWith(COL_PREFIX)) {
        targetColumnId = overId.slice(COL_PREFIX.length)
        const col = columns.find((c) => c.kanban_column_id === targetColumnId)
        targetIndex = (col?.cards.length ?? 0) - (targetColumnId === source.columnId ? 1 : 0)
      } else {
        return
      }
      applyCardMove(cardId, targetColumnId, targetIndex)
    }
  }

  function handleCreateColumn(e: FormEvent) {
    e.preventDefault()
    if (newColumnName.trim()) createColumnMutation.mutate({ name: newColumnName.trim(), defaultTag: newColumnDefaultTag.trim() })
  }

  return (
    <div className={`flex h-svh flex-col bg-background ${GLASS_BACKGROUND_GRADIENT_CLASS}`}>
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
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={(event) => {
              handleDragEnd(event)
              setActiveId(null)
            }}
            onDragCancel={() => setActiveId(null)}
          >
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
                    collapsed={collapsedColumns.has(column.kanban_column_id)}
                    onToggleCollapsed={() => toggleColumnCollapsed(column.kanban_column_id)}
                  />
                ))}

                <form onSubmit={handleCreateColumn} className="flex h-fit w-64 shrink-0 flex-col gap-2 rounded-xl border border-dashed border-border p-3">
                  <Input
                    placeholder="New column name"
                    value={newColumnName}
                    onChange={(e) => setNewColumnName(e.target.value)}
                  />
                  <Input
                    placeholder="Default tag (optional)"
                    value={newColumnDefaultTag}
                    onChange={(e) => setNewColumnDefaultTag(e.target.value)}
                  />
                  <Button type="submit" size="sm" disabled={createColumnMutation.isPending}>
                    Add column
                  </Button>
                </form>
              </div>
            </SortableContext>

            {/*
              Default dropAnimation flies to wherever the real (non-overlay)
              sortable item currently sits - correct now that applyCardMove/
              applyColumnMove flushSync the reorder into the query cache
              synchronously on drop, so that item is already at its new slot,
              committed to the DOM, by the time this animation starts.
            */}
            <DragOverlay>
              {activeCard && <CardPreview card={activeCard} />}
              {activeColumn && <ColumnPreview column={activeColumn} />}
            </DragOverlay>
          </DndContext>
        )}
      </main>

      {openCard && (
        <KanbanCardDialog
          card={openCard}
          allTags={allTags}
          onClose={() => setOpenCardId(null)}
          onSaved={invalidate}
          onSaveSuccess={() => {
            invalidate()
            setOpenCardId(null)
            setToast('Card saved')
          }}
          onDeleted={() => {
            invalidate()
            setOpenCardId(null)
          }}
        />
      )}

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center">
          <div className="rounded-full bg-foreground px-4 py-2 text-sm text-background shadow-lg">{toast}</div>
        </div>
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
  collapsed,
  onToggleCollapsed,
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
  collapsed: boolean
  onToggleCollapsed: () => void
}) {
  const dndId = COL_PREFIX + column.kanban_column_id
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: dndId })
  const { setNodeRef: setDroppableRef } = useDroppable({ id: dndId })

  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  // Collapsed: name+count only, in a narrow strip - the card list itself is
  // hidden, but the column stays a valid drop target (still renders the
  // droppable ref) so a card can be dropped here without expanding first.
  if (collapsed) {
    return (
      <div ref={setNodeRef} style={style} className={`flex h-full w-14 shrink-0 flex-col rounded-xl ${GLASS_CARD_CLASS}`}>
        <div className="flex shrink-0 flex-col items-center gap-1 border-b border-border p-2">
          <button type="button" {...attributes} {...listeners} className="cursor-grab text-muted-foreground active:cursor-grabbing" aria-label="Drag column">
            <GripVertical className="size-4" />
          </button>
          <button type="button" onClick={onToggleCollapsed} className="text-muted-foreground hover:text-foreground" aria-label="Expand column">
            <Maximize2 className="size-4" />
          </button>
        </div>
        <div ref={setDroppableRef} className="flex flex-1 flex-col items-center justify-between gap-2 overflow-hidden py-2">
          {column.cards.length > 0 && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{column.cards.length}</span>
          )}
          <span className="flex-1 truncate text-sm font-bold [writing-mode:vertical-rl]">{column.kanban_column_name}</span>
        </div>
      </div>
    )
  }

  return (
    <div ref={setNodeRef} style={style} className={`flex h-full w-72 shrink-0 flex-col rounded-xl ${GLASS_CARD_CLASS}`}>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border p-3">
        <button type="button" {...attributes} {...listeners} className="cursor-grab text-muted-foreground active:cursor-grabbing" aria-label="Drag column">
          <GripVertical className="size-4" />
        </button>
        <span className="flex-1 truncate text-sm font-bold">{column.kanban_column_name}</span>
        <button type="button" onClick={onToggleCollapsed} className="text-muted-foreground hover:text-foreground" aria-label="Collapse column">
          <Minimize2 className="size-4" />
        </button>
        <button type="button" onClick={onDelete} className="text-muted-foreground hover:text-destructive" aria-label="Delete column">
          <Trash2 className="size-4" />
        </button>
      </div>

      <div ref={setDroppableRef} className="flex min-h-16 flex-1 flex-col gap-2 overflow-x-hidden overflow-y-auto p-3">
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
            <span
              key={tag.name}
              className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
              style={{ backgroundColor: tag.color, color: readableTextColor(tag.color) }}
            >
              {tag.name}
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

/**
 * Rendered inside DragOverlay (a portal outside every column's own
 * overflow), not by CardView itself - CardView calls useSortable for the id
 * that's already the active drag, so reusing it here would register that id
 * twice. Same visual as CardView, no drag hooks, no onClick. Explicit width
 * since a portal has no flex/grid parent to size against.
 */
function CardPreview({ card }: { card: KanbanCard }) {
  const doneCount = card.checklist.filter((i) => i.kanban_checklist_item_done).length
  return (
    <div className="relative w-72 rounded-lg border border-primary bg-background p-2.5 text-left shadow-lg">
      <span className={`absolute right-2 top-2 size-2 rounded-full ${PRIORITY_DOT_COLOR[card.kanban_card_priority]}`} />
      <div className="pr-3 text-sm font-semibold">{card.kanban_card_title}</div>
      {card.kanban_card_due_date && (
        <div className="mt-1 text-[11px] text-muted-foreground">{card.kanban_card_due_date.slice(0, 10)}</div>
      )}
      {card.tags.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {card.tags.map((tag) => (
            <span
              key={tag.name}
              className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
              style={{ backgroundColor: tag.color, color: readableTextColor(tag.color) }}
            >
              {tag.name}
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

/** Same DragOverlay reasoning as CardPreview above, for a dragged column. */
function ColumnPreview({ column }: { column: KanbanColumn }) {
  return (
    <div className="flex w-72 flex-col gap-1 rounded-xl border border-primary bg-card p-3 shadow-lg">
      <div className="flex items-center gap-2">
        <GripVertical className="size-4 text-muted-foreground" />
        <span className="flex-1 truncate text-sm font-bold">{column.kanban_column_name}</span>
      </div>
      <span className="text-xs text-muted-foreground">
        {column.cards.length} card{column.cards.length === 1 ? '' : 's'}
      </span>
    </div>
  )
}

function KanbanCardDialog({
  card,
  allTags,
  onClose,
  onSaved,
  onSaveSuccess,
  onDeleted,
}: {
  card: KanbanCard
  allTags: string[]
  onClose: () => void
  onSaved: () => void
  onSaveSuccess: () => void
  onDeleted: () => void
}) {
  const [title, setTitle] = useState(card.kanban_card_title)
  const [description, setDescription] = useState(card.kanban_card_description ?? '')
  const [dueDate, setDueDate] = useState(card.kanban_card_due_date ? card.kanban_card_due_date.slice(0, 10) : '')
  const [priority, setPriority] = useState<KanbanPriority>(card.kanban_card_priority)
  const [noteId, setNoteId] = useState(card.kanban_card_note_id ?? '')
  const [tags, setTags] = useState<string[]>(card.tags.map((t) => t.name))
  const [tagInput, setTagInput] = useState('')

  const tagSuggestions = useMemo(() => {
    const query = tagInput.trim().toLowerCase()
    if (!query) return []
    return allTags.filter((t) => !tags.includes(t) && t.toLowerCase().includes(query))
  }, [tagInput, allTags, tags])
  const [checklistText, setChecklistText] = useState('')
  // GitHub issue #15 - a failed save keeps the dialog open (so edits aren't
  // lost) and surfaces this instead of failing silently; success closes the
  // dialog and shows the toast in the parent (onSaveSuccess), not this.
  const [saveError, setSaveError] = useState<string | null>(null)

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
    onSuccess: () => {
      setSaveError(null)
      onSaveSuccess()
    },
    onError: () => setSaveError('Could not save the card.'),
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
            <RichTextField id="card-description" value={description} onChange={setDescription} />
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
            {tagSuggestions.length > 0 && (
              <div className="flex flex-col gap-1">
                {tagSuggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="rounded-lg border border-border px-2 py-1 text-left text-sm hover:bg-muted"
                    onClick={() => addTag(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
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

          {saveError && <p className="text-sm text-destructive">{saveError}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : 'Save'}
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
