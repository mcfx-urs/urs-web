import { useState, type FormEvent } from 'react'
import TopBar from '@/components/TopBar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiFetch } from '@/lib/api'

type Status = { kind: 'idle' } | { kind: 'success'; message: string } | { kind: 'error'; message: string }

// Triggers urs-backend's POST /api/v1/admin/deploy (see urs-backend#1) -
// always redeploys THIS environment's own paired urs-web Deployment,
// there's no way to pick a different one.
export default function AdminPage() {
  const [tag, setTag] = useState('stg')
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setStatus({ kind: 'idle' })
    try {
      const res = await apiFetch('/api/v1/admin/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error ?? `deploy failed (${res.status})`)
      }
      setStatus({ kind: 'success', message: `Deploying ${data.image}` })
    } catch (err) {
      setStatus({ kind: 'error', message: (err as Error).message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-svh bg-background">
      <TopBar />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="mb-6 text-base font-bold">Admin</h1>
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Deploy</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="tag">Image tag</Label>
                <Input id="tag" value={tag} onChange={(e) => setTag(e.target.value)} required />
              </div>
              {status.kind === 'success' && <p className="text-sm">{status.message}</p>}
              {status.kind === 'error' && <p className="text-sm text-destructive">{status.message}</p>}
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Deploying...' : 'Deploy'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
