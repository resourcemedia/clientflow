import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './lib/theme'
import Sidebar from './components/layout/Sidebar'
import Dashboard from './pages/Dashboard'
import ClientsPage from './pages/Clients'
import ClientDetail from './pages/ClientDetail'
import ProjectsPage from './pages/Projects'
import { CampaignsPage, CalendarPage, ProofsPage, TimeboardPage, BillingPage } from './pages/Placeholders'
import './styles.css'

const isDemo = !import.meta.env.VITE_SUPABASE_URL

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <div className="app-layout">
          <Sidebar />
          <main className="main-content">
            {isDemo && (
              <div className="demo-banner">
                ⚡ Running in demo mode — no Supabase credentials found. Add your .env file to connect to a live database.
              </div>
            )}
            <Routes>
              <Route path="/"              element={<Dashboard />} />
              <Route path="/clients"       element={<ClientsPage />} />
              <Route path="/clients/:id"   element={<ClientDetail />} />
              <Route path="/projects"      element={<ProjectsPage />} />
              <Route path="/campaigns"     element={<CampaignsPage />} />
              <Route path="/calendar"      element={<CalendarPage />} />
              <Route path="/proofs"        element={<ProofsPage />} />
              <Route path="/timeboard"     element={<TimeboardPage />} />
              <Route path="/billing"       element={<BillingPage />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </ThemeProvider>
  )
}
