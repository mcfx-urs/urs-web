// The in-memory-only access token, plus a tiny subscribe mechanism so
// React components can react to it changing without every caller needing
// to go through React context (api.ts uses this outside of any component,
// e.g. from a TanStack Query queryFn).
let accessToken: string | null = null
const listeners = new Set<(token: string | null) => void>()

export function getAccessToken() {
  return accessToken
}

export function setAccessToken(token: string | null) {
  accessToken = token
  for (const listener of listeners) listener(token)
}

export function subscribeAccessToken(listener: (token: string | null) => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
