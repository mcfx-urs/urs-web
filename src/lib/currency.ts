import { apiFetch } from './api'

// Shared by Vehicle Service's cost field (urs-web#25) and Fuel's fill/price
// forms (urs-web#21).
export type Currency = {
  currency_code: string
  currency_name: string
}

export async function fetchCurrencies(): Promise<Currency[]> {
  const res = await apiFetch('/api/v1/currency')
  if (!res.ok) throw new Error(`load currencies failed (${res.status})`)
  return res.json()
}
