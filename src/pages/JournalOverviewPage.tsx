import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import TopBar from '@/components/TopBar'
import { buttonVariants } from '@/components/ui/button'
import { fetchJournalEvents, fetchJournalTypes, type JournalEvent, type JournalType } from '@/lib/journal'
import { formatDateISO, parseDateISO } from '@/lib/date-utils'
import { GLASS_BACKGROUND_GRADIENT_CLASS, GLASS_CARD_CLASS } from '@/lib/glass-style'

function lastDoneOn(type: JournalType, events: JournalEvent[]): string | null {
  const last = events
    .filter((e) => e.tracker_event_tracker_type_id === type.tracker_type_id)
    .sort((a, b) => b.tracker_event_occurred_on.localeCompare(a.tracker_event_occurred_on))[0]
  return last?.tracker_event_occurred_on ?? null
}

function isOverdue(type: JournalType, lastDone: string | null): boolean {
  if (!type.tracker_type_expected_interval_days) return false
  if (!lastDone) return true
  const days = (Date.now() - parseDateISO(lastDone).getTime()) / 86_400_000
  return days > type.tracker_type_expected_interval_days
}

function sinceText(lastDone: string | null): string {
  if (!lastDone) return 'never'
  const today = formatDateISO(new Date())
  if (lastDone === today) return 'today'
  const days = Math.round((parseDateISO(today).getTime() - parseDateISO(lastDone).getTime()) / 86_400_000)
  return `${days} days ago`
}

// The relocated per-type list (mcfx-urs/urs-web#28) - previously shown
// below ChoresPage's calendar, now its own page reached from Journal's
// filter panel link.
export default function JournalOverviewPage() {
  const { data: types } = useQuery({ queryKey: ['journal-types'], queryFn: fetchJournalTypes })
  const activeTypes = useMemo(() => (types ?? []).filter((t) => !t.tracker_type_archived_at), [types])

  const oneYearAgo = formatDateISO(new Date(new Date().setFullYear(new Date().getFullYear() - 1)))
  const today = formatDateISO(new Date())
  const { data: events } = useQuery({ queryKey: ['journal-events', oneYearAgo, today], queryFn: () => fetchJournalEvents(oneYearAgo, today) })

  return (
    <div className={`min-h-svh bg-background ${GLASS_BACKGROUND_GRADIENT_CLASS}`}>
      <TopBar />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-base font-bold">Journal overview</h1>
          <Link to="/journal" className={buttonVariants({ variant: 'outline' })}>
            Back to calendar
          </Link>
        </div>

        <div className="flex flex-col gap-3">
          {activeTypes.length === 0 && <p className="text-sm text-muted-foreground">No types yet.</p>}
          {activeTypes.map((type) => {
            const lastDone = lastDoneOn(type, events ?? [])
            return (
              <div key={type.tracker_type_id} className={`flex items-center gap-3 rounded-xl p-4 ${GLASS_CARD_CLASS}`}>
                <span className="text-2xl" aria-hidden>
                  {type.tracker_type_icon}
                </span>
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: type.tracker_type_color }} aria-hidden />
                <div className="flex flex-1 items-center gap-2">
                  <span className="flex-1 text-sm font-bold">{type.tracker_type_name}</span>
                  {isOverdue(type, lastDone) && (
                    <span className="rounded-full bg-destructive px-2 py-0.5 text-[11px] font-semibold text-destructive-foreground">
                      overdue
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">{sinceText(lastDone)}</span>
                </div>
                <Link
                  to={`/journal/types/${type.tracker_type_id}?return=/journal/overview`}
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                >
                  Edit
                </Link>
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}
