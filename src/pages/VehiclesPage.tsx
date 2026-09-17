import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import TopBar from '@/components/TopBar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { GLASS_BACKGROUND_GRADIENT_CLASS, GLASS_CARD_CLASS } from '@/lib/glass-style'
import { daysUntilNextMfk } from '@/lib/vehicle-mfk'
import { deleteVehicle, fetchVehicles, VehicleHasEntriesError, type Vehicle } from '@/lib/vehicles'

export default function VehiclesPage() {
  const queryClient = useQueryClient()
  const [pendingDelete, setPendingDelete] = useState<Vehicle | null>(null)

  const { data: vehicles, isLoading } = useQuery({ queryKey: ['vehicles'], queryFn: fetchVehicles })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteVehicle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
      setPendingDelete(null)
    },
  })

  const hasEntriesError = deleteMutation.error instanceof VehicleHasEntriesError

  return (
    <div className={`min-h-svh bg-background ${GLASS_BACKGROUND_GRADIENT_CLASS}`}>
      <TopBar />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-base font-bold">Vehicles</h1>
          <Link to="/vehicles/new">
            <Button>Add vehicle</Button>
          </Link>
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {!isLoading && (vehicles ?? []).length === 0 && <p className="text-sm text-muted-foreground">No vehicles yet.</p>}

        <div className="flex flex-col gap-3">
          {vehicles?.map((vehicle) => {
            const days = daysUntilNextMfk(vehicle.vehicle_last_mfk_date)
            return (
              <div key={vehicle.vehicle_id} className={`flex items-center justify-between gap-3 rounded-xl p-4 ${GLASS_CARD_CLASS}`}>
                <div>
                  <div className="text-sm font-bold">
                    {vehicle.vehicle_brand} {vehicle.vehicle_model}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{vehicle.vehicle_year}</span>
                    {days !== null && (
                      <span className={days < 0 ? 'text-destructive' : undefined}>
                        {days < 0 ? `MFK overdue by ${-days}d` : `MFK due in ${days}d`}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Link to={`/vehicles/${vehicle.vehicle_id}`}>
                    <Button size="sm" variant="outline">
                      Edit
                    </Button>
                  </Link>
                  <Button size="sm" variant="outline" onClick={() => setPendingDelete(vehicle)}>
                    Delete
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </main>

      <Dialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete vehicle?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {pendingDelete?.vehicle_brand} {pendingDelete?.vehicle_model} will be permanently removed.
          </p>
          {hasEntriesError && (
            <p className="text-sm text-destructive">
              This vehicle still has fuel or service entries and can't be deleted.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => pendingDelete && deleteMutation.mutate(pendingDelete.vehicle_id)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
