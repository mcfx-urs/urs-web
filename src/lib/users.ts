import { apiFetch } from './api'
import { getAccessToken } from './auth-token'
import { decodeAccessTokenClaims } from './jwt'

export type HouseholdUser = {
  user_id: string
  user_name: string
  user_firstname: string
  user_lastname: string
}

// household-users is the deliberately narrow, name-only projection for
// this picker use case - unlike getuser (see fetchWorkSettings), it never
// returns anyone's wage/tax fields to begin with.
export async function fetchHouseholdUsers(): Promise<HouseholdUser[]> {
  const res = await apiFetch('/api/v1/household-users')
  if (!res.ok) throw new Error(`load users failed (${res.status})`)
  const users: HouseholdUser[] = await res.json()
  return users.map((u) => ({
    user_id: u.user_id,
    user_name: u.user_name,
    user_firstname: u.user_firstname,
    user_lastname: u.user_lastname,
  }))
}

export function currentUserId(): string | null {
  const token = getAccessToken()
  if (!token) return null
  return decodeAccessTokenClaims(token)?.sub ?? null
}
