import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import TopBar from '@/components/TopBar'
import { Button } from '@/components/ui/button'
import { deleteFill, fetchFills, fetchStations } from '@/lib/fuel'
import { GLASS_BACKGROUND_GRADIENT_CLASS, GLASS_CARD_CLASS } from '@/lib/glass-style'
import { fetchVehicles } from '@/lib/vehicles'

export default function FuelFillsPage() {
  const queryClient = useQueryClient()
  const { data: fills, isLoading } = useQuery({ queryKey: ['fills'], queryFn: fetchFills })
  const { data: vehicles } = useQuery({ queryKey: ['vehicles'], queryFn: fetchVehicles })
  const { data: stations } = useQuery({ queryKey: ['fuel-stations'], queryFn: fetchStations })

  const vehicleById = useMemo(() => new Map((vehicles ?? []).map((v) => [v.vehicle_id, v])), [vehicles])
  const stationById = useMemo(() => new Map((stations ?? []).map((s) => [s.filling_station_id, s])), [stations])

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFill(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fills'] }),
  })

  return (
    <div className={`min-h-svh bg-background ${GLASS_BACKGROUND_GRADIENT_CLASS}`}>
      <TopBar />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-base font-bold">Fills</h1>
          <Link to="/fuel/add">
            <Button>Add fill</Button>
          </Link>
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {!isLoading && (fills ?? []).length === 0 && <p className="text-sm text-muted-foreground">No fills yet.</p>}

        <div className="flex flex-col gap-3">
          {fills?.map((fill) => {
            const vehicle = vehicleById.get(fill.fill_vehicle_id)
            const station = fill.fill_station_id ? stationById.get(fill.fill_station_id) : undefined
            const total = Number(fill.fill_price) * Number(fill.fill_amount)
            return (
              <div key={fill.fill_id} className={`rounded-xl p-4 ${GLASS_CARD_CLASS}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">{vehicle ? `${vehicle.vehicle_brand} ${vehicle.vehicle_model}` : 'Unknown vehicle'}</span>
                  <span className="text-sm font-bold">
                    {total.toFixed(2)} {fill.fill_currency_code}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {fill.fill_date.slice(0, 10)} - {station ? station.filling_station_name : 'pending location'}
                  </span>
                  <span>
                    {fill.fill_amount} L @ {fill.fill_price}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{fill.fill_odometer} km</span>
                  <div className="flex gap-2">
                    <Link to={`/fuel/add/${fill.fill_id}`}>
                      <Button size="sm" variant="outline">
                        Edit
                      </Button>
                    </Link>
                    <Button size="sm" variant="outline" onClick={() => deleteMutation.mutate(fill.fill_id)}>
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}
