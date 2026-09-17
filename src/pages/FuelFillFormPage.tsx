import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import TopBar from '@/components/TopBar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import VehiclePicker from '@/components/VehiclePicker'
import { fetchCurrencies } from '@/lib/currency'
import { formatDateTimeLocal } from '@/lib/date-utils'
import {
  createFill,
  distanceKm,
  fetchFills,
  fetchOdometerEntries,
  fetchStations,
  lastOdometer,
  updateFill,
  type Fill,
  type FillingStation,
} from '@/lib/fuel'
import { getCurrentPosition } from '@/lib/geolocation'
import { GLASS_BACKGROUND_GRADIENT_CLASS } from '@/lib/glass-style'
import { fetchVehicles, type Vehicle } from '@/lib/vehicles'

export default function FuelFillFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEditing = Boolean(id)

  const { data: fills, isLoading } = useQuery({ queryKey: ['fills'], queryFn: fetchFills, enabled: isEditing })
  const { data: vehicles } = useQuery({ queryKey: ['vehicles'], queryFn: fetchVehicles })
  const { data: stations } = useQuery({ queryKey: ['fuel-stations'], queryFn: fetchStations })
  const { data: currencies } = useQuery({ queryKey: ['currencies'], queryFn: fetchCurrencies })
  const existing = isEditing ? fills?.find((f) => f.fill_id === id) : undefined

  if (isEditing && isLoading) {
    return (
      <div className={`min-h-svh bg-background ${GLASS_BACKGROUND_GRADIENT_CLASS}`}>
        <TopBar />
        <main className="mx-auto max-w-lg px-6 py-10">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </main>
      </div>
    )
  }
  if (isEditing && !existing) {
    return (
      <div className={`min-h-svh bg-background ${GLASS_BACKGROUND_GRADIENT_CLASS}`}>
        <TopBar />
        <main className="mx-auto max-w-lg px-6 py-10">
          <p className="text-sm text-muted-foreground">Fill not found.</p>
        </main>
      </div>
    )
  }

  return (
    <FillForm
      key={existing?.fill_id ?? 'new'}
      existing={existing}
      vehicles={vehicles ?? []}
      stations={stations ?? []}
      currencies={currencies ?? []}
    />
  )
}

function FillForm({
  existing,
  vehicles,
  stations,
  currencies,
}: {
  existing?: Fill
  vehicles: Vehicle[]
  stations: FillingStation[]
  currencies: { currency_code: string; currency_name: string }[]
}) {
  const isEditing = Boolean(existing)
  // Editing a fill that already has a server id locks the GPS toggle -
  // station must already exist, matches urs-android exactly.
  const gpsToggleAvailable = !isEditing

  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [vehicleId, setVehicleId] = useState(existing?.fill_vehicle_id ?? vehicles[0]?.vehicle_id ?? '')
  const [useGps, setUseGps] = useState(false)
  const [gpsPosition, setGpsPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [capturing, setCapturing] = useState(false)
  const [stationId, setStationId] = useState(existing?.fill_station_id ?? '')
  const [currentPosition, setCurrentPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [odometer, setOdometer] = useState(existing?.fill_odometer ?? '')
  const [pricePerLiter, setPricePerLiter] = useState(existing?.fill_price ?? '')
  const [liters, setLiters] = useState(existing?.fill_amount ?? '')
  const [isFullTank, setIsFullTank] = useState(existing ? existing.fill_is_full_tank === '1' : true)
  const [currencyCode, setCurrencyCode] = useState(existing?.fill_currency_code || 'CHF')
  const [date, setDate] = useState(existing?.fill_date.slice(0, 10) ?? new Date().toISOString().slice(0, 10))

  const { data: odometerEntries } = useQuery({
    queryKey: ['odometer', vehicleId],
    queryFn: () => fetchOdometerEntries(vehicleId),
    enabled: Boolean(vehicleId),
  })
  const lastKnownOdometer = lastOdometer(odometerEntries ?? [])

  // Fetch current position once (best-effort) to proximity-sort the station
  // picker; falls back to alphabetical if unavailable/denied.
  useEffect(() => {
    getCurrentPosition()
      .then(setCurrentPosition)
      .catch(() => {})
  }, [])

  const sortedStations = useMemo(() => {
    if (currentPosition) {
      return [...stations].sort(
        (a, b) =>
          distanceKm(currentPosition.lat, currentPosition.lng, Number(a.filling_station_latitude), Number(a.filling_station_longitude)) -
          distanceKm(currentPosition.lat, currentPosition.lng, Number(b.filling_station_latitude), Number(b.filling_station_longitude)),
      )
    }
    return [...stations].sort((a, b) => a.filling_station_name.localeCompare(b.filling_station_name))
  }, [stations, currentPosition])

  async function captureLocation() {
    setCapturing(true)
    setGpsError(null)
    try {
      setGpsPosition(await getCurrentPosition())
    } catch (err) {
      setGpsError(err instanceof Error ? err.message : 'Could not get location.')
    } finally {
      setCapturing(false)
    }
  }

  const totalCost = pricePerLiter && liters ? Number(pricePerLiter) * Number(liters) : null

  const isValid = Boolean(
    vehicleId &&
      odometer &&
      pricePerLiter &&
      liters &&
      date &&
      (useGps ? gpsPosition !== null : stationId),
  )

  const mutation = useMutation({
    mutationFn: () => {
      const fillDate = formatDateTimeLocal(new Date(`${date}T00:00:00`))
      if (isEditing && existing) {
        return updateFill(existing.fill_id, {
          fill_date: fillDate,
          fill_vehicle_id: vehicleId,
          fill_station_id: stationId,
          fill_fuel_id: existing.fill_fuel_id,
          fill_price: pricePerLiter,
          fill_amount: liters,
          fill_odometer: odometer,
          fill_currency_code: currencyCode,
          fill_is_full_tank: isFullTank ? '1' : '0',
        })
      }
      const vehicle = vehicles.find((v) => v.vehicle_id === vehicleId)
      const driven = lastKnownOdometer !== null ? Number(odometer) - lastKnownOdometer : 0
      return createFill({
        fill_date: fillDate,
        fill_vehicle_id: vehicleId,
        fill_station_id: useGps ? '' : stationId,
        fill_fuel_id: vehicle?.vehicle_fuel_id ?? '',
        fill_price: pricePerLiter,
        fill_amount: liters,
        fill_odometer: odometer,
        fill_is_full_tank: isFullTank ? '1' : '0',
        fill_currency_code: currencyCode,
        driven: String(driven),
        filling_station_counter: '0',
        station_latitude: useGps && gpsPosition ? String(gpsPosition.lat) : '',
        station_longitude: useGps && gpsPosition ? String(gpsPosition.lng) : '',
      }).then(() => undefined)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fills'] })
      navigate('/fuel/fills')
    },
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (isValid) mutation.mutate()
  }

  return (
    <div className={`min-h-svh bg-background ${GLASS_BACKGROUND_GRADIENT_CLASS}`}>
      <TopBar />
      <main className="mx-auto max-w-lg px-6 py-10">
        <h1 className="mb-6 text-base font-bold">{isEditing ? 'Edit fill' : 'New fill'}</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="vehicle">Vehicle</Label>
            <VehiclePicker id="vehicle" vehicles={vehicles} value={vehicleId} onChange={setVehicleId} />
          </div>

          {gpsToggleAvailable && (
            <label className="flex items-center justify-between gap-2">
              <span className="text-sm">No station / use GPS</span>
              <input type="checkbox" checked={useGps} onChange={(e) => setUseGps(e.target.checked)} className="size-4 accent-primary" />
            </label>
          )}

          {gpsToggleAvailable && useGps ? (
            <div className="flex flex-col gap-2">
              {gpsPosition ? (
                <p className="text-sm text-muted-foreground">
                  Location captured: {gpsPosition.lat.toFixed(5)}, {gpsPosition.lng.toFixed(5)}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Location not yet captured.</p>
              )}
              {gpsError && <p className="text-sm text-destructive">{gpsError}</p>}
              <Button type="button" variant="outline" disabled={capturing} onClick={captureLocation}>
                {capturing ? 'Capturing...' : 'Capture location'}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Label htmlFor="station">Station</Label>
              <select
                id="station"
                value={stationId}
                onChange={(e) => setStationId(e.target.value)}
                disabled={isEditing}
                className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm disabled:opacity-50"
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
              {isEditing && <p className="text-xs text-muted-foreground">Station is locked once a fill is saved.</p>}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="odometer">Odometer (km)</Label>
            <Input id="odometer" type="number" value={odometer} onChange={(e) => setOdometer(e.target.value)} required />
            {lastKnownOdometer !== null && <p className="text-xs text-muted-foreground">Last: {lastKnownOdometer} km</p>}
          </div>

          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="price">Price / liter</Label>
              <Input id="price" type="number" step="0.001" value={pricePerLiter} onChange={(e) => setPricePerLiter(e.target.value)} required />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="liters">Liters</Label>
              <Input id="liters" type="number" step="0.01" value={liters} onChange={(e) => setLiters(e.target.value)} required />
            </div>
          </div>

          <label className="flex items-center justify-between gap-2">
            <span className="text-sm">Full tank</span>
            <input type="checkbox" checked={isFullTank} onChange={(e) => setIsFullTank(e.target.checked)} className="size-4 accent-primary" />
          </label>

          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="currency">Currency</Label>
              <select
                id="currency"
                value={currencyCode}
                onChange={(e) => setCurrencyCode(e.target.value)}
                className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
              >
                {currencies.length === 0 && <option value="CHF">CHF</option>}
                {currencies.map((c) => (
                  <option key={c.currency_code} value={c.currency_code}>
                    {c.currency_code}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
          </div>

          {totalCost !== null && <p className="text-sm">Total: {totalCost.toFixed(2)}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={!isValid || mutation.isPending}>
              {mutation.isPending ? 'Saving...' : 'Save'}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate('/fuel/fills')}>
              Cancel
            </Button>
          </div>
        </form>
      </main>
    </div>
  )
}
