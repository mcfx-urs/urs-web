import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import AdminPage from '@/pages/AdminPage'
import LandingPage from '@/pages/LandingPage'
import LoginPage from '@/pages/LoginPage'
import NoteFormPage from '@/pages/NoteFormPage'
import NotesPage from '@/pages/NotesPage'

function App() {
  const { isAuthenticated, isSuperUser, ready } = useAuth()

  if (!ready) return null

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/" element={<LandingPage />} />
      <Route path="/notes" element={<NotesPage />} />
      <Route path="/notes/new" element={<NoteFormPage />} />
      <Route path="/notes/:id" element={<NoteFormPage />} />
      <Route path="/admin" element={isSuperUser ? <AdminPage /> : <Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
