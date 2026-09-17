import { Fragment, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import TopBar from '@/components/TopBar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  createJournalDomain,
  createJournalEvent,
  fetchJournalDomains,
  fetchJournalEvents,
  fetchJournalTypes,
  type JournalDomain,
  type JournalEvent,
  type JournalType,
} from '@/lib/journal'
import { formatDateISO, isoWeekNumber, parseDateISO } from '@/lib/date-utils'
import { readableTextColor } from '@/lib/color'
import { GLASS_BACKGROUND_GRADIENT_CLASS, GLASS_CARD_CLASS } from '@/lib/glass-style'

// Domain colors, separate from tracker_type's own 8-color palette
// (TrackerTypeFormPage.tsx) so a domain and the types inside it never look
// like the same "kind" of picker by coincidence.
const DOMAIN_COLORS = ['#8D6E63', '#5C6BC0', '#26A69A', '#EF6C00', '#7E57C2', '#66BB6A', '#EC407A', '#78909C']
const DOMAIN_ICONS = ['🏠', '❤️', '🚗', '💼', '📚', '⚽', '🎵', '✈️']

// Fixed slot counts per week row so every row renders at the same height
// regardless of how many events fall in it - overflow beyond these caps
// collapses into a "+N" marker rather than growing the row. MAX_CHIP_SLOTS
// is a heuristic (not measured against actual available pixel height): high
// enough that a typical day's events all fit within the row's share of the
// calendar's real height, without unbounded growth on a pathological day.
const MAX_LANES = 2
const MAX_CHIP_SLOTS = 5
// Fixed height (px) for the day-number line - explicit rather than `auto` so
// it lines up exactly with the day cell's own internal top offset (see the
// day-cell button below), which CSS grid's `auto` row sizing can't guarantee
// once that button spans every row in the grid.
const DAY_NUMBER_HEIGHT = 20
// Bar height/gap for multi-day lanes - BAR_GAP matches the chip list's own
// `gap-0.5` (2px) so a multi-day bar gets the same clearance above, between,
// and below as regular chips get from each other.
const BAR_HEIGHT = 14
const BAR_GAP = 2

const HIDDEN_TYPE_IDS_KEY = 'journal-hidden-type-ids'

function loadHiddenTypeIds(): Set<string> {
  try {
    const raw = localStorage.getItem(HIDDEN_TYPE_IDS_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch {
    return new Set()
  }
}

function saveHiddenTypeIds(ids: Set<string>) {
  try {
    localStorage.setItem(HIDDEN_TYPE_IDS_KEY, JSON.stringify([...ids]))
  } catch {
    // best-effort only - a blocked/full localStorage just means the filter doesn't persist
  }
}

type WeekRow = { weekNumber: number; days: Date[] }

// Every row is 7 real calendar dates starting on a Monday, even across a
// month boundary (so a multi-day bar can render through them) - `days[i]`
// outside the current month is still a real Date, just rendered dimmed.
function buildWeekRows(year: number, month: number): WeekRow[] {
  const first = new Date(year, month, 1)
  const firstWeekday = (first.getDay() + 6) % 7
  const gridStart = new Date(year, month, 1 - firstWeekday)
  const last = new Date(year, month + 1, 0)
  const totalCells = Math.ceil((firstWeekday + last.getDate()) / 7) * 7
  const rows: WeekRow[] = []
  for (let w = 0; w < totalCells / 7; w++) {
    const monday = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + w * 7)
    const days = Array.from({ length: 7 }, (_, d) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + d))
    rows.push({ weekNumber: isoWeekNumber(monday), days })
  }
  return rows
}

function isMultiDay(event: JournalEvent): boolean {
  return Boolean(event.tracker_event_occurred_on_end) && event.tracker_event_occurred_on_end !== event.tracker_event_occurred_on
}

function eventLengthDays(event: JournalEvent): number {
  const start = parseDateISO(event.tracker_event_occurred_on)
  const end = parseDateISO(event.tracker_event_occurred_on_end ?? event.tracker_event_occurred_on)
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
}

// Lane assignment for multi-day bars overlapping within one week row, longest
// event first - matches typical calendar UX (e.g. Google Calendar), so a
// longer-running event claims the top lane over a shorter one it overlaps
// with. Processing order is no longer start-date order, so each candidate
// lane is checked against every event already placed in it (not just the
// most recent one) - more than enough for a handful of concurrent events.
function assignLanes(events: JournalEvent[]): { event: JournalEvent; lane: number }[] {
  const sorted = [...events].sort((a, b) => eventLengthDays(b) - eventLengthDays(a))
  const lanes: JournalEvent[][] = []
  const placed: { event: JournalEvent; lane: number }[] = []
  for (const event of sorted) {
    const start = event.tracker_event_occurred_on
    const end = event.tracker_event_occurred_on_end ?? event.tracker_event_occurred_on
    let lane = lanes.findIndex((laneEvents) =>
      laneEvents.every((placedEvent) => {
        const placedEnd = placedEvent.tracker_event_occurred_on_end ?? placedEvent.tracker_event_occurred_on
        return placedEnd < start || placedEvent.tracker_event_occurred_on > end
      }),
    )
    if (lane === -1) {
      lane = lanes.length
      lanes.push([])
    }
    lanes[lane].push(event)
    placed.push({ event, lane })
  }
  return placed
}

export default function JournalPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const [hiddenTypeIds, setHiddenTypeIds] = useState<Set<string>>(() => loadHiddenTypeIds())
  const [filterOpen, setFilterOpen] = useState(false)
  const [entryOpen, setEntryOpen] = useState(false)

  const { data: domains } = useQuery({ queryKey: ['journal-domains'], queryFn: fetchJournalDomains })
  const { data: types } = useQuery({ queryKey: ['journal-types'], queryFn: fetchJournalTypes })
  const activeTypes = useMemo(() => (types ?? []).filter((t) => !t.tracker_type_archived_at), [types])
  const typeById = useMemo(() => new Map((types ?? []).map((t) => [t.tracker_type_id, t])), [types])
  const domainById = useMemo(() => new Map((domains ?? []).map((d) => [d.journal_domain_id, d])), [domains])

  const monthStart = new Date(monthCursor.year, monthCursor.month, 1)
  const monthEnd = new Date(monthCursor.year, monthCursor.month + 1, 0)
  const from = formatDateISO(monthStart)
  const to = formatDateISO(monthEnd)
  const { data: events } = useQuery({ queryKey: ['journal-events', from, to], queryFn: () => fetchJournalEvents(from, to) })

  const visibleEvents = useMemo(
    () => (events ?? []).filter((e) => !hiddenTypeIds.has(e.tracker_event_tracker_type_id)),
    [events, hiddenTypeIds],
  )

  const weekRows = useMemo(() => buildWeekRows(monthCursor.year, monthCursor.month), [monthCursor])
  const monthLabel = monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const todayIso = formatDateISO(new Date())

  function toggleType(id: string) {
    setHiddenTypeIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      saveHiddenTypeIds(next)
      return next
    })
  }

  function toggleDomain(typeIds: string[]) {
    setHiddenTypeIds((prev) => {
      const allHidden = typeIds.length > 0 && typeIds.every((id) => prev.has(id))
      const next = new Set(prev)
      for (const id of typeIds) {
        if (allHidden) next.delete(id)
        else next.add(id)
      }
      saveHiddenTypeIds(next)
      return next
    })
  }

  const addDomainMutation = useMutation({
    mutationFn: (input: { name: string; color: string; icon: string }) =>
      createJournalDomain({ journal_domain_name: input.name, journal_domain_color: input.color, journal_domain_icon: input.icon }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['journal-domains'] }),
  })

  return (
    <div className={`flex min-h-svh flex-col bg-background ${GLASS_BACKGROUND_GRADIENT_CLASS}`}>
      <TopBar />
      <main className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col px-6 py-10">
        <div className="mb-6 flex shrink-0 items-center justify-between">
          <h1 className="text-base font-bold">Journal</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setFilterOpen(true)}>
              Filter
            </Button>
            <Button size="sm" onClick={() => setEntryOpen(true)}>
              + Log entry
            </Button>
          </div>
        </div>

        <div className={`mb-4 flex shrink-0 items-center justify-between rounded-xl p-3 ${GLASS_CARD_CLASS}`}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMonthCursor((c) => (c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 }))}
          >
            Prev
          </Button>
          <span className="text-sm font-bold">{monthLabel}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMonthCursor((c) => (c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 }))}
          >
            Next
          </Button>
        </div>

        <div className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl p-3 ${GLASS_CARD_CLASS}`}>
          <div className="grid shrink-0 grid-cols-[1.5rem_repeat(7,1fr)] gap-1 pb-1 text-center text-[11px] text-muted-foreground">
            <div />
            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          {/* A single flat grid for the whole month (not one nested grid per week) - week
              rows use `minmax(0, 1fr)`, not bare `1fr`, so a content-heavy week can't
              inflate its own track: every row gets an exactly equal share of the grid's
              height regardless of how many events it holds. */}
          <div
            className="grid min-h-0 flex-1 grid-cols-[1.5rem_repeat(7,1fr)] gap-1"
            style={{ gridTemplateRows: `repeat(${weekRows.length}, minmax(0, 1fr))` }}
          >
            {weekRows.map((row, rowIndex) => {
              const rowStartIso = formatDateISO(row.days[0])
              const rowEndIso = formatDateISO(row.days[6])
              const rowEvents = visibleEvents.filter(
                (e) =>
                  e.tracker_event_occurred_on <= rowEndIso &&
                  (e.tracker_event_occurred_on_end ?? e.tracker_event_occurred_on) >= rowStartIso,
              )
              const multiDayAll = assignLanes(rowEvents.filter(isMultiDay))
              const multiDay = multiDayAll.filter((m) => m.lane < MAX_LANES)
              const gridRow = rowIndex + 1
              // Per-day lane reservation, not the row's global MAX_LANES - a day no
              // multi-day bar actually crosses gets no reserved gap at all, only days
              // a bar visually covers get pushed down far enough to clear it.
              const laneCoverageByDay = row.days.map((date) => {
                const iso = formatDateISO(date)
                const covering = multiDay.filter(
                  ({ event }) => event.tracker_event_occurred_on <= iso && iso <= (event.tracker_event_occurred_on_end ?? event.tracker_event_occurred_on),
                )
                return covering.length > 0 ? Math.max(...covering.map((c) => c.lane)) + 1 : 0
              })

              return (
                <Fragment key={rowStartIso}>
                  <div
                    className="flex items-start justify-center pt-0.5 text-[10px] text-muted-foreground"
                    style={{ gridColumn: 1, gridRow }}
                  >
                    {row.weekNumber}
                  </div>
                  {row.days.map((date, i) => {
                    const inMonth = date.getMonth() === monthCursor.month
                    const iso = formatDateISO(date)
                    const dayEvents = rowEvents.filter((e) => !isMultiDay(e) && e.tracker_event_occurred_on === iso)
                    const overflow = dayEvents.length > MAX_CHIP_SLOTS
                    const visibleCount = overflow ? MAX_CHIP_SLOTS - 1 : dayEvents.length
                    const visibleDayEvents = dayEvents.slice(0, visibleCount)
                    return (
                      <button
                        type="button"
                        key={iso}
                        onClick={() => navigate(`/journal/day/${iso}`)}
                        className={`flex h-full min-h-0 flex-col items-stretch overflow-hidden rounded text-left hover:bg-muted ${iso === todayIso ? 'ring-2 ring-primary' : ''} ${inMonth ? '' : 'text-muted-foreground/40'}`}
                        style={{ gridColumn: i + 2, gridRow }}
                      >
                        <span className="shrink-0 px-1 pt-0.5 text-xs" style={{ height: DAY_NUMBER_HEIGHT }}>
                          {date.getDate()}
                        </span>
                        {/* Reserves only as much lane height as actually covers this specific day - a
                            day no bar crosses gets zero, so its chips start right under the date. Includes
                            the same BAR_GAP clearance above/between/below the bars that chips get from
                            each other via their own `gap-0.5`. */}
                        <span
                          className="shrink-0"
                          style={{ height: laneCoverageByDay[i] > 0 ? BAR_GAP + laneCoverageByDay[i] * (BAR_HEIGHT + BAR_GAP) : 0 }}
                          aria-hidden
                        />
                        <span className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
                          {visibleDayEvents.map((event) => {
                            const type = typeById.get(event.tracker_event_tracker_type_id)
                            const domain = type ? domainById.get(type.tracker_type_domain_id) : undefined
                            return (
                              <span
                                key={event.tracker_event_id}
                                className="flex items-center gap-1 truncate rounded px-1 text-[10px] font-semibold"
                                style={{
                                  backgroundColor: domain?.journal_domain_color ?? '#8888',
                                  color: readableTextColor(domain?.journal_domain_color ?? '#888888'),
                                }}
                              >
                                <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: type?.tracker_type_color }} />
                                <span className="truncate">{type?.tracker_type_name}</span>
                              </span>
                            )
                          })}
                          {overflow && (
                            <span className="truncate text-[9px] text-muted-foreground">+{dayEvents.length - visibleCount} more</span>
                          )}
                        </span>
                      </button>
                    )
                  })}
                  {/* Positioned by fixed pixel offset from the row's own top, independent of the
                      row's actual (now-variable, viewport-driven) height - anchors reliably to the
                      day-number + lane-slot band regardless of row height. */}
                  {multiDay.map(({ event, lane }) => {
                    const type = typeById.get(event.tracker_event_tracker_type_id)
                    const domain = type ? domainById.get(type.tracker_type_domain_id) : undefined
                    const endIso = event.tracker_event_occurred_on_end ?? event.tracker_event_occurred_on
                    let startCol = 0
                    let endCol = 6
                    row.days.forEach((d, i) => {
                      const iso = formatDateISO(d)
                      if (iso < event.tracker_event_occurred_on) startCol = i + 1
                      if (iso <= endIso) endCol = i
                    })
                    return (
                      <button
                        type="button"
                        key={`${event.tracker_event_id}-${rowStartIso}`}
                        onClick={() => navigate(`/journal/day/${event.tracker_event_occurred_on}`)}
                        className="truncate rounded px-1 text-left text-[10px] font-semibold"
                        style={{
                          gridColumn: `${startCol + 2} / ${endCol + 3}`,
                          gridRow,
                          alignSelf: 'start',
                          marginTop: DAY_NUMBER_HEIGHT + BAR_GAP + lane * (BAR_HEIGHT + BAR_GAP),
                          height: BAR_HEIGHT,
                          backgroundColor: domain?.journal_domain_color ?? '#8888',
                          color: readableTextColor(domain?.journal_domain_color ?? '#888888'),
                        }}
                      >
                        {type?.tracker_type_name}
                      </button>
                    )
                  })}
                </Fragment>
              )
            })}
          </div>
        </div>
      </main>

      <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
        <FilterDialogContent
          domains={domains ?? []}
          activeTypes={activeTypes}
          hiddenTypeIds={hiddenTypeIds}
          onToggleType={toggleType}
          onToggleDomain={toggleDomain}
          onAddDomain={(input) => addDomainMutation.mutate(input)}
        />
      </Dialog>

      <Dialog open={entryOpen} onOpenChange={setEntryOpen}>
        <EntryDialogContent
          domains={domains ?? []}
          activeTypes={activeTypes}
          defaultDate={todayIso}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['journal-events'] })
            setEntryOpen(false)
          }}
        />
      </Dialog>
    </div>
  )
}

function FilterDialogContent({
  domains,
  activeTypes,
  hiddenTypeIds,
  onToggleType,
  onToggleDomain,
  onAddDomain,
}: {
  domains: JournalDomain[]
  activeTypes: JournalType[]
  hiddenTypeIds: Set<string>
  onToggleType: (id: string) => void
  onToggleDomain: (typeIds: string[]) => void
  onAddDomain: (input: { name: string; color: string; icon: string }) => void
}) {
  const [addingDomain, setAddingDomain] = useState(false)
  const [domainName, setDomainName] = useState('')
  const [domainColor, setDomainColor] = useState(DOMAIN_COLORS[0])
  const [domainIcon, setDomainIcon] = useState(DOMAIN_ICONS[0])

  const typesByDomain = new Map<string, JournalType[]>()
  for (const type of activeTypes) {
    const list = typesByDomain.get(type.tracker_type_domain_id) ?? []
    list.push(type)
    typesByDomain.set(type.tracker_type_domain_id, list)
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Filter</DialogTitle>
      </DialogHeader>
      <div className="mb-2">
        <Link to="/journal/overview" className="text-sm font-semibold text-primary underline">
          Journal overview
        </Link>
      </div>
      <div className="flex flex-col gap-3">
        {domains.map((domain) => {
          const domainTypes = typesByDomain.get(domain.journal_domain_id) ?? []
          const typeIds = domainTypes.map((t) => t.tracker_type_id)
          const allHidden = typeIds.length > 0 && typeIds.every((id) => hiddenTypeIds.has(id))
          return (
            <div key={domain.journal_domain_id} className="flex flex-col gap-1.5">
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={!allHidden} onChange={() => onToggleDomain(typeIds)} className="size-4 accent-primary" />
                <span aria-hidden>{domain.journal_domain_icon}</span>
                {domain.journal_domain_name}
              </label>
              <div className="ml-6 flex flex-wrap gap-1.5">
                {domainTypes.map((type) => (
                  <button
                    key={type.tracker_type_id}
                    type="button"
                    onClick={() => onToggleType(type.tracker_type_id)}
                    className="rounded-full px-2 py-0.5 text-xs font-semibold"
                    style={
                      hiddenTypeIds.has(type.tracker_type_id)
                        ? { border: `1px solid ${type.tracker_type_color}`, color: type.tracker_type_color }
                        : { backgroundColor: type.tracker_type_color, color: readableTextColor(type.tracker_type_color) }
                    }
                  >
                    {type.tracker_type_icon} {type.tracker_type_name}
                  </button>
                ))}
                <Link
                  to={`/journal/types/new?domain=${domain.journal_domain_id}&return=/journal`}
                  className="rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground"
                >
                  + Add type
                </Link>
              </div>
            </div>
          )
        })}

        {addingDomain ? (
          <div className="flex flex-col gap-2 rounded-lg border border-border p-2">
            <Input placeholder="Domain name" value={domainName} onChange={(e) => setDomainName(e.target.value)} />
            <div className="flex flex-wrap gap-1.5">
              {DOMAIN_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={domainColor === c}
                  onClick={() => setDomainColor(c)}
                  className="size-6 rounded-full"
                  style={{ backgroundColor: c, outline: domainColor === c ? '2px solid var(--ring)' : 'none' }}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {DOMAIN_ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  aria-pressed={domainIcon === icon}
                  onClick={() => setDomainIcon(icon)}
                  className={`flex size-8 items-center justify-center rounded-lg border text-base ${domainIcon === icon ? 'border-primary' : 'border-border'}`}
                >
                  {icon}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={!domainName.trim()}
                onClick={() => {
                  onAddDomain({ name: domainName.trim(), color: domainColor, icon: domainIcon })
                  setAddingDomain(false)
                  setDomainName('')
                }}
              >
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => setAddingDomain(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setAddingDomain(true)}>
            + Add domain
          </Button>
        )}
      </div>
    </DialogContent>
  )
}

export function EntryDialogContent({
  domains,
  activeTypes,
  defaultDate,
  onSaved,
}: {
  domains: JournalDomain[]
  activeTypes: JournalType[]
  defaultDate: string
  onSaved: () => void
}) {
  const [domainId, setDomainId] = useState(domains[0]?.journal_domain_id ?? '')
  const typesInDomain = activeTypes.filter((t) => t.tracker_type_domain_id === domainId)
  const [typeId, setTypeId] = useState(typesInDomain[0]?.tracker_type_id ?? '')
  const [startDate, setStartDate] = useState(defaultDate)
  const [endDate, setEndDate] = useState(defaultDate)
  const [allDay, setAllDay] = useState(false)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('09:30')
  const [note, setNote] = useState('')

  const effectiveTypesInDomain = activeTypes.filter((t) => t.tracker_type_domain_id === domainId)
  const effectiveTypeId = effectiveTypesInDomain.some((t) => t.tracker_type_id === typeId)
    ? typeId
    : (effectiveTypesInDomain[0]?.tracker_type_id ?? '')

  const saveMutation = useMutation({
    mutationFn: () =>
      createJournalEvent({
        tracker_event_tracker_type_id: effectiveTypeId,
        tracker_event_occurred_on: startDate,
        tracker_event_occurred_on_end: endDate !== startDate ? endDate : undefined,
        tracker_event_occurred_at: allDay ? undefined : startTime,
        tracker_event_occurred_at_end: allDay ? undefined : endTime,
        tracker_event_note: note || undefined,
      }),
    onSuccess: onSaved,
  })

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Log an entry</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="entry-domain">Domain</Label>
          <select
            id="entry-domain"
            className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
            value={domainId}
            onChange={(e) => setDomainId(e.target.value)}
          >
            {domains.map((d) => (
              <option key={d.journal_domain_id} value={d.journal_domain_id}>
                {d.journal_domain_icon} {d.journal_domain_name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="entry-type">Type</Label>
          <select
            id="entry-type"
            className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
            value={effectiveTypeId}
            onChange={(e) => setTypeId(e.target.value)}
          >
            {effectiveTypesInDomain.map((t) => (
              <option key={t.tracker_type_id} value={t.tracker_type_id}>
                {t.tracker_type_icon} {t.tracker_type_name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-3">
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="entry-start">From</Label>
            <Input id="entry-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="entry-end">To</Label>
            <Input id="entry-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="entry-allday">All day</Label>
          <input
            id="entry-allday"
            type="checkbox"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
            className="size-4 accent-primary"
          />
        </div>
        {!allDay && (
          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="entry-start-time">Start time</Label>
              <Input
                id="entry-start-time"
                type="time"
                value={startTime}
                onChange={(e) => {
                  const value = e.target.value
                  setStartTime(value)
                  const [h, m] = value.split(':').map(Number)
                  const end = new Date(2000, 0, 1, h, m + 30)
                  setEndTime(`${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`)
                }}
              />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="entry-end-time">End time</Label>
              <Input id="entry-end-time" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="entry-note">Note</Label>
          <Input id="entry-note" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <Button onClick={() => saveMutation.mutate()} disabled={!effectiveTypeId || saveMutation.isPending}>
          {saveMutation.isPending ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </DialogContent>
  )
}
