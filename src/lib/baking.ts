import { apiFetch } from './api'
import { formatDateTimeLocal } from './date-utils'

export type BakePlanStep = {
  bake_plan_step_id: string
  bake_plan_step_index: string
  bake_plan_step_label: string
  bake_plan_step_planned_at: string
  bake_plan_step_snoozed_at: string
  bake_plan_step_done_at: string
}

export type BakePlan = {
  bake_plan_id: string
  bake_plan_user_id: string
  bake_plan_template_key: string
  bake_plan_anchor_at: string
  bake_plan_status: 'active' | 'completed' | 'cancelled'
  bake_plan_completed_at: string
  steps: BakePlanStep[]
}

// Direct port of urs-android's BakingTemplates.kt sourdough template: 11
// fixed steps, each with a minute offset from the anchor (negative = before
// baking starts). Steps 7 and 8 deliberately share the same timestamp
// (step 7 is a 20-minute-timeout reminder, step 8 the action that follows).
const SOURDOUGH_STEPS: { label: string; offsetMinutes: number }[] = [
  { label: 'Starter füttern (4g Anstellgut + 100g Mehl + 100g Wasser)', offsetMinutes: -2695 },
  { label: 'Mischen (Starter + Wasser verrühren, dann Mehl)', offsetMinutes: -1295 },
  { label: 'Salzen + Stretch&Fold (Start Bulk Fermentation)', offsetMinutes: -1235 },
  { label: 'Coil Fold 2', offsetMinutes: -1175 },
  { label: 'Coil Fold 3', offsetMinutes: -1115 },
  { label: 'Teilen & Vorformen (Ende Bulk Fermentation)', offsetMinutes: -875 },
  { label: 'Benchrest fertig (20min)', offsetMinutes: -855 },
  { label: 'Final Shaping, ab in den Kühlschrank (Start Cold Retard)', offsetMinutes: -855 },
  { label: 'Aus dem Kühlschrank', offsetMinutes: -75 },
  { label: 'Ofen vorheizen (230°C)', offsetMinutes: -45 },
  { label: 'Backen (230°C 20min Dampf → 200°C 35min)', offsetMinutes: 0 },
]

export const SOURDOUGH_TEMPLATE_KEY = 'sourdough_bread'

export function computeSourdoughSteps(anchor: Date): { index: string; label: string; planned_at: string }[] {
  return SOURDOUGH_STEPS.map((step, i) => ({
    index: String(i + 1),
    label: step.label,
    planned_at: formatDateTimeLocal(new Date(anchor.getTime() + step.offsetMinutes * 60 * 1000)),
  }))
}

export async function createBakePlan(anchor: Date): Promise<BakePlan> {
  const res = await apiFetch('/api/v1/baking/plans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      template_key: SOURDOUGH_TEMPLATE_KEY,
      anchor_at: formatDateTimeLocal(anchor),
      steps: computeSourdoughSteps(anchor),
    }),
  })
  if (!res.ok) throw new Error(`create bake plan failed (${res.status})`)
  return res.json()
}

export async function fetchBakePlans(status?: 'active' | 'completed' | 'cancelled'): Promise<BakePlan[]> {
  const res = await apiFetch(status ? `/api/v1/baking/plans?status=${status}` : '/api/v1/baking/plans')
  if (!res.ok) throw new Error(`load bake plans failed (${res.status})`)
  return res.json()
}

export async function updateBakePlanStep(
  planId: string,
  stepId: string,
  changes: { done?: boolean; snoozed_at?: string },
): Promise<void> {
  const res = await apiFetch(`/api/v1/baking/plans/${planId}/steps/${stepId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(changes),
  })
  if (!res.ok) throw new Error(`update bake step failed (${res.status})`)
}

export async function cancelBakePlan(planId: string): Promise<void> {
  const res = await apiFetch(`/api/v1/baking/plans/${planId}`, { method: 'PATCH' })
  if (!res.ok) throw new Error(`cancel bake plan failed (${res.status})`)
}
