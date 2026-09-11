import { useAuth } from '@/auth/AuthContext'
import { Button } from '@/components/ui/button'

// Minimal landing page shown after a successful login - reaching this
// page at all is the end-to-end smoke test (build -> deploy -> auth),
// nothing else to prove or show here.
export default function LandingPage() {
  const { logout } = useAuth()

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-medium">urs</h1>
      <p>Logged in ✓</p>
      <Button onClick={logout} variant="outline">
        Log out
      </Button>
    </main>
  )
}
