import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import TopBar from '@/components/TopBar'
import { fetchUserProfile, updateDefaultVehicle } from '@/lib/settings'
import { fetchVehicles } from '@/lib/vehicles'
import { GLASS_BACKGROUND_GRADIENT_CLASS, GLASS_CARD_CLASS } from '@/lib/glass-style'

const TILES = [
  { label: 'Fills', href: '/fuel/fills' },
  { label: 'Add fill', href: '/fuel/add' },
  { label: 'Stations', href: '/fuel/stations' },
  { label: 'Stats', href: '/fuel/stats' },
  { label: 'Log price', href: '/fuel/price' },
]

export default function FuelHubPage() {
  const queryClient = useQueryClient()
  const { data: vehicles } = useQuery({ queryKey: ['vehicles'], queryFn: fetchVehicles })
  const { data: profile } = useQuery({ queryKey: ['user-profile'], queryFn: fetchUserProfile })

  const setDefaultMutation = useMutation({
    mutationFn: (vehicleId: string) => updateDefaultVehicle(vehicleId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user-profile'] }),
  })

  return (
    <div className={`min-h-svh bg-background ${GLASS_BACKGROUND_GRADIENT_CLASS}`}>
      <TopBar />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="mb-6 text-base font-bold">Fuel</h1>

        {(vehicles ?? []).length > 0 && (
          <div className="mb-8 flex flex-wrap gap-2">
            {vehicles?.map((v) => (
              <button
                key={v.vehicle_id}
                onClick={() => setDefaultMutation.mutate(v.vehicle_id)}
                className={`rounded-full border px-3 py-1 text-xs ${
                  profile?.user_default_vehicle_id === v.vehicle_id
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-transparent text-foreground'
                }`}
              >
                {v.vehicle_brand} {v.vehicle_model}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {TILES.map((tile) => (
            <Link key={tile.href} to={tile.href} className={`rounded-xl p-4 text-center hover:border-primary ${GLASS_CARD_CLASS}`}>
              <span className="text-sm font-bold">{tile.label}</span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
