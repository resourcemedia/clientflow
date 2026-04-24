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
import ProjectsSandbox from './sandbox/ProjectsSandbox'
import ClientDashboard     from './pages/client/ClientDashboard'
import ClientProjectDetail from './pages/client/ClientProjectDetail'
import ClientProofs        from './pages/client/ClientProofs'
import ClientProofDetail   from './pages/client/ClientProofDetail'
import ClientTasks         from './pages/client/ClientTasks'
import ClientInvoices      from './pages/client/ClientInvoices'
import ClientProjects      from './pages/client/ClientProjects'
import './styles.css'

const CLIENT_ROLES = ['client_admin', 'client_team']

function ClientRoute({ children }) {
  const { user, profile } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (!CLIENT_ROLES.includes(profile?.role)) return <Navigate to="/" replace />
  return children
}

function AppShell() {
  const { user, profile, loading } = useAuth()

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
      <div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
    </div>
  )

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  const homeRedirect = CLIENT_ROLES.includes(profile?.role)
    ? <Navigate to="/client" replace />
    : <Dashboard />

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route path="/"                    element={homeRedirect} />
          <Route path="/clients"             element={<ClientsPage />} />
          <Route path="/clients/:id"         element={<ClientDetail />} />
          <Route path="/projects"            element={<ProjectsPage />} />
          <Route path="/projects/:id"        element={<ProjectDetailPage />} />
          <Route path="/items"               element={<Items />} />
          <Route path="/campaigns"           element={<CampaignsPage />} />
          <Route path="/calendar"            element={<CalendarPage />} />
          <Route path="/proofs"              element={<ProofsPage />} />
          <Route path="/tasks"               element={<TasksPage />} />
          <Route path="/timeboard"           element={<TimeboardPage />} />
          <Route path="/billing"             element={<BillingPage />} />
          <Route path="/products"            element={<ProductsPage />} />
          <Route path="/sandbox"             element={<ProjectsSandbox />} />
          <Route path="/login"               element={<Navigate to="/" replace />} />
          <Route path="/client"              element={<ClientRoute><ClientDashboard /></ClientRoute>} />
          <Route path="/client/projects/:id" element={<ClientRoute><ClientProjectDetail /></ClientRoute>} />
          <Route path="/client/projects"      element={<ClientRoute><ClientProjects /></ClientRoute>} />
          <Route path="/client/proofs"       element={<ClientRoute><ClientProofs /></ClientRoute>} />
          <Route path="/client/proofs/:id"   element={<ClientRoute><ClientProofDetail /></ClientRoute>} />
          <Route path="/client/tasks"        element={<ClientRoute><ClientTasks /></ClientRoute>} />
          <Route path="/client/invoices"     element={<ClientRoute><ClientInvoices /></ClientRoute>} />
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
