import { apiFetch } from './api'

export type ServiceTag = {
  vehicle_service_tag_code: string
  vehicle_service_tag_label: string
}

// Mirrors urs-android's ServiceCategory enum exactly, in the same order.
export const SERVICE_CATEGORIES = [
  { code: 'oil_change', label: 'Oil Change' },
  { code: 'tires', label: 'Tires' },
  { code: 'brakes', label: 'Brakes' },
  { code: 'inspection', label: 'Inspection' },
  { code: 'battery', label: 'Battery' },
  { code: 'bodywork', label: 'Bodywork' },
  { code: 'filters', label: 'Filters' },
  { code: 'other', label: 'Other' },
]
export const CUSTOM_TAG_CODE = 'custom'

export type VehicleServiceRecord = {
  vehicle_service_id: string
  vehicle_service_vehicle_id: string
  vehicle_service_date: string
  vehicle_service_odometer: string
  vehicle_service_provider: string
  vehicle_service_is_diy: string
  vehicle_service_notes: string
  vehicle_service_cost_amount: string
  vehicle_service_currency_code: string
  vehicle_service_cost_amount_chf: string
  vehicle_service_cost_amount_chf_locked: string
  tags: ServiceTag[]
}

export type VehicleServiceInput = Omit<
  VehicleServiceRecord,
  'vehicle_service_id' | 'vehicle_service_cost_amount_chf' | 'vehicle_service_cost_amount_chf_locked'
>

// Fetches all of the caller's records; filtered by vehicle client-side,
// matching urs-android's own approach (no server-side vehicle filter param).
export async function fetchVehicleServiceRecords(): Promise<VehicleServiceRecord[]> {
  const res = await apiFetch('/api/v1/vehicle-service')
  if (!res.ok) throw new Error(`load service records failed (${res.status})`)
  return res.json()
}

export async function createVehicleServiceRecord(input: VehicleServiceInput): Promise<VehicleServiceRecord> {
  const res = await apiFetch('/api/v1/vehicle-service', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(`create service record failed (${res.status})`)
  return res.json()
}

export async function updateVehicleServiceRecord(id: string, input: VehicleServiceInput): Promise<VehicleServiceRecord> {
  const res = await apiFetch(`/api/v1/vehicle-service/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(`update service record failed (${res.status})`)
  return res.json()
}

export async function deleteVehicleServiceRecord(id: string): Promise<void> {
  const res = await apiFetch(`/api/v1/vehicle-service/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`delete service record failed (${res.status})`)
}
