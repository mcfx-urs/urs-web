import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import TopBar from '@/components/TopBar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatDateISO } from '@/lib/date-utils'
import { fetchFuelTypes } from '@/lib/fuel-types'
import { createFuelPrice, distanceKm, fetchStations } from '@/lib/fuel'
import { getCurrentPosition } from '@/lib/geolocation'
import { GLASS_BACKGROUND_GRADIENT_CLASS } from '@/lib/glass-style'

export default function FuelPriceFormPage() {
  const navigate = useNavigate()
  const { data: stations } = useQuery({ queryKey: ['fuel-stations'], queryFn: fetchStations })
  const { data: fuelTypes } = useQuery({ queryKey: ['fuel-types'], queryFn: fetchFuelTypes })
  const [currentPosition, setCurrentPosition] = useState<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    getCurrentPosition()
      .then(setCurrentPosition)
      .catch(() => {})
  }, [])

  const sortedStations = useMemo(() => {
    const list = stations ?? []
    if (currentPosition) {
      return [...list].sort(
        (a, b) =>
          distanceKm(currentPosition.lat, currentPosition.lng, Number(a.filling_station_latitude), Number(a.filling_station_longitude)) -
          distanceKm(currentPosition.lat, currentPosition.lng, Number(b.filling_station_latitude), Number(b.filling_station_longitude)),
      )
    }
    return [...list].sort((a, b) => a.filling_station_name.localeCompare(b.filling_station_name))
  }, [stations, currentPosition])

  const [stationId, setStationId] = useState('')
  const [fuelTypeId, setFuelTypeId] = useState('')
  const [price, setPrice] = useState('')
  const [date, setDate] = useState(formatDateISO(new Date()))

  const isValid = Boolean(stationId && fuelTypeId && price && date)

  const mutation = useMutation({
    mutationFn: () => createFuelPrice({ date, price, fuel_type_id: fuelTypeId, station_id: stationId }),
    onSuccess: () => navigate('/fuel'),
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (isValid) mutation.mutate()
  }

  return (
    <div className={`min-h-svh bg-background ${GLASS_BACKGROUND_GRADIENT_CLASS}`}>
      <TopBar />
      <main className="mx-auto max-w-lg px-6 py-10">
        <h1 className="mb-6 text-base font-bold">Log fuel price</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="station">Station</Label>
            <select
              id="station"
              value={stationId}
              onChange={(e) => setStationId(e.target.value)}
              required
              className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
            >
              <option value="" disabled>
                Select a station
              </option>
              {sortedStations.map((s) => (
                <option key={s.filling_station_id} value={s.filling_station_id}>
                  {s.filling_station_name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="fuel-type">Fuel type</Label>
            <select
              id="fuel-type"
              value={fuelTypeId}
              onChange={(e) => setFuelTypeId(e.target.value)}
              required
              className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
            >
              <option value="" disabled>
                Select a fuel type
              </option>
              {fuelTypes?.map((f) => (
                <option key={f.fuel_id} value={f.fuel_id}>
                  {f.fuel_name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="price">Price / liter</Label>
            <Input id="price" type="number" step="0.001" value={price} onChange={(e) => setPrice(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={!isValid || mutation.isPending}>
              {mutation.isPending ? 'Saving...' : 'Save'}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate('/fuel')}>
              Cancel
            </Button>
          </div>
        </form>
      </main>
    </div>
  )
}
