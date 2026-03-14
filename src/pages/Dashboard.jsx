import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { StatusBadge, StatCard, fmt$ } from '../components/ui'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatDate() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60)   return `${m || 1}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)   return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7)    return `${d}d ago`
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function activityLabel(p) {
  if (p.proof_status === 'Approved') return `${p.client?.company || 'Unknown'} — ${p.name} proof approved`
  if (p.inv_status   === 'Paid')     return `${p.client?.company || 'Unknown'} — ${p.name} invoice paid`
  if (p.proof_status === 'Revise')   return `${p.client?.company || 'Unknown'} — ${p.name} needs revision`
  return `${p.client?.company || 'Unknown'} — ${p.name} updated`
}

function activityColor(p) {
  if (p.proof_status === 'Approved') return 'var(--green)'
  if (p.inv_status   === 'Paid')     return 'var(--green)'
  if (p.proof_status === 'Revise')   return 'var(--amber)'
  return 'var(--accent)'
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({ activeClients: 0, openProjects: 0, proofsPending: 0, outstanding: 0 })
  const [recentProjects, setRecentProjects] = useState([])
  const [activity, setActivity] = useState([])
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [
        { count: activeClients },
        { count: openProjects },
        { count: proofsPending },
        { data: outstandingRows },
        { data: projects },
        { data: activityRows },
        { data: clientRows },
      ] = await Promise.all([
        supabase.from('clients').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('projects').select('*', { count: 'exact', head: true }).neq('inv_status', 'Paid'),
        supabase.from('proofs').select('*', { count: 'exact', head: true }).eq('status', 'Open'),
        supabase.from('projects').select('client_owed'),
        supabase.from('projects')
          .select('id, name, proof_status, inv_status, client:clients(company, alias)')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase.from('projects')
          .select('id, name, updated_at, proof_status, inv_status, client:clients(company, alias)')
          .order('updated_at', { ascending: false })
          .limit(5),
        supabase.from('clients')
          .select('id, company, alias, status, facebook_url, projects(count)')
          .order('company')
          .limit(8),
      ])

      const outstanding = (outstandingRows || []).reduce((s, p) => s + (p.client_owed || 0), 0)

      setStats({
        activeClients: activeClients || 0,
        openProjects:  openProjects  || 0,
        proofsPending: proofsPending || 0,
        outstanding,
      })
      setRecentProjects(projects  || [])
      setActivity(activityRows    || [])
      setClients(clientRows       || [])
      setLoading(false)
    }

    load()
  }, [])

  return (
    <div className="fade-in">
      <div className="topbar">
        <div>
          <div className="topbar-title">{greeting()}, Jim</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>{formatDate()}</div>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/campaigns')}>
          + New campaign
        </button>
      </div>

      <div className="page-content">
        <div className="stat-grid mb-24">
          <StatCard label="Active clients"  value={loading ? '—' : stats.activeClients}         color="green"  delta="Active accounts" />
          <StatCard label="Open projects"   value={loading ? '—' : stats.openProjects}           color="blue"   delta="Invoice not yet paid" />
          <StatCard label="Proofs pending"  value={loading ? '—' : stats.proofsPending}          color="amber"  delta="Awaiting approval" />
          <StatCard label="Outstanding"     value={loading ? '—' : fmt$(stats.outstanding)}      color="accent" delta="Total client balance" />
        </div>

        <div className="grid-2 mb-24">
          {/* Recent projects */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Recent projects</span>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/projects')}>View all</button>
            </div>
            <table>
              <thead><tr><th>Project</th><th>Client</th><th>Proof</th><th>Invoice</th></tr></thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text3)', padding: '1.5rem' }}>Loading…</td></tr>
                ) : recentProjects.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text3)', padding: '1.5rem' }}>No projects yet</td></tr>
                ) : recentProjects.map(p => (
                  <tr key={p.id} onClick={() => navigate('/projects')} style={{ cursor: 'pointer' }}>
                    <td className="td-main">{p.name}</td>
                    <td>{p.client?.company || p.client?.alias || '—'}</td>
                    <td><StatusBadge status={p.proof_status} /></td>
                    <td><StatusBadge status={p.inv_status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Activity feed */}
          <div className="card">
            <div className="card-header"><span className="card-title">Recent activity</span></div>
            {loading ? (
              <div style={{ padding: '1.5rem', color: 'var(--text3)', textAlign: 'center' }}>Loading…</div>
            ) : activity.length === 0 ? (
              <div style={{ padding: '1.5rem', color: 'var(--text3)', textAlign: 'center' }}>No activity yet</div>
            ) : activity.map((item, i) => (
              <div key={item.id} style={{
                display: 'flex', gap: 12, padding: '12px 20px',
                borderBottom: i < activity.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: activityColor(item),
                  marginTop: 5, flexShrink: 0,
                }} />
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>
                    {activityLabel(item)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'DM Mono, monospace', marginTop: 2 }}>
                    {timeAgo(item.updated_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Clients table */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Clients at a glance</span>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/clients')}>View all</button>
          </div>
          <table>
            <thead><tr><th>Client</th><th>Status</th><th>Facebook</th><th>Projects</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text3)', padding: '1.5rem' }}>Loading…</td></tr>
              ) : clients.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text3)', padding: '1.5rem' }}>No clients yet</td></tr>
              ) : clients.map(c => (
                <tr key={c.id} onClick={() => navigate(`/clients/${c.id}`)} style={{ cursor: 'pointer' }}>
                  <td className="td-main">{c.company}</td>
                  <td><StatusBadge status={c.status} /></td>
                  <td>{c.facebook_url
                    ? <span className="badge badge-blue">Linked</span>
                    : <span className="badge badge-gray">Not set</span>}
                  </td>
                  <td className="text-mono">{c.projects?.[0]?.count ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
