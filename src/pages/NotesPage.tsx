import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import TopBar from '@/components/TopBar'
import { Button, buttonVariants } from '@/components/ui/button'
import { deleteNote, fetchNotes, setNoteStatus, type NoteStatus } from '@/lib/notes'
import { GLASS_BACKGROUND_GRADIENT_CLASS, GLASS_CARD_CLASS } from '@/lib/glass-style'
import { readableTextColor } from '@/lib/color'
import type { Tag } from '@/lib/tags'

// Matches urs-android's NotesHubScreen.formatReminder ("EEE, d MMM · HH:mm").
// A "YYYY-MM-DDTHH:mm:ss" string (no offset) parses as local time per spec,
// unlike a date-only string - safe to hand straight to `new Date()` here.
function formatNoteReminder(iso: string): string {
  const date = new Date(iso)
  const datePart = date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })
  const timePart = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${datePart} · ${timePart}`
}

export default function NotesPage() {
  const [tab, setTab] = useState<NoteStatus>('active')
  // In the URL (GitHub issue #29), not component state - survives unmount/
  // remount when opening a note and pressing back, and keeps the browser's
  // own back/forward buttons working as expected.
  const [searchParams, setSearchParams] = useSearchParams()
  const tagFilter = searchParams.get('tag')
  const setTagFilter = (tag: string | null) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (tag) next.set('tag', tag)
      else next.delete('tag')
      return next
    })
  }
  const queryClient = useQueryClient()

  const { data: notes, isLoading } = useQuery({
    queryKey: ['notes', tab],
    queryFn: () => fetchNotes(tab),
  })

  // Deduped by name, not by object identity — a tag's color never changes
  // once assigned (mcfx-urs/urs-backend#7), so any occurrence's color is
  // authoritative for that name.
  const allTags = useMemo(() => {
    const byName = new Map<string, Tag>()
    notes?.forEach((n) => n.tags.forEach((t) => byName.set(t.name, t)))
    return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [notes])

  const filtered = useMemo(() => {
    if (!notes) return []
    if (!tagFilter) return notes
    return notes.filter((n) => n.tags.some((t) => t.name === tagFilter))
  }, [notes, tagFilter])

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: NoteStatus }) => setNoteStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notes'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteNote(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notes'] }),
  })

  return (
    <div className={`min-h-svh bg-background ${GLASS_BACKGROUND_GRADIENT_CLASS}`}>
      <TopBar />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-base font-bold">Notes</h1>
          <Link to="/notes/new" className={buttonVariants({ variant: 'default' })}>
            New note
          </Link>
        </div>

        <div className="mb-4 flex gap-2">
          <Button variant={tab === 'active' ? 'default' : 'outline'} onClick={() => setTab('active')}>
            Active
          </Button>
          <Button variant={tab === 'completed' ? 'default' : 'outline'} onClick={() => setTab('completed')}>
            Completed
          </Button>
        </div>

        {allTags.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              className={`rounded-full px-3 py-1 text-xs font-semibold ${!tagFilter ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
              onClick={() => setTagFilter(null)}
            >
              All
            </button>
            {allTags.map((tag) => {
              const isSelected = tagFilter === tag.name
              return (
                <button
                  type="button"
                  key={tag.name}
                  className="rounded-full px-3 py-1 text-xs font-semibold"
                  style={
                    isSelected
                      ? { backgroundColor: tag.color, color: readableTextColor(tag.color) }
                      : { border: `1px solid ${tag.color}`, color: tag.color }
                  }
                  onClick={() => setTagFilter(tag.name)}
                >
                  {tag.name}
                </button>
              )
            })}
          </div>
        )}

        {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {!isLoading && filtered.length === 0 && <p className="text-sm text-muted-foreground">No notes.</p>}

        <div className="flex flex-col gap-3">
          {filtered.map((note) => (
            <div key={note.note_id} className={`rounded-xl p-4 ${GLASS_CARD_CLASS}`}>
              <div className="flex items-start justify-between gap-3">
                <Link to={`/notes/${note.note_id}`} className="flex-1">
                  <div className="text-sm font-bold">{note.note_title}</div>
                  {note.note_reminder_at && (
                    <div className="mt-1 text-sm text-muted-foreground">{formatNoteReminder(note.note_reminder_at)}</div>
                  )}
                </Link>
                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      statusMutation.mutate({
                        id: note.note_id,
                        status: note.note_status === 'active' ? 'completed' : 'active',
                      })
                    }
                  >
                    {note.note_status === 'active' ? 'Complete' : 'Reopen'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => deleteMutation.mutate(note.note_id)}>
                    Delete
                  </Button>
                </div>
              </div>
              {note.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {note.tags.map((tag) => (
                    <span
                      key={tag.name}
                      className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                      style={{ backgroundColor: tag.color, color: readableTextColor(tag.color) }}
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
