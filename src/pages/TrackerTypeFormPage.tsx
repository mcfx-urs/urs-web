import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import TopBar from '@/components/TopBar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { archiveTrackerType, createTrackerType, fetchTrackerTypes, updateTrackerType, type TrackerType } from '@/lib/chores'
import { GLASS_BACKGROUND_GRADIENT_CLASS } from '@/lib/glass-style'

// Not tied to any backend enum - tracker_type_color is an unvalidated
// string, this palette is a urs-web-only choice.
const COLORS = ['#6EA23A', '#B3452F', '#3A6EA2', '#A23A8F', '#A28F3A', '#3AA290', '#6B6EA2', '#A2603A']
const EMOJI = ['🧹', '🧺', '🍽️', '🚮', '🛁', '🪴', '🧴', '🐾']

export default function TrackerTypeFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEditing = Boolean(id)

  const { data: types, isLoading } = useQuery({
    queryKey: ['tracker-types'],
    queryFn: fetchTrackerTypes,
    enabled: isEditing,
  })
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

  return <TrackerTypeForm key={existing?.tracker_type_id ?? 'new'} existing={existing} />
}

function TrackerTypeForm({ existing }: { existing?: TrackerType }) {
  const isEditing = Boolean(existing)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

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
        tracker_type_name: name,
        tracker_type_color: color,
        tracker_type_icon: icon,
        tracker_type_calendar: calendar || undefined,
        tracker_type_expected_interval_days: intervalDays ? Number(intervalDays) : undefined,
      }
      if (isEditing && existing) {
        await updateTrackerType(existing.tracker_type_id, input)
      } else {
        await createTrackerType(input)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracker-types'] })
      navigate('/chores')
    },
  })

  const archiveMutation = useMutation({
    mutationFn: () => archiveTrackerType(existing!.tracker_type_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracker-types'] })
      navigate('/chores')
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
            <Button type="button" variant="outline" onClick={() => navigate('/chores')}>
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
