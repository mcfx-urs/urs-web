import { useState, type FormEvent } from 'react'
import TopBar from '@/components/TopBar'
import { useAuth } from '@/auth/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiFetch } from '@/lib/api'
import { parseChangelog } from '@/lib/changelog'
import { GLASS_BACKGROUND_GRADIENT_CLASS, GLASS_CARD_CLASS } from '@/lib/glass-style'
import changelogMarkdown from '../../CHANGELOG.md?raw'

type Status = { kind: 'idle' } | { kind: 'success'; message: string } | { kind: 'error'; message: string }

const changelogBlocks = parseChangelog(changelogMarkdown)

export default function AboutPage() {
  const { isSuperUser } = useAuth()
  const [tag, setTag] = useState('stg')
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [submitting, setSubmitting] = useState(false)

  // Triggers urs-backend's POST /api/v1/admin/deploy (see urs-backend#1) -
  // always redeploys THIS environment's own paired urs-web Deployment,
  // there's no way to pick a different one.
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
    <div className={`min-h-svh bg-background ${GLASS_BACKGROUND_GRADIENT_CLASS}`}>
      <TopBar />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="mb-1 text-base font-bold">About</h1>
        <p className="mb-6 text-sm text-muted-foreground">Version {__APP_VERSION__}</p>

        {isSuperUser && (
          <Card className={`mb-8 w-full ring-0 ${GLASS_CARD_CLASS}`}>
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
        )}

        <Card className={`w-full ring-0 ${GLASS_CARD_CLASS}`}>
          <CardHeader>
            <CardTitle>Changelog</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {changelogBlocks.map((block, i) => {
              if (block.type === 'header') {
                if (block.level === 1) return null
                const HeadingTag = block.level === 2 ? 'h3' : 'h4'
                return (
                  <HeadingTag key={i} className={block.level === 2 ? 'mt-3 text-sm font-bold' : 'mt-2 text-sm font-semibold'}>
                    {block.text}
                  </HeadingTag>
                )
              }
              if (block.type === 'bullet') {
                return (
                  <p key={i} className="text-sm">
                    • {block.text}
                  </p>
                )
              }
              return (
                <p key={i} className="text-sm text-muted-foreground">
                  {block.text}
                </p>
              )
            })}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
