import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import AdminPage from '@/pages/AdminPage'
import BakingHistoryPage from '@/pages/BakingHistoryPage'
import BakingHubPage from '@/pages/BakingHubPage'
import BakingPlanDetailPage from '@/pages/BakingPlanDetailPage'
import BeerPage from '@/pages/BeerPage'
import ChoresPage from '@/pages/ChoresPage'
import FuelFillFormPage from '@/pages/FuelFillFormPage'
import FuelFillsPage from '@/pages/FuelFillsPage'
import FuelHubPage from '@/pages/FuelHubPage'
import FuelPriceFormPage from '@/pages/FuelPriceFormPage'
import FuelStationMapPage from '@/pages/FuelStationMapPage'
import FuelStationsPage from '@/pages/FuelStationsPage'
import FuelStatsPage from '@/pages/FuelStatsPage'
import InventoriesPage from '@/pages/InventoriesPage'
import InventoryDetailPage from '@/pages/InventoryDetailPage'
import JournalDayPage from '@/pages/JournalDayPage'
import JournalOverviewPage from '@/pages/JournalOverviewPage'
import JournalPage from '@/pages/JournalPage'
import KanbanBoardPage from '@/pages/KanbanBoardPage'
import KanbanBoardsPage from '@/pages/KanbanBoardsPage'
import LandingPage from '@/pages/LandingPage'
import LifeMapPage from '@/pages/LifeMapPage'
import LoginPage from '@/pages/LoginPage'
import NoteFormPage from '@/pages/NoteFormPage'
import NotesPage from '@/pages/NotesPage'
import SettingsPage from '@/pages/SettingsPage'
import ServiceFormPage from '@/pages/ServiceFormPage'
import ServicePage from '@/pages/ServicePage'
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
      <Route path="/journal" element={<JournalPage />} />
      <Route path="/journal/overview" element={<JournalOverviewPage />} />
      <Route path="/journal/day/:date" element={<JournalDayPage />} />
      <Route path="/journal/types/new" element={<TrackerTypeFormPage />} />
      <Route path="/journal/types/:id" element={<TrackerTypeFormPage />} />
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
      <Route path="/fuel" element={<FuelHubPage />} />
      <Route path="/fuel/fills" element={<FuelFillsPage />} />
      <Route path="/fuel/add" element={<FuelFillFormPage />} />
      <Route path="/fuel/add/:id" element={<FuelFillFormPage />} />
      <Route path="/fuel/stations" element={<FuelStationsPage />} />
      <Route path="/fuel/stations/map" element={<FuelStationMapPage />} />
      <Route path="/fuel/stats" element={<FuelStatsPage />} />
      <Route path="/fuel/price" element={<FuelPriceFormPage />} />
      <Route path="/baking" element={<BakingHubPage />} />
      <Route path="/baking/history" element={<BakingHistoryPage />} />
      <Route path="/baking/:id" element={<BakingPlanDetailPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/vehicles" element={<VehiclesPage />} />
      <Route path="/vehicles/new" element={<VehicleFormPage />} />
      <Route path="/vehicles/:id" element={<VehicleFormPage />} />
      <Route path="/service" element={<ServicePage />} />
      <Route path="/service/new" element={<ServiceFormPage />} />
      <Route path="/service/:id" element={<ServiceFormPage />} />
      <Route path="/admin" element={isSuperUser ? <AdminPage /> : <Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
