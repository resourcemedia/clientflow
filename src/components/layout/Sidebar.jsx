import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useTheme } from '../../lib/theme'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'

const MANAGER_NAV = [
  { to: '/',          label: 'Dashboard', exact: true, icon: GridIcon },
  { to: '/clients',   label: 'Clients',               icon: UsersIcon },
  { to: '/projects',  label: 'Projects',               icon: FolderIcon,  badgeKey: 'projects', badgeWarn: true },
  { to: '/items',     label: 'Items',                  icon: ListIcon },
  { to: '/proofs',    label: 'Proofs',                 icon: FileIcon,    badgeKey: 'proofs' },
  { to: '/tasks',     label: 'Tasks',                  icon: TasksIcon,   badgeKey: 'tasks', badgeWarn: true },
  { to: '/calendar',  label: 'Calendar',               icon: CalendarIcon },
  { to: '/timeboard', label: 'Time board',             icon: ClockIcon },
  { to: '/billing',   label: 'Invoices',               icon: DollarIcon },
  { to: '/products',  label: 'Products',               icon: ProductsIcon },
  { to: '/cashflow',  label: 'Cash Flow',              icon: CashFlowIcon },
]

const CLIENT_NAV_BASE = [
  { to: '/client',          label: 'Dashboard',  exact: true, icon: GridIcon },
  { to: '/client/projects', label: 'Projects',               icon: FolderIcon },
  { to: '/client/proofs',   label: 'Proofs',                 icon: FileIcon },
  { to: '/client/tasks',   label: 'Tasks',                    icon: TasksIcon },
  { to: '/calendar',       label: 'Calendar',                 icon: CalendarIcon },
]

const CLIENT_ADMIN_NAV = [
  ...CLIENT_NAV_BASE,
  { to: '/client/invoices', label: 'Invoices', icon: DollarIcon },
]

const ROLE_LABELS = {
  manager:      'Manager',
  client:       'Client',
  client_admin: 'Client Admin',
  client_team:  'Client Team',
}

function initials(name) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

export default function Sidebar() {
  const { theme, toggle } = useTheme()
  const { signOut, profile } = useAuth()
  const loc = useLocation()
  const [badges, setBadges] = useState({ projects: 0, proofs: 0, tasks: 0 })

  const role = profile?.role
  const isClient = role === 'client' || role === 'client_admin' || role === 'client_team'
  const nav = isClient
    ? (role === 'client_team' ? CLIENT_NAV_BASE : CLIENT_ADMIN_NAV)
    : MANAGER_NAV

  useEffect(() => {
    if (isClient) return
    Promise.allSettled([
      supabase.from('projects').select('id', { count: 'exact' }).neq('inv_status', 'Paid'),
      supabase.from('proofs').select('id', { count: 'exact' }).eq('status', 'Open'),
      supabase.from('tasks').select('id', { count: 'exact' }).eq('status', 'Open'),
    ]).then(([projects, proofs, tasks]) => {
      setBadges({
        projects: projects.status === 'fulfilled' ? (projects.value.count || 0) : 0,
        proofs:   proofs.status   === 'fulfilled' ? (proofs.value.count   || 0) : 0,
        tasks:    tasks.status    === 'fulfilled' ? (tasks.value.count    || 0) : 0,
      })
    })
  }, [isClient])

  const displayName = profile?.name || ''
  const roleLabel   = ROLE_LABELS[role] ?? 'Manager'

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-mark">C</div>
        <div>
          <div className="logo-text">ClientFlow</div>
          <div className="logo-sub">Marketing OS</div>
        </div>
      </div>

      {/* Nav */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {nav.map(item => {
          const Icon = item.icon
          const isActive = item.exact
            ? loc.pathname === item.to
            : loc.pathname.startsWith(item.to)
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`nav-item ${isActive ? 'active' : ''}`}
              style={{ textDecoration: 'none' }}
            >
              <Icon className="nav-icon" />
              {item.label}
              {!isClient && item.badgeKey && badges[item.badgeKey] > 0 && (
                <span className={`nav-badge${item.badgeWarn ? ' warn' : ''}`}>
                  {badges[item.badgeKey]}
                </span>
              )}
            </NavLink>
          )
        })}
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="user-avatar">{initials(displayName)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="user-name">{displayName}</div>
          <div className="user-role">{roleLabel}</div>
        </div>
        <button
          className="theme-toggle"
          onClick={toggle}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
        <button
          className="theme-toggle"
          onClick={signOut}
          title="Sign out"
        >
          <SignOutIcon />
        </button>
      </div>
    </aside>
  )
}

// ── ICONS ─────────────────────────────────────────────────────────────
function GridIcon(props) {
  return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
  </svg>
}
function UsersIcon(props) {
  return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
}
function FolderIcon(props) {
  return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>
}
function CalendarIcon(props) {
  return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
}
function FileIcon(props) {
  return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
}
function ClockIcon(props) {
  return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
}
function DollarIcon(props) {
  return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="1" x2="12" y2="23"/>
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
  </svg>
}
function SunIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
}
function MoonIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
}
function SignOutIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
}
function ListIcon(props) {
  return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="8" y1="6"  x2="21" y2="6"/>
    <line x1="8" y1="12" x2="21" y2="12"/>
    <line x1="8" y1="18" x2="21" y2="18"/>
    <line x1="3" y1="6"  x2="3.01" y2="6"/>
    <line x1="3" y1="12" x2="3.01" y2="12"/>
    <line x1="3" y1="18" x2="3.01" y2="18"/>
  </svg>
}
function ProductsIcon(props) {
  return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
    <line x1="7" y1="7" x2="7.01" y2="7"/>
  </svg>
}
function TasksIcon(props) {
  return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="9" y1="6"  x2="20" y2="6"/>
    <line x1="9" y1="12" x2="20" y2="12"/>
    <line x1="9" y1="18" x2="20" y2="18"/>
    <polyline points="4 6 5 7 7 5"/>
    <polyline points="4 12 5 13 7 11"/>
    <polyline points="4 18 5 19 7 17"/>
  </svg>
}
function CashFlowIcon(props) {
  return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="5" width="20" height="14" rx="2"/>
    <line x1="2" y1="10" x2="22" y2="10"/>
    <line x1="6" y1="15" x2="10" y2="15"/>
    <line x1="14" y1="15" x2="18" y2="15"/>
  </svg>
}
