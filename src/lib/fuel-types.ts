import { apiFetch } from './api'

// Shared by the Vehicle form's fuel-type picker (urs-web#27) and Fuel's own
// price-log form (urs-web#21) - kept in its own small file rather than
// bundled into either ticket's larger lib file.
export type Fuel = {
  fuel_id: string
  fuel_name: string
}

export async function fetchFuelTypes(): Promise<Fuel[]> {
  const res = await apiFetch('/api/v1/get-fuel')
  if (!res.ok) throw new Error(`load fuel types failed (${res.status})`)
  return res.json()
}
