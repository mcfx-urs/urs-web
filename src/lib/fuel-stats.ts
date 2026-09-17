import type { Fill } from './fuel'

export type ConsumptionSample = { date: string; kmDriven: number; liters: number }

// Direct port of urs-android's FuelStats.kt buildSpans(): a "consumption
// sample" is a closed full-tank-to-full-tank span only - liters consumed is
// only meaningful when both endpoints are known to be full. Fills before the
// first full-tank fill are discarded (no baseline); a partial fill after the
// last full-tank fill is discarded too (no closing point yet).
export function buildSpans(fills: Fill[]): ConsumptionSample[] {
  const sorted = [...fills].sort((a, b) => a.fill_date.localeCompare(b.fill_date))
  const samples: ConsumptionSample[] = []
  let anchorOdometer: number | null = null
  let spanLiters = 0

  for (const fill of sorted) {
    const odometer = Number(fill.fill_odometer)
    const liters = Number(fill.fill_amount)
    const isFullTank = fill.fill_is_full_tank === '1'

    if (anchorOdometer === null) {
      if (isFullTank) anchorOdometer = odometer
      continue
    }

    spanLiters += liters
    if (isFullTank) {
      const kmDriven = odometer - anchorOdometer
      if (kmDriven > 0) samples.push({ date: fill.fill_date, kmDriven, liters: spanLiters })
      anchorOdometer = odometer
      spanLiters = 0
    }
  }
  return samples
}

// Ratio-of-sums, never an average of each span's own individual ratio - a
// short, unusually thirsty span shouldn't skew the result disproportionately.
export function averageConsumptionL100Km(samples: ConsumptionSample[]): number | null {
  if (samples.length === 0) return null
  const totalKm = samples.reduce((sum, s) => sum + s.kmDriven, 0)
  const totalLiters = samples.reduce((sum, s) => sum + s.liters, 0)
  return totalKm > 0 ? (totalLiters / totalKm) * 100 : null
}

export type MonthlyBreakdown = {
  yearMonth: string
  totalCost: number
  totalKm: number
  avgConsumption: number | null
}

export function monthlyBreakdown(fills: Fill[]): MonthlyBreakdown[] {
  const samples = buildSpans(fills)
  const byMonth = new Map<string, { cost: number; km: number; samples: ConsumptionSample[] }>()

  for (const fill of fills) {
    const yearMonth = fill.fill_date.slice(0, 7)
    const entry = byMonth.get(yearMonth) ?? { cost: 0, km: 0, samples: [] }
    entry.cost += Number(fill.fill_price) * Number(fill.fill_amount)
    byMonth.set(yearMonth, entry)
  }
  for (const sample of samples) {
    const yearMonth = sample.date.slice(0, 7)
    const entry = byMonth.get(yearMonth) ?? { cost: 0, km: 0, samples: [] }
    entry.km += sample.kmDriven
    entry.samples.push(sample)
    byMonth.set(yearMonth, entry)
  }

  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([yearMonth, entry]) => ({
      yearMonth,
      totalCost: entry.cost,
      totalKm: entry.km,
      avgConsumption: averageConsumptionL100Km(entry.samples),
    }))
}
