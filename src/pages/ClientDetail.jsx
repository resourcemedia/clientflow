import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { DEMO_CLIENTS, DEMO_PROJECTS } from '../lib/demo-data'
import { StatusBadge, StatCard, fmt$, initials } from '../components/ui'

const isDemo = !import.meta.env.VITE_SUPABASE_URL

export default function ClientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [client, setClient] = useState(null)
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [id])

  async function load() {
    setLoading(true)
    if (isDemo) {
      const c = DEMO_CLIENTS.find(c => c.id === id)
      setClient(c || null)
      setProjects(DEMO_PROJECTS.filter(p => p.client_id === id))
    } else {
      const [{ data: c }, { data: p }] = await Promise.all([
        supabase.from('clients').select('*').eq('id', id).single(),
        supabase.from('projects').select('*').eq('client_id', id).order('created_at', { ascending: false }),
      ])
      setClient(c)
      setProjects(p || [])
    }
    setLoading(false)
  }

  if (loading) return <div className="page-content text-dim">Loading…</div>
  if (!client)  return <div className="page-content text-dim">Client not found.</div>

  const totalBilled    = projects.reduce((s, p) => s + (p.est_amount  || 0), 0)
  const totalCollected = projects.reduce((s, p) => s + (p.client_paid || 0), 0)
  const outstanding    = projects.reduce((s, p) => s + (p.client_owed || 0), 0)

  return (
    <div className="fade-in">
      {/* Topbar */}
      <div className="topbar">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/clients')}>
          ← Clients
        </button>
        <div className="flex-center gap-12 flex-1">
          <div className="client-avatar-lg">{initials(client.alias || client.company)}</div>
          <div>
            <div className="topbar-title" style={{ fontSize: 18 }}>{client.company}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>
              {client.email || 'No email'} · Added {client.created_at?.slice(0, 10)}
            </div>
          </div>
        </div>
        <StatusBadge status={client.status} />
        <button className="btn btn-ghost btn-sm">Edit</button>
      </div>

      <div className="page-content">
        {/* Stats row */}
        <div className="stat-grid mb-24" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
          <StatCard label="Open projects"  value={projects.length}    color="blue" />
          <StatCard label="Total billed"   value={fmt$(totalBilled)}  color="accent" />
          <StatCard label="Collected"      value={fmt$(totalCollected)} color="green" />
          <StatCard label="Outstanding"    value={fmt$(outstanding)}  color="amber" />
        </div>

        <div className="grid-2 mb-24">
          {/* Client info card */}
          <div className="card">
            <div className="card-header"><span className="card-title">Client info</span></div>
            <div className="detail-meta" style={{ flexDirection: 'column', gap: 16 }}>
              <Row label="Company"    value={client.company} />
              <Row label="Alias"      value={client.alias} />
              <Row label="Email"      value={client.email} />
              <Row label="Facebook"   value={client.facebook_url
                ? <a href={client.facebook_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent2)' }}>View page ↗</a>
                : <span className="text-dim">Not set</span>}
              />
              <Row label="Google Drive" value={client.google_drive_url
                ? <a href={client.google_drive_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent2)' }}>Open folder ↗</a>
                : <span className="text-dim">Not set</span>}
              />
              {client.transition_status && (
                <Row label="Transition" value={client.transition_status} />
              )}
            </div>
            {client.notes && (
              <div style={{ padding: '0 20px 20px' }}>
                <div className="detail-meta-label mb-4">Notes</div>
                <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>{client.notes}</div>
              </div>
            )}
          </div>

          {/* Quick financial summary */}
          <div className="card">
            <div className="card-header"><span className="card-title">Financial summary</span></div>
            <table>
              <thead>
                <tr><th>Project</th><th>Est</th><th>Owed</th><th>Paid</th></tr>
              </thead>
              <tbody>
                {projects.map(p => (
                  <tr key={p.id} onClick={() => navigate(`/projects/${p.id}`)}>
                    <td className="td-main">{p.name}</td>
                    <td className="text-mono">{fmt$(p.est_amount)}</td>
                    <td className="text-mono text-amber">{fmt$(p.client_owed)}</td>
                    <td className="text-mono text-green">{fmt$(p.client_paid)}</td>
                  </tr>
                ))}
                {projects.length === 0 && (
                  <tr><td colSpan="4" className="text-dim" style={{ textAlign: 'center', padding: '24px 20px' }}>No projects yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Projects table */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Projects</span>
            <Link to={`/projects?client=${id}`} className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }}>
              View all
            </Link>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Name</th><th>Type</th><th>Priority</th>
                  <th>Proof</th><th>Invoice</th><th>Start</th>
                </tr>
              </thead>
              <tbody>
                {projects.map(p => (
                  <tr key={p.id} onClick={() => navigate(`/projects/${p.id}`)}>
                    <td className="text-mono text-dim">{p.project_number}</td>
                    <td className="td-main">{p.name}</td>
                    <td><StatusBadge status={p.product_type} /></td>
                    <td><StatusBadge status={p.priority} /></td>
                    <td><StatusBadge status={p.proof_status} /></td>
                    <td><StatusBadge status={p.inv_status} /></td>
                    <td className="text-mono text-dim">{p.start_date?.slice(0,10) || '—'}</td>
                  </tr>
                ))}
                {projects.length === 0 && (
                  <tr><td colSpan="7" className="text-dim" style={{ textAlign: 'center', padding: '24px 20px' }}>No projects for this client</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div>
      <div className="detail-meta-label mb-4">{label}</div>
      <div style={{ fontSize: 13, color: 'var(--text)' }}>{value || <span className="text-dim">—</span>}</div>
    </div>
  )
}
