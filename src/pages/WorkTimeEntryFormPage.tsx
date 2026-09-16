import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import TopBar from '@/components/TopBar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { GLASS_BACKGROUND_GRADIENT_CLASS } from '@/lib/glass-style'
import {
  computeTotals,
  createWorkTimeEntry,
  dailyHoursWorked,
  fetchWorkSettings,
  fetchWorkTimeEntries,
  formatHours,
  formatSignedHours,
  updateWorkTimeEntry,
  type WorkTimeEntry,
} from '@/lib/worktime'

type BreakDraft = { id: string; start: string; end: string }

function newBreakId(): string {
  return crypto.randomUUID()
}

export default function WorkTimeEntryFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEditing = Boolean(id)

  const { data: entries, isLoading } = useQuery({
    queryKey: ['worktime-entries'],
    queryFn: fetchWorkTimeEntries,
    enabled: isEditing,
  })
  const { data: settings } = useQuery({ queryKey: ['worktime-settings'], queryFn: fetchWorkSettings })
  const existing = entries?.find((e) => e.work_time_entry_id === id)

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
          <p className="text-sm text-muted-foreground">Entry not found.</p>
        </main>
      </div>
    )
  }

  return (
    <EntryForm
      key={existing?.work_time_entry_id ?? 'new'}
      existing={existing}
      userDefaultTargetHours={settings?.default_daily_target_hours ?? ''}
    />
  )
}

function EntryForm({ existing, userDefaultTargetHours }: { existing?: WorkTimeEntry; userDefaultTargetHours: string }) {
  const isEditing = Boolean(existing)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [date, setDate] = useState(existing?.work_time_entry_date ?? new Date().toISOString().slice(0, 10))
  const [workStart, setWorkStart] = useState(existing?.work_time_entry_work_start.slice(0, 5) ?? '')
  const [workEnd, setWorkEnd] = useState(existing?.work_time_entry_work_end.slice(0, 5) ?? '')
  const [targetDailyHours, setTargetDailyHours] = useState(existing?.work_time_entry_target_daily_hours ?? '')
  // Default on since the paid morning break applies almost every day.
  const [paidBreak, setPaidBreak] = useState(existing ? existing.work_time_entry_paid_break === '1' : true)
  const [mealAllowance, setMealAllowance] = useState(existing ? existing.work_time_entry_meal_allowance === '1' : false)
  const [comment, setComment] = useState(existing?.work_time_entry_comment ?? '')
  const [breaks, setBreaks] = useState<BreakDraft[]>(
    existing?.breaks.map((b) => ({
      id: newBreakId(),
      start: b.work_time_break_start_time.slice(0, 5),
      end: b.work_time_break_end_time.slice(0, 5),
    })) ?? [],
  )

  const isValid = Boolean(date && workStart && workEnd && breaks.every((b) => b.start && b.end))

  const saveMutation = useMutation({
    mutationFn: () => {
      const input = {
        work_time_entry_date: date,
        work_time_entry_work_start: `${workStart}:00`,
        work_time_entry_work_end: `${workEnd}:00`,
        work_time_entry_target_daily_hours: targetDailyHours,
        work_time_entry_paid_break: paidBreak ? '1' : '0',
        work_time_entry_meal_allowance: mealAllowance ? '1' : '0',
        work_time_entry_comment: comment.trim(),
        breaks: breaks.map((b) => ({ work_time_break_start_time: `${b.start}:00`, work_time_break_end_time: `${b.end}:00` })),
      }
      return isEditing && existing ? updateWorkTimeEntry(existing.work_time_entry_id, input) : createWorkTimeEntry(input)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worktime-entries'] })
      navigate('/worktime')
    },
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (isValid) saveMutation.mutate()
  }

  function addBreak() {
    setBreaks((b) => [...b, { id: newBreakId(), start: '', end: '' }])
  }

  function removeBreak(breakId: string) {
    setBreaks((b) => b.filter((x) => x.id !== breakId))
  }

  // Live preview of the same totals the month view shows after saving -
  // reuses dailyHoursWorked/computeTotals, just fed from the in-progress
  // form. Hidden until both times are set.
  const preview =
    workStart && workEnd
      ? computeTotals(
          dailyHoursWorked(
            `${workStart}:00`,
            `${workEnd}:00`,
            paidBreak,
            breaks.filter((b) => b.start && b.end).map((b) => ({ start: `${b.start}:00`, end: `${b.end}:00` })),
          ),
          targetDailyHours,
          userDefaultTargetHours,
        )
      : null

  return (
    <div className={`min-h-svh bg-background ${GLASS_BACKGROUND_GRADIENT_CLASS}`}>
      <TopBar />
      <main className="mx-auto max-w-lg px-6 py-10">
        <h1 className="mb-6 text-base font-bold">{isEditing ? 'Edit entry' : 'New entry'}</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={isEditing}
              required
            />
            {isEditing && <p className="text-xs text-muted-foreground">Date can't be changed once created.</p>}
          </div>

          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="work-start">Start</Label>
              <Input id="work-start" type="time" value={workStart} onChange={(e) => setWorkStart(e.target.value)} required />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="work-end">End</Label>
              <Input id="work-end" type="time" value={workEnd} onChange={(e) => setWorkEnd(e.target.value)} required />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="target-hours">Target hours (optional)</Label>
            <Input
              id="target-hours"
              type="number"
              step="0.25"
              value={targetDailyHours}
              onChange={(e) => setTargetDailyHours(e.target.value)}
            />
          </div>

          <label className="flex items-center justify-between gap-2">
            <span className="text-sm">Paid morning break (+15 min)</span>
            <input
              type="checkbox"
              checked={paidBreak}
              onChange={(e) => setPaidBreak(e.target.checked)}
              className="size-4 accent-primary"
            />
          </label>

          <label className="flex items-center justify-between gap-2">
            <span className="text-sm">Meal allowance (CHF 18.–)</span>
            <input
              type="checkbox"
              checked={mealAllowance}
              onChange={(e) => setMealAllowance(e.target.checked)}
              className="size-4 accent-primary"
            />
          </label>

          <div className="flex flex-col gap-2">
            <Label htmlFor="comment">Comment</Label>
            <Textarea id="comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Breaks</Label>
            {breaks.map((b) => (
              <div key={b.id} className="flex items-center gap-2">
                <Input
                  type="time"
                  aria-label="Break start"
                  value={b.start}
                  onChange={(e) => setBreaks((prev) => prev.map((x) => (x.id === b.id ? { ...x, start: e.target.value } : x)))}
                  className="flex-1"
                />
                <Input
                  type="time"
                  aria-label="Break end"
                  value={b.end}
                  onChange={(e) => setBreaks((prev) => prev.map((x) => (x.id === b.id ? { ...x, end: e.target.value } : x)))}
                  className="flex-1"
                />
                <Button type="button" variant="ghost" size="sm" onClick={() => removeBreak(b.id)}>
                  Remove
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={addBreak}>
              Add break
            </Button>
          </div>

          {preview && preview.dailyTotalHours !== null && (
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted p-3">
              <span className="text-sm font-bold">{formatHours(preview.dailyTotalHours)} h</span>
              {preview.overUndertimeHours !== null && (
                <span className={`text-sm ${preview.overUndertimeHours < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {formatSignedHours(preview.overUndertimeHours)}
                </span>
              )}
            </div>
          )}

          {saveMutation.isError && <p className="text-sm text-destructive">Save failed.</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={!isValid || saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate('/worktime')}>
              Cancel
            </Button>
          </div>
        </form>
      </main>
    </div>
  )
}
