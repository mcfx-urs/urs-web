import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import TopBar from '@/components/TopBar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createBakePlan, fetchBakePlans } from '@/lib/baking'
import { GLASS_BACKGROUND_GRADIENT_CLASS, GLASS_CARD_CLASS } from '@/lib/glass-style'

export default function BakingHubPage() {
  const queryClient = useQueryClient()
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')

  const { data: plans, isLoading } = useQuery({ queryKey: ['bake-plans', 'active'], queryFn: () => fetchBakePlans('active') })

  const createMutation = useMutation({
    mutationFn: () => createBakePlan(new Date(`${date}T${time}:00`)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bake-plans'] })
      setDate('')
      setTime('')
    },
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (date && time) createMutation.mutate()
  }

  return (
    <div className={`min-h-svh bg-background ${GLASS_BACKGROUND_GRADIENT_CLASS}`}>
      <TopBar />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-base font-bold">Baking</h1>
          <Link to="/baking/history" className="text-xs text-muted-foreground hover:text-foreground">
            History &rarr;
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="mb-8 flex items-end gap-3">
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="anchor-date">Bake date</Label>
            <Input id="anchor-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="anchor-time">Bake time</Label>
            <Input id="anchor-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
          </div>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creating...' : 'New sourdough plan'}
          </Button>
        </form>

        {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {!isLoading && (plans ?? []).length === 0 && <p className="text-sm text-muted-foreground">No active plans.</p>}

        <div className="flex flex-col gap-3">
          {plans?.map((plan) => (
            <Link
              key={plan.bake_plan_id}
              to={`/baking/${plan.bake_plan_id}`}
              className={`block rounded-xl p-4 hover:border-primary ${GLASS_CARD_CLASS}`}
            >
              <div className="text-sm font-bold">Sourdough bread</div>
              <div className="text-xs text-muted-foreground">{plan.bake_plan_anchor_at}</div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
