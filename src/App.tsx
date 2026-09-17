import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import AdminPage from '@/pages/AdminPage'
import BeerPage from '@/pages/BeerPage'
import ChoresPage from '@/pages/ChoresPage'
import InventoriesPage from '@/pages/InventoriesPage'
import InventoryDetailPage from '@/pages/InventoryDetailPage'
import KanbanBoardPage from '@/pages/KanbanBoardPage'
import KanbanBoardsPage from '@/pages/KanbanBoardsPage'
import LandingPage from '@/pages/LandingPage'
import LifeMapPage from '@/pages/LifeMapPage'
import LoginPage from '@/pages/LoginPage'
import NoteFormPage from '@/pages/NoteFormPage'
import NotesPage from '@/pages/NotesPage'
import SettingsPage from '@/pages/SettingsPage'
import ShoppingListDetailPage from '@/pages/ShoppingListDetailPage'
import ShoppingListsPage from '@/pages/ShoppingListsPage'
import VehicleFormPage from '@/pages/VehicleFormPage'
import VehiclesPage from '@/pages/VehiclesPage'
import TrackerTypeFormPage from '@/pages/TrackerTypeFormPage'
import WorkTimeEntryFormPage from '@/pages/WorkTimeEntryFormPage'
import WorkTimePage from '@/pages/WorkTimePage'
import WorkTimeSettingsPage from '@/pages/WorkTimeSettingsPage'

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
      <Route path="/chores" element={<ChoresPage />} />
      <Route path="/chores/types/new" element={<TrackerTypeFormPage />} />
      <Route path="/chores/types/:id" element={<TrackerTypeFormPage />} />
      <Route path="/inventory" element={<InventoriesPage />} />
      <Route path="/inventory/:id" element={<InventoryDetailPage />} />
      <Route path="/shopping" element={<ShoppingListsPage />} />
      <Route path="/shopping/:id" element={<ShoppingListDetailPage />} />
      <Route path="/kanban" element={<KanbanBoardsPage />} />
      <Route path="/kanban/:id" element={<KanbanBoardPage />} />
      <Route path="/life-map" element={<LifeMapPage />} />
      <Route path="/worktime" element={<WorkTimePage />} />
      <Route path="/worktime/settings" element={<WorkTimeSettingsPage />} />
      <Route path="/worktime/new" element={<WorkTimeEntryFormPage />} />
      <Route path="/worktime/:id" element={<WorkTimeEntryFormPage />} />
      <Route path="/beer" element={<BeerPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/vehicles" element={<VehiclesPage />} />
      <Route path="/vehicles/new" element={<VehicleFormPage />} />
      <Route path="/vehicles/:id" element={<VehicleFormPage />} />
      <Route path="/admin" element={isSuperUser ? <AdminPage /> : <Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
