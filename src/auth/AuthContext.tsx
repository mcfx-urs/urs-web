import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { refresh } from '@/lib/api'
import { getAccessToken, setAccessToken, subscribeAccessToken } from '@/lib/auth-token'
import { decodeAccessTokenClaims } from '@/lib/jwt'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string

type AuthContextValue = {
  isAuthenticated: boolean
  // UI-only gate (hide/show the admin page) - the real boundary is
  // server-side (requireSuperUser), this just avoids showing controls a
  // non-super-user can't use anyway.
  isSuperUser: boolean
  // true once the initial silent-refresh attempt (restoring a session
  // from the httpOnly cookie on page load) has finished either way.
  ready: boolean
  login: (userName: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(getAccessToken())
  const [ready, setReady] = useState(false)

  useEffect(() => subscribeAccessToken(setToken), [])

  useEffect(() => {
    refresh().finally(() => setReady(true))
  }, [])

  // Proactive refresh (GitHub issue #18) - previously only refreshed once
  // on mount and reactively after a request already got a 401. Reruns
  // whenever `token` changes, including right after refresh() itself sets
  // a new one, so this keeps rescheduling itself for as long as the
  // session stays alive. The setTimeout alone isn't enough on its own -
  // background tabs get throttled/suspended by the browser, so a timer set
  // for 30s before expiry can fire minutes late (or not at all before the
  // tab regains focus) - the visibilitychange listener is the backstop for
  // exactly that case, refreshing immediately on return to the tab if the
  // token turned out to already be at or past its buffer.
  useEffect(() => {
    if (!token) return
    const claims = decodeAccessTokenClaims(token)
    if (!claims) return

    const REFRESH_BUFFER_MS = 30_000
    const expiresAtMs = claims.exp * 1000
    const timer = setTimeout(() => {
      refresh()
    }, Math.max(expiresAtMs - Date.now() - REFRESH_BUFFER_MS, 0))

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible' && expiresAtMs - Date.now() <= REFRESH_BUFFER_MS) {
        refresh()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [token])

  const isSuperUser = useMemo(() => (token ? (decodeAccessTokenClaims(token)?.is_super_user ?? false) : false), [token])

  async function login(userName: string, password: string) {
    const res = await fetch(`${API_BASE_URL}/api/v1/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_name: userName, password }),
    })
    if (!res.ok) {
      throw new Error('invalid credentials')
    }
    const data = await res.json()
    setAccessToken(data.access_token)
  }

  function logout() {
    setAccessToken(null)
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated: token !== null, isSuperUser, ready, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
