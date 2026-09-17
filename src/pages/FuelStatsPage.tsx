import { useMemo, useState } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import LineChart, { type LineSeries } from '@/components/charts/LineChart'
import TopBar from '@/components/TopBar'
import VehiclePicker from '@/components/VehiclePicker'
import { GLASS_BACKGROUND_GRADIENT_CLASS, GLASS_CARD_CLASS } from '@/lib/glass-style'
import { averageConsumptionL100Km, buildSpans, monthlyBreakdown } from '@/lib/fuel-stats'
import { fetchFills, fetchFuelPrices } from '@/lib/fuel'
import { fetchFuelTypes } from '@/lib/fuel-types'
import { fetchVehicles } from '@/lib/vehicles'

const PRICE_SERIES_COLORS = ['#3b82f6', '#f97316', '#22c55e']

export default function FuelStatsPage() {
  const [vehicleId, setVehicleId] = useState('')

  const { data: vehicles } = useQuery({ queryKey: ['vehicles'], queryFn: fetchVehicles })
  const { data: fills, isLoading } = useQuery({ queryKey: ['fills'], queryFn: fetchFills })
  const { data: fuelTypes } = useQuery({ queryKey: ['fuel-types'], queryFn: fetchFuelTypes })

  const filteredFills = useMemo(
    () => (fills ?? []).filter((f) => !vehicleId || f.fill_vehicle_id === vehicleId),
    [fills, vehicleId],
  )

  const samples = useMemo(() => buildSpans(filteredFills), [filteredFills])
  const avgConsumption = averageConsumptionL100Km(samples)
  const totalLiters = filteredFills.reduce((sum, f) => sum + Number(f.fill_amount), 0)
  const totalCost = filteredFills.reduce((sum, f) => sum + Number(f.fill_price) * Number(f.fill_amount), 0)
  const totalKm = samples.reduce((sum, s) => sum + s.kmDriven, 0)
  const avgPricePerLiter = totalLiters > 0 ? totalCost / totalLiters : null
  const monthly = useMemo(() => monthlyBreakdown(filteredFills), [filteredFills])

  const consumptionSeries: LineSeries = {
    label: 'L/100km',
    color: PRICE_SERIES_COLORS[0],
    points: monthly.filter((m) => m.avgConsumption !== null).map((m) => ({ x: m.yearMonth.slice(5), y: m.avgConsumption! })),
  }
  const distanceSeries: LineSeries = {
    label: 'km',
    color: PRICE_SERIES_COLORS[1],
    points: monthly.filter((m) => m.totalKm > 0).map((m) => ({ x: m.yearMonth.slice(5), y: m.totalKm })),
  }

  const priceQueries = useQueries({
    queries: (fuelTypes ?? []).map((f) => ({
      queryKey: ['fuel-prices', f.fuel_id],
      queryFn: () => fetchFuelPrices(f.fuel_id),
    })),
  })

  const priceSeries: LineSeries[] = (fuelTypes ?? []).map((f, i) => {
    const prices = priceQueries[i]?.data ?? []
    return {
      label: f.fuel_name,
      color: PRICE_SERIES_COLORS[i % PRICE_SERIES_COLORS.length],
      points: [...prices]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((p) => ({ x: p.date.slice(5), y: Number(p.price) })),
    }
  })

  return (
    <div className={`min-h-svh bg-background ${GLASS_BACKGROUND_GRADIENT_CLASS}`}>
      <TopBar />
      <main className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-10">
        <h1 className="text-base font-bold">Fuel stats</h1>

        <div className="max-w-xs">
          <VehiclePicker vehicles={vehicles ?? []} value={vehicleId} onChange={setVehicleId} includeAllOption />
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}

        <div className={`grid grid-cols-2 gap-4 rounded-xl p-4 sm:grid-cols-3 ${GLASS_CARD_CLASS}`}>
          <Stat label="Avg consumption" value={avgConsumption !== null ? `${avgConsumption.toFixed(3)} L/100km` : '-'} />
          <Stat label="Avg price/liter" value={avgPricePerLiter !== null ? avgPricePerLiter.toFixed(3) : '-'} />
          <Stat label="Total cost" value={totalCost.toFixed(2)} />
          <Stat label="Total km" value={totalKm > 0 ? `${totalKm.toFixed(0)} km` : '-'} />
          <Stat label="Fill count" value={String(filteredFills.length)} />
        </div>

        <section>
          <h2 className="mb-2 text-sm font-bold">Consumption over time</h2>
          <LineChart series={[consumptionSeries]} />
        </section>

        <section>
          <h2 className="mb-2 text-sm font-bold">Distance over time</h2>
          <LineChart series={[distanceSeries]} />
        </section>

        <section>
          <h2 className="mb-2 text-sm font-bold">Price history</h2>
          <LineChart series={priceSeries} />
          <div className="mt-2 flex gap-4">
            {priceSeries.map((s) => (
              <span key={s.label} className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} />
                {s.label}
              </span>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-bold">Monthly breakdown</h2>
          <div className="flex flex-col gap-2">
            {monthly.map((m) => (
              <div key={m.yearMonth} className={`flex items-center justify-between rounded-xl p-3 text-sm ${GLASS_CARD_CLASS}`}>
                <span>{m.yearMonth}</span>
                <span>{m.totalCost.toFixed(2)}</span>
                <span>{m.totalKm > 0 ? `${m.totalKm.toFixed(0)} km` : '-'}</span>
                <span>{m.avgConsumption !== null ? `${m.avgConsumption.toFixed(2)} L/100km` : '-'}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-bold">{value}</div>
    </div>
  )
}
