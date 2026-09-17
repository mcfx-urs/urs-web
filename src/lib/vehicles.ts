import { apiFetch } from './api'

// Mirrors urs-android's VehicleDto - every field but id/fuelId/brand/model/
// year is optional free text on the backend, defaulting to "". Read-only
// here (Settings' default-vehicle picker only needs the list); create/
// update/delete are added in urs-web#27's own commit.
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
