import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import TopBar from '@/components/TopBar'
import { Button } from '@/components/ui/button'
import VehiclePicker from '@/components/VehiclePicker'
import { GLASS_BACKGROUND_GRADIENT_CLASS, GLASS_CARD_CLASS } from '@/lib/glass-style'
import { deleteVehicleServiceRecord, fetchVehicleServiceRecords, SERVICE_CATEGORIES } from '@/lib/vehicle-service'
import { fetchVehicles } from '@/lib/vehicles'

const CATEGORY_LABEL = new Map(SERVICE_CATEGORIES.map((c) => [c.code, c.label]))

export default function ServicePage() {
  const queryClient = useQueryClient()
  const [vehicleFilter, setVehicleFilter] = useState('')

  const { data: records, isLoading } = useQuery({ queryKey: ['vehicle-service'], queryFn: fetchVehicleServiceRecords })
  const { data: vehicles } = useQuery({ queryKey: ['vehicles'], queryFn: fetchVehicles })

  const vehicleById = useMemo(() => new Map((vehicles ?? []).map((v) => [v.vehicle_id, v])), [vehicles])

  const filtered = (records ?? []).filter((r) => !vehicleFilter || r.vehicle_service_vehicle_id === vehicleFilter)

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteVehicleServiceRecord(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vehicle-service'] }),
  })

  return (
    <div className={`min-h-svh bg-background ${GLASS_BACKGROUND_GRADIENT_CLASS}`}>
      <TopBar />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-base font-bold">Vehicle service</h1>
          <Link to="/service/new">
            <Button>Add record</Button>
          </Link>
        </div>

        <div className="mb-6 max-w-xs">
          <VehiclePicker vehicles={vehicles ?? []} value={vehicleFilter} onChange={setVehicleFilter} includeAllOption />
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {!isLoading && filtered.length === 0 && <p className="text-sm text-muted-foreground">No records yet.</p>}

        <div className="flex flex-col gap-3">
          {filtered.map((record) => {
            const vehicle = vehicleById.get(record.vehicle_service_vehicle_id)
            const isDiy = record.vehicle_service_is_diy === '1'
            return (
              <div key={record.vehicle_service_id} className={`rounded-xl p-4 ${GLASS_CARD_CLASS}`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold">
                      {vehicle ? `${vehicle.vehicle_brand} ${vehicle.vehicle_model}` : 'Unknown vehicle'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {record.vehicle_service_date} - {isDiy ? 'DIY' : record.vehicle_service_provider || '-'} -{' '}
                      {record.vehicle_service_odometer} km
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-bold">
                      {record.vehicle_service_cost_amount} {record.vehicle_service_currency_code}
                    </span>
                    <Link to={`/service/${record.vehicle_service_id}`}>
                      <Button size="sm" variant="outline">
                        Edit
                      </Button>
                    </Link>
                    <Button size="sm" variant="outline" onClick={() => deleteMutation.mutate(record.vehicle_service_id)}>
                      Delete
                    </Button>
                  </div>
                </div>
                {record.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {record.tags.map((tag, i) => (
                      <span key={i} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {tag.vehicle_service_tag_code === 'custom'
                          ? tag.vehicle_service_tag_label
                          : (CATEGORY_LABEL.get(tag.vehicle_service_tag_code) ?? tag.vehicle_service_tag_code)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}
