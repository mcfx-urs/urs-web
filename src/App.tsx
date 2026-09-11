import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import LandingPage from '@/pages/LandingPage'
import LoginPage from '@/pages/LoginPage'

function App() {
  const { isAuthenticated, ready } = useAuth()

  if (!ready) return null

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/" element={isAuthenticated ? <LandingPage /> : <Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App
