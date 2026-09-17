import { apiFetch } from './api'

// Mirrors urs-android's VehicleDto - every field but id/fuelId/brand/model/
// year is optional free text on the backend, defaulting to "".
export type Vehicle = {
  vehicle_id: string
  vehicle_fuel_id: string
  fuel_name: string
  vehicle_brand: string
  vehicle_model: string
  vehicle_year: string
  vehicle_engine_code: string
  vehicle_type: string
  vehicle_color: string
  vehicle_vin: string
  vehicle_registration_number: string
  vehicle_type_approval_number: string
  vehicle_displacement_ccm: string
  vehicle_power_kw: string
  vehicle_power_ps: string
  vehicle_weight_kg: string
  vehicle_first_registration_date: string
  vehicle_last_mfk_date: string
}

// Scoped server-side to the caller's own vehicles.
export async function fetchVehicles(): Promise<Vehicle[]> {
  const res = await apiFetch('/api/v1/vehicle')
  if (!res.ok) throw new Error(`load vehicles failed (${res.status})`)
  return res.json()
}

export type VehicleInput = Omit<Vehicle, 'vehicle_id' | 'fuel_name'>

export async function createVehicle(input: VehicleInput): Promise<Vehicle> {
  const res = await apiFetch('/api/v1/vehicle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(`create vehicle failed (${res.status})`)
  return res.json()
}

export async function updateVehicle(id: string, input: VehicleInput): Promise<Vehicle> {
  const res = await apiFetch(`/api/v1/vehicle/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(`update vehicle failed (${res.status})`)
  return res.json()
}

export class VehicleHasEntriesError extends Error {}

// A 409 means the vehicle still has fuel/service entries - surfaced as a
// specific error type so the delete-confirm dialog can show a dedicated
// message instead of the generic ErrorToast text.
export async function deleteVehicle(id: string): Promise<void> {
  const res = await apiFetch(`/api/v1/vehicle/${id}`, { method: 'DELETE' })
  if (res.status === 409) throw new VehicleHasEntriesError('vehicle still has fuel or service entries')
  if (!res.ok) throw new Error(`delete vehicle failed (${res.status})`)
}
