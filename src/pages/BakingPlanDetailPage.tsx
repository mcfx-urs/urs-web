import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import TopBar from '@/components/TopBar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cancelBakePlan, fetchBakePlans, updateBakePlanStep, type BakePlanStep } from '@/lib/baking'
import { formatDateTimeLocal, parseDateTimeLocal } from '@/lib/date-utils'
import { GLASS_BACKGROUND_GRADIENT_CLASS, GLASS_CARD_CLASS } from '@/lib/glass-style'

export default function BakingPlanDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [snoozingStep, setSnoozingStep] = useState<BakePlanStep | null>(null)
  const [dueSteps, setDueSteps] = useState<Set<string>>(new Set())

  const { data: plans, isLoading } = useQuery({ queryKey: ['bake-plans', 'active'], queryFn: () => fetchBakePlans('active') })
  const plan = plans?.find((p) => p.bake_plan_id === id)

  // Foreground-only reminders (urs-web#24's own stated scope, a deliberate
  // simplification from android's AlarmManager): one setTimeout per not-yet-
  // done step, armed only while this page is open, cleared on unmount.
  useEffect(() => {
    if (!plan) return
    const timers = plan.steps
      .filter((s) => !s.bake_plan_step_done_at)
      .map((step) => {
        const at = parseDateTimeLocal(step.bake_plan_step_snoozed_at || step.bake_plan_step_planned_at)
        const delay = at.getTime() - Date.now()
        return setTimeout(() => setDueSteps((prev) => new Set(prev).add(step.bake_plan_step_id)), Math.max(0, delay))
      })
    return () => timers.forEach(clearTimeout)
  }, [plan])

  const stepMutation = useMutation({
    mutationFn: ({ stepId, changes }: { stepId: string; changes: { done?: boolean; snoozed_at?: string } }) =>
      updateBakePlanStep(plan!.bake_plan_id, stepId, changes),
    onSuccess: (_data, { stepId }) => {
      queryClient.invalidateQueries({ queryKey: ['bake-plans'] })
      setDueSteps((prev) => {
        const next = new Set(prev)
        next.delete(stepId)
        return next
      })
      setSnoozingStep(null)
    },
  })

  const cancelMutation = useMutation({
    mutationFn: () => cancelBakePlan(plan!.bake_plan_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bake-plans'] })
      navigate('/baking')
    },
  })

  if (isLoading) {
    return (
      <div className={`min-h-svh bg-background ${GLASS_BACKGROUND_GRADIENT_CLASS}`}>
        <TopBar />
        <main className="mx-auto max-w-lg px-6 py-10">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </main>
      </div>
    )
  }
  if (!plan) {
    return (
      <div className={`min-h-svh bg-background ${GLASS_BACKGROUND_GRADIENT_CLASS}`}>
        <TopBar />
        <main className="mx-auto max-w-lg px-6 py-10">
          <p className="text-sm text-muted-foreground">Plan not found.</p>
        </main>
      </div>
    )
  }

  const sortedSteps = [...plan.steps].sort((a, b) => Number(a.bake_plan_step_index) - Number(b.bake_plan_step_index))

  return (
    <div className={`min-h-svh bg-background ${GLASS_BACKGROUND_GRADIENT_CLASS}`}>
      <TopBar />
      <main className="mx-auto max-w-lg px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-base font-bold">Sourdough bread</h1>
          <Button variant="outline" size="sm" disabled={cancelMutation.isPending} onClick={() => cancelMutation.mutate()}>
            Cancel plan
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          {sortedSteps.map((step) => {
            const done = Boolean(step.bake_plan_step_done_at)
            const due = dueSteps.has(step.bake_plan_step_id)
            const time = step.bake_plan_step_snoozed_at || step.bake_plan_step_planned_at
            return (
              <div
                key={step.bake_plan_step_id}
                className={`flex items-center gap-3 rounded-xl p-3 ${GLASS_CARD_CLASS} ${due && !done ? 'border-primary' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={done}
                  onChange={(e) => stepMutation.mutate({ stepId: step.bake_plan_step_id, changes: { done: e.target.checked } })}
                  className="size-4 accent-primary"
                />
                <div className="flex-1">
                  <div className={`text-sm ${done ? 'text-muted-foreground line-through' : ''}`}>{step.bake_plan_step_label}</div>
                  <div className="text-xs text-muted-foreground">{time}</div>
                </div>
                {!done && (
                  <Button size="sm" variant="outline" onClick={() => setSnoozingStep(step)}>
                    Snooze
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      </main>

      {snoozingStep && (
        <SnoozeDialog
          step={snoozingStep}
          onCancel={() => setSnoozingStep(null)}
          onSave={(date) =>
            stepMutation.mutate({ stepId: snoozingStep.bake_plan_step_id, changes: { snoozed_at: formatDateTimeLocal(date) } })
          }
        />
      )}
    </div>
  )
}

function SnoozeDialog({ step, onCancel, onSave }: { step: BakePlanStep; onCancel: () => void; onSave: (date: Date) => void }) {
  const initial = parseDateTimeLocal(step.bake_plan_step_snoozed_at || step.bake_plan_step_planned_at)
  const [date, setDate] = useState(formatDateTimeLocal(initial).slice(0, 10))
  const [time, setTime] = useState(formatDateTimeLocal(initial).slice(11, 16))

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Snooze: {step.bake_plan_step_label}</DialogTitle>
        </DialogHeader>
        <div className="flex gap-3">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="flex-1" />
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="flex-1" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button disabled={!date || !time} onClick={() => date && time && onSave(new Date(`${date}T${time}:00`))}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
