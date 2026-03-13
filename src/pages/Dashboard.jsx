import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { DEMO_CLIENTS, DEMO_PROJECTS } from '../lib/demo-data'
import { StatusBadge, StatCard, fmt$ } from '../components/ui'

export default function Dashboard() {
  const [clients]  = useState(DEMO_CLIENTS)
  const [projects] = useState(DEMO_PROJECTS)
  const navigate   = useNavigate()

  const activeClients   = clients.filter(c => c.status === 'active').length
  const openProjects    = projects.filter(p => p.inv_status !== 'Paid').length
  const outstanding     = projects.reduce((s, p) => s + (p.client_owed || 0), 0)
  const recentProjects  = [...projects].sort((a, b) => b.id - a.id).slice(0, 4)

  return (
    <div className="fade-in">
      <div className="topbar">
        <div>
          <div className="topbar-title">Good morning, Jim</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Friday, March 13, 2026</div>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/campaigns')}>
          + New campaign
        </button>
      </div>

      <div className="page-content">
        <div className="stat-grid mb-24">
          <StatCard label="Active clients"  value={activeClients}   color="green"  delta="↑ 2 this month" />
          <StatCard label="Open projects"   value={openProjects}    color="blue"   delta="5 need attention" />
          <StatCard label="Proofs pending"  value={3}               color="amber"  delta="Awaiting approval" />
          <StatCard label="Outstanding"     value={fmt$(outstanding)} color="accent" delta="↑ 12% vs last month" />
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
                {recentProjects.map(p => (
                  <tr key={p.id} onClick={() => navigate(`/projects/${p.id}`)}>
                    <td className="td-main">{p.name}</td>
                    <td>{p.client?.company || '—'}</td>
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
            {[
              { color: 'var(--green)',  text: <><strong>Arrow Auto Glass</strong> — Proof #102304 approved</>,          time: '2 hours ago' },
              { color: 'var(--accent)', text: <><strong>Savory Commercial</strong> — New campaign created</>,           time: 'Yesterday, 4:12 PM' },
              { color: 'var(--amber)',  text: <><strong>Flags Plus</strong> — Proof needs revision (version 2)</>,      time: 'Yesterday, 11:30 AM' },
              { color: 'var(--blue)',   text: <><strong>WQI Blog</strong> — Project status → In Progress</>,           time: 'Mar 11, 9:15 AM' },
              { color: 'var(--green)',  text: <><strong>Invoice #1042</strong> — Payment received — $1,200</>,          time: 'Mar 10, 3:00 PM' },
            ].map((item, i) => (
              <div key={i} style={{
                display: 'flex', gap: 12, padding: '12px 20px',
                borderBottom: i < 4 ? '1px solid var(--border)' : 'none'
              }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, marginTop: 5, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>{item.text}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'DM Mono, monospace', marginTop: 2 }}>{item.time}</div>
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
              {clients.map(c => (
                <tr key={c.id} onClick={() => navigate(`/clients/${c.id}`)}>
                  <td className="td-main">{c.company}</td>
                  <td><StatusBadge status={c.status} /></td>
                  <td>{c.facebook_url ? <span className="badge badge-blue">Linked</span> : <span className="badge badge-gray">Not set</span>}</td>
                  <td className="text-mono">{projects.filter(p => p.client_id === c.id).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
