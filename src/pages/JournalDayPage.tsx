import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import TopBar from '@/components/TopBar'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import {
  deleteJournalEvent,
  fetchJournalDomains,
  fetchJournalEvents,
  fetchJournalTypes,
  type JournalEvent,
} from '@/lib/journal'
import { parseDateISO } from '@/lib/date-utils'
import { readableTextColor } from '@/lib/color'
import { GLASS_BACKGROUND_GRADIENT_CLASS, GLASS_CARD_CLASS } from '@/lib/glass-style'
import { EntryDialogContent } from './JournalPage'

const HOURS = Array.from({ length: 24 }, (_, h) => h)
const HOUR_HEIGHT_PX = 48

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

// Journal's own day view (mcfx-urs/urs-web#28) - a fixed all-day/multi-day
// strip above a scrollable 00:00-24:00 hourly grid for timed entries,
// replacing the old Chores day dialog.
export default function JournalDayPage() {
  const { date } = useParams<{ date: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [entryOpen, setEntryOpen] = useState(false)

  const iso = date ?? ''
  const { data: domains } = useQuery({ queryKey: ['journal-domains'], queryFn: fetchJournalDomains })
  const { data: types } = useQuery({ queryKey: ['journal-types'], queryFn: fetchJournalTypes })
  const activeTypes = useMemo(() => (types ?? []).filter((t) => !t.tracker_type_archived_at), [types])
  const typeById = useMemo(() => new Map((types ?? []).map((t) => [t.tracker_type_id, t])), [types])
  const domainById = useMemo(() => new Map((domains ?? []).map((d) => [d.journal_domain_id, d])), [domains])

  const { data: events } = useQuery({ queryKey: ['journal-events', iso, iso], queryFn: () => fetchJournalEvents(iso, iso) })

  const allDayEvents = (events ?? []).filter((e) => !e.tracker_event_occurred_at)
  const timedEvents = (events ?? []).filter((e) => e.tracker_event_occurred_at)

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteJournalEvent(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['journal-events'] }),
  })

  const dayLabel = iso
    ? parseDateISO(iso).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : ''

  function eventLabel(event: JournalEvent): string {
    return typeById.get(event.tracker_event_tracker_type_id)?.tracker_type_name ?? 'Unknown'
  }

  function eventColors(event: JournalEvent): { background: string; text: string } {
    const type = typeById.get(event.tracker_event_tracker_type_id)
    const domain = type ? domainById.get(type.tracker_type_domain_id) : undefined
    const background = domain?.journal_domain_color ?? '#888888'
    return { background, text: readableTextColor(background) }
  }

  return (
    <div className={`min-h-svh bg-background ${GLASS_BACKGROUND_GRADIENT_CLASS}`}>
      <TopBar />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
              Back
            </Button>
          </div>
          <h1 className="text-sm font-bold">{dayLabel}</h1>
          <Button size="sm" onClick={() => setEntryOpen(true)}>
            +
          </Button>
        </div>

        {allDayEvents.length > 0 && (
          <div className={`mb-3 flex flex-col gap-1 rounded-xl p-2 ${GLASS_CARD_CLASS}`}>
            {allDayEvents.map((event) => {
              const colors = eventColors(event)
              return (
                <div
                  key={event.tracker_event_id}
                  className="flex items-center justify-between rounded px-2 py-1 text-xs font-semibold"
                  style={{ backgroundColor: colors.background, color: colors.text }}
                >
                  <span>{eventLabel(event)}</span>
                  <button type="button" onClick={() => deleteMutation.mutate(event.tracker_event_id)} aria-label="Delete">
                    ×
                  </button>
                </div>
              )
            })}
          </div>
        )}

        <div className={`relative overflow-y-auto rounded-xl p-2 ${GLASS_CARD_CLASS}`} style={{ maxHeight: '70vh' }}>
          <div className="relative" style={{ height: `${24 * HOUR_HEIGHT_PX}px` }}>
            {HOURS.map((h) => (
              <div
                key={h}
                className="absolute left-10 right-0 border-t border-border text-[10px] text-muted-foreground"
                style={{ top: `${h * HOUR_HEIGHT_PX}px` }}
              >
                <span className="absolute -left-10 -top-2 w-8 text-right">{String(h).padStart(2, '0')}:00</span>
              </div>
            ))}
            {timedEvents.map((event) => {
              const startMinutes = timeToMinutes(event.tracker_event_occurred_at!.slice(0, 5))
              const endMinutes = event.tracker_event_occurred_at_end
                ? timeToMinutes(event.tracker_event_occurred_at_end.slice(0, 5))
                : startMinutes + 30
              const top = (startMinutes / 60) * HOUR_HEIGHT_PX
              const height = Math.max(18, ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT_PX)
              const colors = eventColors(event)
              return (
                <button
                  type="button"
                  key={event.tracker_event_id}
                  onClick={() => deleteMutation.mutate(event.tracker_event_id)}
                  className="absolute left-11 right-1 truncate rounded px-1.5 text-left text-[11px] font-semibold"
                  style={{ top: `${top}px`, height: `${height}px`, backgroundColor: colors.background, color: colors.text }}
                >
                  {eventLabel(event)}
                </button>
              )
            })}
          </div>
        </div>
      </main>

      <Dialog open={entryOpen} onOpenChange={setEntryOpen}>
        <EntryDialogContent
          domains={domains ?? []}
          activeTypes={activeTypes}
          defaultDate={iso}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['journal-events'] })
            setEntryOpen(false)
          }}
        />
      </Dialog>
    </div>
  )
}
