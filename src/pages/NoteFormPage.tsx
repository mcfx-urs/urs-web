import { useMemo, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { XIcon } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import TopBar from '@/components/TopBar'
import RichTextField from '@/components/richtext/RichTextField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GLASS_BACKGROUND_GRADIENT_CLASS } from '@/lib/glass-style'
import { createNote, fetchNotes, updateNote, type Note } from '@/lib/notes'

export default function NoteFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEditing = Boolean(id)

  // Fetched unconditionally (not just when editing): also drives tag
  // suggestions for a brand-new note, not only the existing-note lookup.
  const { data: notes, isLoading } = useQuery({
    queryKey: ['notes', 'all'],
    queryFn: () => fetchNotes(),
  })
  const existing = isEditing ? notes?.find((n) => n.note_id === id) : undefined
  const allTags = useMemo(() => {
    const tags = new Set<string>()
    notes?.forEach((n) => n.tags.forEach((t) => tags.add(t)))
    return Array.from(tags).sort()
  }, [notes])

  if (isEditing && isLoading) {
    return (
      <div className={`min-h-svh bg-background ${GLASS_BACKGROUND_GRADIENT_CLASS}`}>
        <TopBar />
        <main className="mx-auto max-w-2xl px-6 py-10">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </main>
      </div>
    )
  }
  if (isEditing && !existing) {
    return (
      <div className={`min-h-svh bg-background ${GLASS_BACKGROUND_GRADIENT_CLASS}`}>
        <TopBar />
        <main className="mx-auto max-w-2xl px-6 py-10">
          <p className="text-sm text-muted-foreground">Note not found.</p>
        </main>
      </div>
    )
  }

  // Keyed by the note id so switching between notes (or new -> existing)
  // remounts with fresh initial state, instead of syncing via an effect.
  return <NoteForm key={existing?.note_id ?? 'new'} existing={existing} allTags={allTags} />
}

function NoteForm({ existing, allTags }: { existing?: Note; allTags: string[] }) {
  const isEditing = Boolean(existing)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [title, setTitle] = useState(existing?.note_title ?? '')
  const [content, setContent] = useState(existing?.note_content ?? '')
  const [reminderEnabled, setReminderEnabled] = useState(Boolean(existing?.note_reminder_at))
  const [reminderDate, setReminderDate] = useState(existing?.note_reminder_at ? existing.note_reminder_at.slice(0, 10) : '')
  const [reminderTime, setReminderTime] = useState(existing?.note_reminder_at ? existing.note_reminder_at.slice(11, 16) : '')
  const [tags, setTags] = useState<string[]>(existing?.tags ?? [])
  const [tagInput, setTagInput] = useState('')

  const suggestions = useMemo(() => {
    const query = tagInput.trim().toLowerCase()
    if (!query) return []
    return allTags.filter((t) => !tags.includes(t) && t.toLowerCase().includes(query))
  }, [tagInput, allTags, tags])

  function addTag(tag: string) {
    const trimmed = tag.trim()
    if (trimmed && !tags.includes(trimmed)) setTags([...tags, trimmed])
    setTagInput('')
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag))
  }

  function handleTagInputKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTag(tagInput)
    }
  }

  const mutation = useMutation({
    mutationFn: () => {
      const input = {
        title,
        content,
        reminder_at: reminderEnabled && reminderDate && reminderTime ? `${reminderDate}T${reminderTime}:00` : undefined,
        tags,
      }
      return isEditing && existing ? updateNote(existing.note_id, input) : createNote(input)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      navigate('/notes')
    },
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    mutation.mutate()
  }

  return (
    <div className={`min-h-svh bg-background ${GLASS_BACKGROUND_GRADIENT_CLASS}`}>
      <TopBar />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="mb-6 text-base font-bold">{isEditing ? 'Edit note' : 'New note'}</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="content">Content</Label>
            <RichTextField id="content" value={content} onChange={setContent} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="tag-input">Tags</Label>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)} aria-label={`Remove ${tag}`}>
                      <XIcon className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <Input
              id="tag-input"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagInputKeyDown}
              placeholder="Type and press Enter to add"
            />
            {suggestions.length > 0 && (
              <div className="flex flex-col gap-1">
                {suggestions.map((s) => (
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

          <div className="flex items-center justify-between">
            <Label htmlFor="reminder-enabled">Enable reminder</Label>
            <input
              id="reminder-enabled"
              type="checkbox"
              checked={reminderEnabled}
              onChange={(e) => setReminderEnabled(e.target.checked)}
              className="size-4 accent-primary"
            />
          </div>
          {reminderEnabled && (
            <div className="flex gap-3">
              <div className="flex flex-1 flex-col gap-2">
                <Label htmlFor="reminder-date">Date</Label>
                <Input
                  id="reminder-date"
                  type="date"
                  value={reminderDate}
                  onChange={(e) => setReminderDate(e.target.value)}
                />
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <Label htmlFor="reminder-time">Time</Label>
                <Input
                  id="reminder-time"
                  type="time"
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving...' : 'Save'}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate('/notes')}>
              Cancel
            </Button>
          </div>
        </form>
      </main>
    </div>
  )
}
