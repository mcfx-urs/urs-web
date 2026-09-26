import { Info } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { Button } from '@/components/ui/button'

export default function TopBar() {
  const { logout } = useAuth()

  return (
    <header className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
      <Link to="/" className="text-xl font-extrabold">
        urs
      </Link>
      <div className="flex items-center gap-4">
        <Link to="/about" aria-label="About" className="text-muted-foreground hover:text-foreground">
          <Info className="size-5" />
        </Link>
        <Button variant="outline" onClick={logout}>
          Log out
        </Button>
      </div>
    </header>
  )
}
