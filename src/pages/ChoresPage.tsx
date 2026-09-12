import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { XIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import TopBar from '@/components/TopBar'
import { Button, buttonVariants } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  createTrackerEvent,
  deleteTrackerEvent,
  fetchTrackerEvents,
  fetchTrackerTypes,
  updateTrackerEvent,
  type TrackerEvent,
  type TrackerType,
} from '@/lib/chores'
import { formatDateISO, monthGrid, parseDateISO } from '@/lib/date-utils'

function lastDoneOn(type: TrackerType, events: TrackerEvent[]): string | null {
  const last = events
    .filter((e) => e.tracker_event_tracker_type_id === type.tracker_type_id)
    .sort((a, b) => b.tracker_event_occurred_on.localeCompare(a.tracker_event_occurred_on))[0]
  return last?.tracker_event_occurred_on ?? null
}

function isOverdue(type: TrackerType, lastDone: string | null): boolean {
  if (!type.tracker_type_expected_interval_days) return false
  if (!lastDone) return true
  const days = (Date.now() - parseDateISO(lastDone).getTime()) / 86_400_000
  return days > type.tracker_type_expected_interval_days
}

// Matches urs-android's StatsStrip exactly: "never" / "today" / "N days ago".
function sinceText(lastDone: string | null): string {
  if (!lastDone) return 'never'
  const today = formatDateISO(new Date())
  if (lastDone === today) return 'today'
  const days = Math.round((parseDateISO(today).getTime() - parseDateISO(lastDone).getTime()) / 86_400_000)
  return `${days} days ago`
}

export default function ChoresPage() {
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [initialLogTypeId, setInitialLogTypeId] = useState<string | null>(null)

  const { data: types } = useQuery({ queryKey: ['tracker-types'], queryFn: fetchTrackerTypes })
  const activeTypes = useMemo(() => (types ?? []).filter((t) => !t.tracker_type_archived_at), [types])
  const typeById = useMemo(() => new Map((types ?? []).map((t) => [t.tracker_type_id, t])), [types])

  const monthStart = new Date(monthCursor.year, monthCursor.month, 1)
  const monthEnd = new Date(monthCursor.year, monthCursor.month + 1, 0)
  const to = formatDateISO(monthEnd)
  // Fetch a year back so overdue detection works even when a type's last
  // event was well before the month currently shown.
  const overdueFrom = formatDateISO(new Date(monthCursor.year - 1, monthCursor.month, 1))

  const { data: recentEvents } = useQuery({
    queryKey: ['tracker-events', overdueFrom, to],
    queryFn: () => fetchTrackerEvents(overdueFrom, to),
  })

  const monthStartIso = formatDateISO(monthStart)
  const eventsByDay = useMemo(() => {
    const map = new Map<string, TrackerEvent[]>()
    for (const event of recentEvents ?? []) {
      if (event.tracker_event_occurred_on < monthStartIso || event.tracker_event_occurred_on > to) continue
      const list = map.get(event.tracker_event_occurred_on) ?? []
      list.push(event)
      map.set(event.tracker_event_occurred_on, list)
    }
    return map
  }, [recentEvents, monthStartIso, to])

  const grid = monthGrid(monthCursor.year, monthCursor.month)
  const monthLabel = monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const todayIso = formatDateISO(new Date())

  return (
    <div className="min-h-svh bg-background">
      <TopBar />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-base font-bold">Chores</h1>
          <Link to="/chores/types/new" className={buttonVariants({ variant: 'default' })}>
            New chore
          </Link>
        </div>

        <div className="mb-8 rounded-xl border border-border bg-card p-4">
          <div className="mb-4 flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setMonthCursor((c) => (c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 }))
              }
            >
              Prev
            </Button>
            <span className="text-sm font-bold">{monthLabel}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setMonthCursor((c) => (c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 }))
              }
            >
              Next
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">
            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {grid.map((date, i) => {
              if (!date) return <div key={`pad-${i}`} className="min-h-14" />
              const iso = formatDateISO(date)
              const dayEvents = eventsByDay.get(iso) ?? []
              return (
                <button
                  type="button"
                  key={iso}
                  onClick={() => {
                    setSelectedDay(iso)
                    setInitialLogTypeId(null)
                  }}
                  className={`flex min-h-14 flex-col items-center gap-1 rounded-lg p-1 text-xs hover:bg-muted ${
                    iso === todayIso ? 'border-2 border-primary' : 'border-2 border-transparent'
                  }`}
                >
                  <span>{date.getDate()}</span>
                  <div className="flex flex-wrap justify-center gap-0.5">
                    {dayEvents.slice(0, 4).map((event) => (
                      <span
                        key={event.tracker_event_id}
                        className="size-1.5 rounded-full"
                        style={{
                          backgroundColor:
                            typeById.get(event.tracker_event_tracker_type_id)?.tracker_type_color ?? '#999',
                        }}
                      />
                    ))}
                    {dayEvents.length > 4 && <span className="text-[9px]">+{dayEvents.length - 4}</span>}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {activeTypes.length === 0 && <p className="text-sm text-muted-foreground">No chores yet.</p>}
          {activeTypes.map((type) => {
            const lastDone = lastDoneOn(type, recentEvents ?? [])
            return (
            <div
              key={type.tracker_type_id}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"
            >
              <span className="text-2xl" aria-hidden>
                {type.tracker_type_icon}
              </span>
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: type.tracker_type_color }}
                aria-hidden
              />
              <div className="flex flex-1 items-center gap-2">
                <span className="flex-1 text-sm font-bold">{type.tracker_type_name}</span>
                {isOverdue(type, lastDone) && (
                  <span className="rounded-full bg-destructive px-2 py-0.5 text-[11px] font-semibold text-destructive-foreground">
                    overdue
                  </span>
                )}
                <span className="text-xs text-muted-foreground">{sinceText(lastDone)}</span>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setSelectedDay(todayIso)
                  setInitialLogTypeId(type.tracker_type_id)
                }}
              >
                Log now
              </Button>
              <Link
                to={`/chores/types/${type.tracker_type_id}`}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                Edit
              </Link>
            </div>
            )
          })}
        </div>
      </main>

      <Dialog open={selectedDay !== null} onOpenChange={(open) => !open && setSelectedDay(null)}>
        {selectedDay && (
          <DayDialog
            day={selectedDay}
            events={eventsByDay.get(selectedDay) ?? []}
            types={types ?? []}
            initialTypeId={initialLogTypeId}
          />
        )}
      </Dialog>
    </div>
  )
}

function DayDialog({
  day,
  events,
  types,
  initialTypeId,
}: {
  day: string
  events: TrackerEvent[]
  types: TrackerType[]
  initialTypeId?: string | null
}) {
  const queryClient = useQueryClient()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTime, setEditTime] = useState('')
  const [editNote, setEditNote] = useState('')
  const [logTypeId, setLogTypeId] = useState(initialTypeId ?? types[0]?.tracker_type_id ?? '')
  const [logTime, setLogTime] = useState('')
  const [logNote, setLogNote] = useState('')

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; typeId: string }) =>
      updateTrackerEvent(vars.id, {
        tracker_event_tracker_type_id: vars.typeId,
        tracker_event_occurred_on: day,
        tracker_event_occurred_at: editTime || undefined,
        tracker_event_note: editNote || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracker-events'] })
      setEditingId(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTrackerEvent(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tracker-events'] }),
  })

  const logHereMutation = useMutation({
    mutationFn: (typeId: string) =>
      createTrackerEvent({
        tracker_event_tracker_type_id: typeId,
        tracker_event_occurred_on: day,
        tracker_event_occurred_at: logTime || undefined,
        tracker_event_note: logNote || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracker-events'] })
      setLogTime('')
      setLogNote('')
    },
  })

  const sorted = [...events].sort((a, b) => (a.tracker_event_occurred_at ?? '').localeCompare(b.tracker_event_occurred_at ?? ''))

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>
          {parseDateISO(day).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </DialogTitle>
      </DialogHeader>

      <div className="flex flex-col gap-2">
        {sorted.length === 0 && <p className="text-sm text-muted-foreground">No chores logged.</p>}
        {sorted.map((event) => {
          const type = types.find((t) => t.tracker_type_id === event.tracker_event_tracker_type_id)
          if (editingId === event.tracker_event_id) {
            return (
              <div key={event.tracker_event_id} className="flex flex-col gap-2 rounded-lg border border-border p-2">
                <Input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} />
                <Input placeholder="Note" value={editNote} onChange={(e) => setEditNote(e.target.value)} />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      updateMutation.mutate({ id: event.tracker_event_id, typeId: event.tracker_event_tracker_type_id })
                    }
                    disabled={updateMutation.isPending}
                  >
                    Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )
          }
          return (
            <div key={event.tracker_event_id} className="flex items-center gap-2 rounded-lg border border-border p-2">
              <span aria-hidden>{type?.tracker_type_icon}</span>
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: type?.tracker_type_color }}
                aria-hidden
              />
              <button
                type="button"
                className="flex-1 text-left"
                onClick={() => {
                  setEditingId(event.tracker_event_id)
                  setEditTime(event.tracker_event_occurred_at ?? '')
                  setEditNote(event.tracker_event_note ?? '')
                }}
              >
                <div className="text-sm font-semibold">{type?.tracker_type_name ?? 'Unknown'}</div>
                <div className="text-xs text-muted-foreground">
                  {[event.tracker_event_occurred_at, event.tracker_event_note].filter(Boolean).join(' · ') || 'Tap to edit'}
                </div>
              </button>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => deleteMutation.mutate(event.tracker_event_id)}
                disabled={deleteMutation.isPending}
                aria-label="Delete"
              >
                <XIcon className="size-4" />
              </Button>
            </div>
          )
        })}
      </div>

      {types.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <select
            className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
            value={logTypeId}
            onChange={(e) => setLogTypeId(e.target.value)}
          >
            {types
              .filter((t) => !t.tracker_type_archived_at)
              .map((t) => (
                <option key={t.tracker_type_id} value={t.tracker_type_id}>
                  {t.tracker_type_icon} {t.tracker_type_name}
                </option>
              ))}
          </select>
          <Input type="time" value={logTime} onChange={(e) => setLogTime(e.target.value)} />
          <Input placeholder="Note" value={logNote} onChange={(e) => setLogNote(e.target.value)} />
          <Button
            size="sm"
            onClick={() => logTypeId && logHereMutation.mutate(logTypeId)}
            disabled={!logTypeId || logHereMutation.isPending}
          >
            Log here
          </Button>
        </div>
      )}
    </DialogContent>
  )
}
