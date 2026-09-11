import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import AdminPage from '@/pages/AdminPage'
import LandingPage from '@/pages/LandingPage'
import LoginPage from '@/pages/LoginPage'

function App() {
  const { isAuthenticated, isSuperUser, ready } = useAuth()

  if (!ready) return null

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/" element={isAuthenticated ? <LandingPage /> : <Navigate to="/login" replace />} />
      <Route
        path="/admin"
        element={isAuthenticated && isSuperUser ? <AdminPage /> : <Navigate to="/" replace />}
      />
    </Routes>
  )
}

export default App
