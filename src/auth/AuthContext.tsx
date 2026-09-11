import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { refresh } from '@/lib/api'
import { getAccessToken, setAccessToken, subscribeAccessToken } from '@/lib/auth-token'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string

type AuthContextValue = {
  isAuthenticated: boolean
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
    <AuthContext.Provider value={{ isAuthenticated: token !== null, ready, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
