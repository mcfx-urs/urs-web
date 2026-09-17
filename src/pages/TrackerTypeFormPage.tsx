import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import TopBar from '@/components/TopBar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  archiveJournalType,
  createJournalType,
  fetchJournalDomains,
  fetchJournalTypes,
  updateJournalType,
  type JournalType,
} from '@/lib/journal'
import { GLASS_BACKGROUND_GRADIENT_CLASS } from '@/lib/glass-style'

// Not tied to any backend enum - tracker_type_color is an unvalidated
// string, this palette is a urs-web-only choice.
const COLORS = ['#6EA23A', '#B3452F', '#3A6EA2', '#A23A8F', '#A28F3A', '#3AA290', '#6B6EA2', '#A2603A']
const EMOJI = ['🧹', '🧺', '🍽️', '🚮', '🛁', '🪴', '🧴', '🐾']

// Shared by both the Chores route (/chores/types/...) and the Journal route
// (/journal/types/...) - GitHub issue #28. `domain` presets the domain for a
// brand-new type (Journal's "+ Add type" scoped to a domain); `return`
// controls where Save/Cancel navigate back to, defaulting to /chores for
// the existing Chores flow that predates both query params.
export default function TrackerTypeFormPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const isEditing = Boolean(id)
  const presetDomainId = searchParams.get('domain') ?? undefined
  const returnTo = searchParams.get('return') ?? '/chores'

  const { data: types, isLoading } = useQuery({
    queryKey: ['journal-types'],
    queryFn: fetchJournalTypes,
    enabled: isEditing,
  })
  const { data: domains } = useQuery({ queryKey: ['journal-domains'], queryFn: fetchJournalDomains })
  const existing = types?.find((t) => t.tracker_type_id === id)

  if (isEditing && isLoading) {
    return (
      <div className={`min-h-svh bg-background ${GLASS_BACKGROUND_GRADIENT_CLASS}`}>
        <TopBar />
        <main className="mx-auto max-w-lg px-6 py-10">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </main>
      </div>
    )
  }
  if (isEditing && !existing) {
    return (
      <div className={`min-h-svh bg-background ${GLASS_BACKGROUND_GRADIENT_CLASS}`}>
        <TopBar />
        <main className="mx-auto max-w-lg px-6 py-10">
          <p className="text-sm text-muted-foreground">Chore not found.</p>
        </main>
      </div>
    )
  }

  return (
    <TrackerTypeForm
      key={existing?.tracker_type_id ?? 'new'}
      existing={existing}
      domainIds={(domains ?? []).map((d) => d.journal_domain_id)}
      domainNames={Object.fromEntries((domains ?? []).map((d) => [d.journal_domain_id, d.journal_domain_name]))}
      presetDomainId={presetDomainId}
      returnTo={returnTo}
    />
  )
}

function TrackerTypeForm({
  existing,
  domainIds,
  domainNames,
  presetDomainId,
  returnTo,
}: {
  existing?: JournalType
  domainIds: string[]
  domainNames: Record<string, string>
  presetDomainId?: string
  returnTo: string
}) {
  const isEditing = Boolean(existing)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [domainId, setDomainId] = useState(existing?.tracker_type_domain_id ?? presetDomainId ?? domainIds[0] ?? '')
  const [name, setName] = useState(existing?.tracker_type_name ?? '')
  const [color, setColor] = useState(existing?.tracker_type_color ?? COLORS[0])
  const [icon, setIcon] = useState(existing?.tracker_type_icon ?? EMOJI[0])
  const [calendar, setCalendar] = useState(existing?.tracker_type_calendar ?? '')
  const [intervalDays, setIntervalDays] = useState(
    existing?.tracker_type_expected_interval_days ? String(existing.tracker_type_expected_interval_days) : '',
  )

  const saveMutation = useMutation({
    mutationFn: async () => {
      const input = {
        tracker_type_domain_id: domainId,
        tracker_type_name: name,
        tracker_type_color: color,
        tracker_type_icon: icon,
        tracker_type_calendar: calendar || undefined,
        tracker_type_expected_interval_days: intervalDays ? Number(intervalDays) : undefined,
      }
      if (isEditing && existing) {
        await updateJournalType(existing.tracker_type_id, input)
      } else {
        await createJournalType(input)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal-types'] })
      navigate(returnTo)
    },
  })

  const archiveMutation = useMutation({
    mutationFn: () => archiveJournalType(existing!.tracker_type_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal-types'] })
      navigate(returnTo)
    },
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    saveMutation.mutate()
  }

  return (
    <div className={`min-h-svh bg-background ${GLASS_BACKGROUND_GRADIENT_CLASS}`}>
      <TopBar />
      <main className="mx-auto max-w-lg px-6 py-10">
        <h1 className="mb-6 text-base font-bold">{isEditing ? 'Edit chore' : 'New chore'}</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {domainIds.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="domain">Domain</Label>
              <select
                id="domain"
                className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                value={domainId}
                onChange={(e) => setDomainId(e.target.value)}
              >
                {domainIds.map((id) => (
                  <option key={id} value={id}>
                    {domainNames[id]}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  aria-pressed={color === c}
                  onClick={() => setColor(c)}
                  className="size-8 rounded-full outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
                  style={{ backgroundColor: c, outline: color === c ? '2px solid var(--ring)' : 'none' }}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Icon</Label>
            <div className="flex flex-wrap gap-2">
              {EMOJI.map((e) => (
                <button
                  key={e}
                  type="button"
                  aria-pressed={icon === e}
                  onClick={() => setIcon(e)}
                  className={`flex size-9 items-center justify-center rounded-lg border text-lg ${icon === e ? 'border-primary' : 'border-border'}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="calendar">Calendar label (optional)</Label>
            <Input id="calendar" value={calendar} onChange={(e) => setCalendar(e.target.value)} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="interval">Expected interval, days (optional)</Label>
            <Input
              id="interval"
              type="number"
              min={1}
              value={intervalDays}
              onChange={(e) => setIntervalDays(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate(returnTo)}>
              Cancel
            </Button>
            {isEditing && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => archiveMutation.mutate()}
                disabled={archiveMutation.isPending}
              >
                Archive
              </Button>
            )}
          </div>
        </form>
      </main>
    </div>
  )
}
