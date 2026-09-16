import { useEffect, useState } from 'react'
import { subscribeErrorToast } from '@/lib/error-toast'

/**
 * Mounted once at the app root (main.tsx) - surfaces any query/mutation
 * failure globally (GitHub issue #18), since most of the app has no
 * per-request error handling of its own.
 */
export default function ErrorToast() {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => subscribeErrorToast(setMessage), [])

  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(null), 4000)
    return () => clearTimeout(timer)
  }, [message])

  if (!message) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center">
      <div className="rounded-full bg-destructive px-4 py-2 text-sm text-destructive-foreground shadow-lg">{message}</div>
    </div>
  )
}
