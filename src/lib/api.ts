import { getAccessToken, setAccessToken } from './auth-token'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string

// refresh relies entirely on the httpOnly refresh-token cookie the
// backend sets on login (see urs-backend's writeTokenResponse) - no body,
// credentials: 'include' so the cookie is actually sent cross-origin.
export async function refresh(): Promise<boolean> {
  const res = await fetch(`${API_BASE_URL}/api/v1/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
  if (!res.ok) {
    setAccessToken(null)
    return false
  }
  const data = await res.json()
  setAccessToken(data.access_token)
  return true
}

// apiFetch attaches the in-memory access token and retries once via
// refresh() on a 401 - mirrors urs-android's AuthInterceptor/
// AuthAuthenticator pattern.
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const doFetch = () => {
    const headers = new Headers(options.headers)
    const token = getAccessToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return fetch(`${API_BASE_URL}${path}`, { ...options, headers, credentials: 'include' })
  }

  let res = await doFetch()
  if (res.status === 401 && (await refresh())) {
    res = await doFetch()
  }
  return res
}
