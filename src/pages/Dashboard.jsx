import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { StatCard } from '../components/ui'

function initials(str) {
  if (!str) return '?'
  return str.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function fmtDate(ts) {
  if (!ts) return '—'
  const d  = new Date(ts)
  const mo = d.getMonth() + 1
  const dy = d.getDate()
  const yr = String(d.getFullYear()).slice(2)
  return `${mo}/${dy}/${yr}`
}

function fmtUpdated(updatedAt, updaterName) {
  if (!updatedAt) return '—'
  const by = updaterName ? ` by ${initials(updaterName)}` : ''
  return `${fmtDate(updatedAt)}${by}`
}

function Avatar({ name, size = 24 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'var(--accent)',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.42, fontWeight: 600, color: '#fff',
      flexShrink: 0, userSelect: 'none',
    }}>
      {initials(name)}
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats,          setStats]          = useState({ projects: 0, proofs: 0, tasks: 0, scheduled: 0, openInvoices: 0 })
  const [projects,       setProjects]       = useState([])
  const [proofsToReview, setProofsToReview] = useState([])
  const [tasks,          setTasks]          = useState([])
  const [calendar,       setCalendar]       = useState([])
  const [openInvoices,   setOpenInvoices]   = useState([])
  const [loading,        setLoading]        = useState(true)

  useEffect(() => {
    async function load() {
      const today = new Date().toISOString().slice(0, 10)

      // Use allSettled so a single failing query doesn't blank the whole dashboard.
      // Count queries use select('id') — avoids 503s that HEAD requests can trigger.
      const results = await Promise.allSettled([
        supabase.from('projects').select('id', { count: 'exact' }).neq('archived', true),
        supabase.from('proofs').select('id', { count: 'exact' }).eq('status', 'Open'),
        supabase.from('tasks').select('id', { count: 'exact' }).eq('status', 'Open'),
        supabase.from('calendar_events').select('id', { count: 'exact' }).gte('event_date', today),
        supabase.from('invoices').select('id', { count: 'exact' }).eq('status', 'Open'),

        // Projects panel — latest 5
        supabase.from('projects')
          .select('id, name, product_type, client:clients(company,alias)')
          .neq('archived', true)
          .order('created_at', { ascending: false })
          .limit(5),

        // Proofs to review — Open status, latest 5
        supabase.from('proofs')
          .select('id, version, status, item:project_items(name, item_number, project:projects(name, product_type, client:clients(company,alias)))')
          .eq('status', 'Open')
          .order('created_at', { ascending: false })
          .limit(5),

        // Tasks — open, sorted by priority
        supabase.from('tasks')
          .select(`
            id, note, status_note, updated_at,
            project:projects(name, product_type, client:clients(company,alias)),
            assignee:profiles!tasks_assigned_to_fkey(name),
            updater:profiles!tasks_updated_by_fkey(name)
          `)
          .eq('status', 'Open')
          .order('sort_order')
          .order('created_at')
          .limit(5),

        // Calendar — upcoming 5
        supabase.from('calendar_events')
          .select('id, title, event_date, channel, client:clients(company,alias)')
          .gte('event_date', today)
          .order('event_date')
          .limit(5),

        // Open invoices — latest 5
        supabase.from('invoices')
          .select('id, invoice_number, issued_date, client:clients(company,alias)')
          .eq('status', 'Open')
          .order('issued_date', { ascending: false })
          .limit(5),
      ])

      function val(i, key, fallback) {
        const r = results[i]
        return r.status === 'fulfilled' ? (r.value[key] ?? fallback) : fallback
      }

      setStats({
        projects:     val(0, 'count', 0),
        proofs:       val(1, 'count', 0),
        tasks:        val(2, 'count', 0),
        scheduled:    val(3, 'count', 0),
        openInvoices: val(4, 'count', 0),
      })
      setProjects(val(5, 'data', []))
      setProofsToReview(val(6, 'data', []))
      setTasks(val(7, 'data', []))
      setCalendar(val(8, 'data', []))
      setOpenInvoices(val(9, 'data', []))
      setLoading(false)
    }

    load()
  }, [])

  function proofLabel(proof) {
    const item = proof.item
    if (!item) return `Proof`
    return `${item.item_number}${String.fromCharCode(64 + proof.version)}`
  }

  function productLabel(project) {
    return project?.product_type || '—'
  }

  return (
    <div className="fade-in">
      <div className="topbar">
        <div className="topbar-title">Dashboard</div>
      </div>

      <div className="page-content">

        {/* ── STAT CARDS ── */}
        <div className="stat-grid mb-24">
          <StatCard label="Projects"      value={loading ? '—' : stats.projects}     color="blue"   delta="Active" />
          <StatCard label="Proofs"        value={loading ? '—' : stats.proofs}       color="amber"  delta="Open for review" />
          <StatCard label="Tasks"         value={loading ? '—' : stats.tasks}        color="accent" delta="Open" />
          <StatCard label="Scheduled"     value={loading ? '—' : stats.scheduled}    color="green"  delta="Upcoming events" />
          <StatCard label="Open Invoices" value={loading ? '—' : stats.openInvoices} color="red"    delta="Unpaid" />
        </div>

        {/* ── ROW 1: Projects + Proofs to Review ── */}
        <div className="grid-2 mb-24">

          {/* Projects */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Projects</span>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/projects')}>View</button>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Product</th>
                  <th>Project</th>
                  <th style={{ width: 60 }} />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text3)' }}>Loading…</td></tr>
                ) : projects.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text3)' }}>No projects</td></tr>
                ) : projects.map(p => (
                  <tr key={p.id} onClick={() => navigate(`/projects/${p.id}`)} style={{ cursor: 'pointer' }}>
                    <td>{p.client?.company || p.client?.alias || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text3)' }}>{productLabel(p)}</td>
                    <td className="td-main">{p.name}</td>
                    <td><button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); navigate(`/projects/${p.id}`) }}>View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Proofs to Review */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Proofs to Review</span>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/proofs')}>View</button>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Product</th>
                  <th>Project</th>
                  <th>Item</th>
                  <th>Proof</th>
                  <th style={{ width: 60 }} />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text3)' }}>Loading…</td></tr>
                ) : proofsToReview.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text3)' }}>No proofs to review</td></tr>
                ) : proofsToReview.map(proof => {
                  const proj = proof.item?.project
                  return (
                    <tr key={proof.id}>
                      <td>{proj?.client?.company || proj?.client?.alias || '—'}</td>
                      <td style={{ fontSize: 12, color: 'var(--text3)' }}>{productLabel(proj)}</td>
                      <td>{proj?.name || '—'}</td>
                      <td>{proof.item?.name || '—'}</td>
                      <td className="td-main">{proofLabel(proof)}</td>
                      <td><button className="btn btn-ghost btn-sm">View</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Tasks ── */}
        <div className="card mb-24">
          <div className="card-header">
            <span className="card-title">Tasks</span>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/tasks')}>View</button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th>Product</th>
                <th>Project</th>
                <th>Task</th>
                <th>Assigned</th>
                <th>Note</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text3)' }}>Loading…</td></tr>
              ) : tasks.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text3)' }}>No open tasks</td></tr>
              ) : tasks.map(t => (
                <tr key={t.id} onClick={() => navigate('/tasks')} style={{ cursor: 'pointer' }}>
                  <td>{t.project?.client?.company || t.project?.client?.alias || '—'}</td>
                  <td style={{ fontSize: 12, color: 'var(--text3)' }}>{productLabel(t.project)}</td>
                  <td>{t.project?.name || '—'}</td>
                  <td className="td-main">{t.note || '—'}</td>
                  <td>
                    {t.assignee
                      ? <Avatar name={t.assignee.name} />
                      : <span style={{ color: 'var(--text3)' }}>—</span>}
                  </td>
                  <td style={{ color: 'var(--text3)' }}>{t.status_note || '—'}</td>
                  <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                    {fmtUpdated(t.updated_at, t.updater?.name)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── ROW 2: Calendar + Open Invoices ── */}
        <div className="grid-2">

          {/* Calendar */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Calendar</span>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/calendar')}>View</button>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Product</th>
                  <th>Item</th>
                  <th>Scheduled</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text3)' }}>Loading…</td></tr>
                ) : calendar.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text3)' }}>No upcoming events</td></tr>
                ) : calendar.map(ev => (
                  <tr key={ev.id} onClick={() => navigate('/calendar')} style={{ cursor: 'pointer' }}>
                    <td>{ev.client?.company || ev.client?.alias || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text3)' }}>{ev.channel ? `CO | ${ev.channel}` : '—'}</td>
                    <td>{ev.title}</td>
                    <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(ev.event_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Open Invoices */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Open Invoices</span>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/billing')}>View</button>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Invoice No.</th>
                  <th>Date</th>
                  <th style={{ width: 60 }} />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text3)' }}>Loading…</td></tr>
                ) : openInvoices.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text3)' }}>No open invoices</td></tr>
                ) : openInvoices.map(inv => (
                  <tr key={inv.id} onClick={() => navigate('/billing')} style={{ cursor: 'pointer' }}>
                    <td className="td-main">{inv.client?.company || inv.client?.alias || '—'}</td>
                    <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 12 }}>{inv.invoice_number || '—'}</td>
                    <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(inv.issued_date)}</td>
                    <td><button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); navigate('/billing') }}>View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </div>
  )
}
