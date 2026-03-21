import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './lib/theme'
import { AuthProvider, useAuth } from './lib/auth'
import Sidebar from './components/layout/Sidebar'
import Dashboard from './pages/Dashboard'
import ClientsPage from './pages/Clients'
import ClientDetail from './pages/ClientDetail'
import ProjectsPage from './pages/Projects'
import ProjectDetailPage from './pages/ProjectDetail'
import LoginPage from './pages/Login'
import CalendarPage from './pages/Calendar'
import TasksPage from './pages/Tasks'
import ProofsPage from './pages/Proofs'
import Items from './pages/Items'
import ProductsPage from './pages/Products'
import { CampaignsPage, TimeboardPage, BillingPage } from './pages/Placeholders'
import './styles.css'

function AppShell() {
  const { user, loading } = useAuth()

  // Don't render layout until we know auth state
  if (loading) return null

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route path="/"           element={<Dashboard />} />
          <Route path="/clients"    element={<ClientsPage />} />
          <Route path="/clients/:id" element={<ClientDetail />} />
          <Route path="/projects"      element={<ProjectsPage />} />
          <Route path="/projects/:id"  element={<ProjectDetailPage />} />
          <Route path="/items"      element={<Items />} />
          <Route path="/campaigns"  element={<CampaignsPage />} />
          <Route path="/calendar"   element={<CalendarPage />} />
          <Route path="/proofs"     element={<ProofsPage />} />
          <Route path="/tasks"      element={<TasksPage />} />
          <Route path="/timeboard"  element={<TimeboardPage />} />
          <Route path="/billing"    element={<BillingPage />} />
          <Route path="/products"   element={<ProductsPage />} />
          <Route path="/login"      element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}
