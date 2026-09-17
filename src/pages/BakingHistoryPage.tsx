import { useQuery } from '@tanstack/react-query'
import TopBar from '@/components/TopBar'
import { fetchBakePlans } from '@/lib/baking'
import { GLASS_BACKGROUND_GRADIENT_CLASS, GLASS_CARD_CLASS } from '@/lib/glass-style'

export default function BakingHistoryPage() {
  const { data: completed } = useQuery({ queryKey: ['bake-plans', 'completed'], queryFn: () => fetchBakePlans('completed') })
  const { data: cancelled } = useQuery({ queryKey: ['bake-plans', 'cancelled'], queryFn: () => fetchBakePlans('cancelled') })

  const plans = [...(completed ?? []), ...(cancelled ?? [])].sort((a, b) =>
    b.bake_plan_anchor_at.localeCompare(a.bake_plan_anchor_at),
  )

  return (
    <div className={`min-h-svh bg-background ${GLASS_BACKGROUND_GRADIENT_CLASS}`}>
      <TopBar />
      <main className="mx-auto max-w-lg px-6 py-10">
        <h1 className="mb-6 text-base font-bold">Baking history</h1>
        {plans.length === 0 && <p className="text-sm text-muted-foreground">No plans yet.</p>}
        <div className="flex flex-col gap-3">
          {plans.map((plan) => (
            <div key={plan.bake_plan_id} className={`flex items-center justify-between gap-3 rounded-xl p-4 ${GLASS_CARD_CLASS}`}>
              <div>
                <div className="text-sm font-bold">Sourdough bread</div>
                <div className="text-xs text-muted-foreground">{plan.bake_plan_anchor_at}</div>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  plan.bake_plan_status === 'completed' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                }`}
              >
                {plan.bake_plan_status === 'completed' ? 'Completed' : 'Cancelled'}
              </span>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
