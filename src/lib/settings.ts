import { apiFetch } from './api'
import { currentUserId } from './users'

export type UserProfile = {
  user_firstname: string
  user_lastname: string
  user_birthday: string
  user_height: string
  user_default_vehicle_id: string
}

// getuser is scoped server-side to the caller's own row - same endpoint
// worktime.ts's fetchWorkSettings() already calls with its own narrower
// projection; each lib file reads only the fields it needs, matching this
// codebase's existing convention rather than sharing one combined type.
export async function fetchUserProfile(): Promise<UserProfile> {
  const res = await apiFetch('/api/v1/getuser')
  if (!res.ok) throw new Error(`load profile failed (${res.status})`)
  const me: Record<string, string> = await res.json()
  return {
    user_firstname: me.user_firstname ?? '',
    user_lastname: me.user_lastname ?? '',
    user_birthday: me.user_birthday ?? '',
    user_height: me.user_height ?? '',
    user_default_vehicle_id: me.user_default_vehicle_id ?? '',
  }
}

export type ProfileFields = Omit<UserProfile, 'user_default_vehicle_id'>

export async function updateUserProfile(profile: ProfileFields): Promise<void> {
  const userId = currentUserId()
  if (!userId) return
  const res = await apiFetch(`/api/v1/user/${userId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  })
  if (!res.ok) throw new Error(`save profile failed (${res.status})`)
}

export class WrongCurrentPasswordError extends Error {}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const res = await apiFetch('/api/v1/change-password', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  })
  if (res.status === 401) throw new WrongCurrentPasswordError('current password is incorrect')
  if (!res.ok) throw new Error(`change password failed (${res.status})`)
}

// Empty vehicleId clears the default.
export async function updateDefaultVehicle(vehicleId: string): Promise<void> {
  const res = await apiFetch('/api/v1/user/default-vehicle', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_default_vehicle_id: vehicleId }),
  })
  if (!res.ok) throw new Error(`save default vehicle failed (${res.status})`)
}
