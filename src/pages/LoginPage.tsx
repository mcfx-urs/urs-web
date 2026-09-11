import { useState, type FormEvent } from 'react'
import { useAuth } from '@/auth/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const { login } = useAuth()
  const [userName, setUserName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(userName, password)
    } catch {
      setError('Invalid credentials')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-6">
      <div className="flex w-full max-w-3xl overflow-hidden rounded-xl border border-border shadow-lg">
        <div className="hidden flex-1 flex-col items-center justify-center gap-4 bg-primary p-10 text-primary-foreground sm:flex">
          <img src="/bear-logo.png" alt="" width={96} height={96} className="rounded-lg" />
          <span className="text-3xl font-extrabold">urs</span>
        </div>
        <div className="flex flex-1 flex-col justify-center gap-4 bg-card p-10">
          <h1 className="text-base font-bold">Log in</h1>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="user_name">Username</Label>
              <Input
                id="user_name"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Logging in...' : 'Log in'}
            </Button>
          </form>
        </div>
      </div>
    </main>
  )
}
