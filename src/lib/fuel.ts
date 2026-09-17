import { apiFetch } from './api'

export type Fill = {
  fill_id: string
  fill_date: string
  fill_vehicle_id: string
  fill_station_id: string
  fill_fuel_id: string
  fill_price: string
  fill_amount: string
  fill_odometer: string
  fill_is_full_tank: string
  fill_currency_code: string
  driven: string
  filling_station_counter: string
  station_latitude: string
  station_longitude: string
}

export type FillCreateInput = Omit<Fill, 'fill_id'>
export type FillUpdateInput = Omit<Fill, 'fill_id' | 'driven' | 'filling_station_counter' | 'station_latitude' | 'station_longitude'>

// Already scoped to the caller's own vehicles; sorted client-side (not
// confirmed server-sorted) to match urs-android's own repository-layer sort.
export async function fetchFills(): Promise<Fill[]> {
  const res = await apiFetch('/api/v1/fill')
  if (!res.ok) throw new Error(`load fills failed (${res.status})`)
  const fills: Fill[] = await res.json()
  return fills.sort((a, b) => b.fill_date.localeCompare(a.fill_date))
}

export async function createFill(input: FillCreateInput): Promise<Fill> {
  const res = await apiFetch('/api/v1/fill', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(`create fill failed (${res.status})`)
  return res.json()
}

export async function updateFill(id: string, input: FillUpdateInput): Promise<void> {
  const res = await apiFetch(`/api/v1/fill/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(`update fill failed (${res.status})`)
}

export async function deleteFill(id: string): Promise<void> {
  const res = await apiFetch(`/api/v1/fill/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`delete fill failed (${res.status})`)
}

export type OdometerEntry = {
  id: string
  date: string
  mileage: string
  vehicle_id: string
  driven: string
}

export async function fetchOdometerEntries(vehicleId: string): Promise<OdometerEntry[]> {
  const res = await apiFetch(`/api/v1/odometer/${vehicleId}`)
  if (!res.ok) throw new Error(`load odometer failed (${res.status})`)
  return res.json()
}

export function lastOdometer(entries: OdometerEntry[]): number | null {
  const values = entries.map((e) => Number(e.mileage)).filter((n) => Number.isFinite(n))
  return values.length > 0 ? Math.max(...values) : null
}

export type FillingStation = {
  filling_station_id: string
  filling_station_name: string
  filling_station_counter: string
  filling_station_address: string
  filling_station_latitude: string
  filling_station_longitude: string
}

export type FillingStationInput = Omit<FillingStation, 'filling_station_id' | 'filling_station_counter'>

// Known/reviewed stations only - gps_auto ad-hoc stations awaiting review
// live only in fetchPendingStations(), never mixed into this list.
export async function fetchStations(): Promise<FillingStation[]> {
  const res = await apiFetch('/api/v1/get-filling-station')
  if (!res.ok) throw new Error(`load stations failed (${res.status})`)
  return res.json()
}

// Super-user only; backend rejects otherwise.
export async function fetchPendingStations(): Promise<FillingStation[]> {
  const res = await apiFetch('/api/v1/admin/filling-station/pending')
  if (!res.ok) throw new Error(`load pending stations failed (${res.status})`)
  return res.json()
}

export async function createStation(input: FillingStationInput): Promise<FillingStation> {
  const res = await apiFetch('/api/v1/filling-station', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(`create station failed (${res.status})`)
  return res.json()
}

// Super-user only; backend rejects (403) otherwise.
export async function updateStation(id: string, input: FillingStationInput): Promise<void> {
  const res = await apiFetch(`/api/v1/filling-station/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(`update station failed (${res.status})`)
}

export async function geocode(address: string): Promise<{ latitude: number; longitude: number } | null> {
  const res = await apiFetch(`/api/v1/geocode?address=${encodeURIComponent(address)}`)
  if (!res.ok) return null
  return res.json()
}

export type FuelPrice = {
  id: string
  date: string
  price: string
  fuel_type_id: string
  station_id: string
}

export async function createFuelPrice(input: Omit<FuelPrice, 'id'>): Promise<FuelPrice> {
  const res = await apiFetch('/api/v1/fuel-price', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(`log fuel price failed (${res.status})`)
  return res.json()
}

export async function fetchFuelPrices(fuelId: string): Promise<FuelPrice[]> {
  const res = await apiFetch(`/api/v1/fuel-price/${fuelId}`)
  if (!res.ok) throw new Error(`load fuel prices failed (${res.status})`)
  return res.json()
}

// Great-circle distance in km - used to proximity-sort the station picker.
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
