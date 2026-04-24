import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { StatCard } from '../../components/ui'

function fmtDate(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`
}

function proofLabel(proof) {
  const item = proof.item
  if (!item) return 'Proof'
  return `${item.item_number}${String.fromCharCode(64 + proof.version)}`
}

export default function ClientDashboard() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const clientId = profile?.client_id

  const [stats,    setStats]    = useState({ projects: 0, proofs: 0, tasks: 0 })
  const [projects, setProjects] = useState([])
  const [proofs,   setProofs]   = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    if (!clientId) return
    load()
  }, [clientId])

  async function load() {
    setLoading(true)

    // For client_team, scope to assigned projects only
    let assignedProjectIds = null
    if (profile?.role === 'client_team') {
      const { data: assignments } = await supabase
        .from('client_project_assignments')
        .select('project_id')
        .eq('profile_id', profile.id)
      assignedProjectIds = (assignments || []).map(a => a.project_id)
    }

    function applyProjectFilter(query) {
      query = query.eq('client_id', clientId).neq('archived', true)
      if (assignedProjectIds) query = query.in('id', assignedProjectIds.length ? assignedProjectIds : [''])
      return query
    }

    const [projectsRes, proofsRes, tasksRes] = await Promise.allSettled([
      applyProjectFilter(
        supabase.from('projects').select('id, name, project_number, product:products(type,name)')
      ).order('name'),

      supabase.from('proofs')
        .select('id, version, status, item:project_items(name, item_number, project:projects(id, name, client_id))')
        .eq('status', 'Review')
        .order('created_at', { ascending: false })
        .limit(10),

      applyProjectFilter(
        supabase.from('tasks').select('id', { count: 'exact' })
      ).eq('status', 'Open'),
    ])

    const allProjects = projectsRes.status === 'fulfilled' ? (projectsRes.value.data || []) : []
    const projectIdSet = new Set(allProjects.map(p => p.id))

    // Filter proofs to this client's projects
    const allProofs = proofsRes.status === 'fulfilled' ? (proofsRes.value.data || []) : []
    const clientProofs = allProofs.filter(pr => {
      const projId = pr.item?.project?.id
      return projId && projectIdSet.has(projId)
    })

    const taskCount = tasksRes.status === 'fulfilled' ? (tasksRes.value.count ?? 0) : 0

    setProjects(allProjects)
    setProofs(clientProofs.slice(0, 5))
    setStats({
      projects: allProjects.length,
      proofs:   clientProofs.length,
      tasks:    taskCount,
    })
    setLoading(false)
  }

  return (
    <div className="fade-in">
      <div className="topbar">
        <div className="topbar-title">Dashboard</div>
      </div>

      <div className="page-content">

        {/* ── STAT CARDS ── */}
        <div className="stat-grid mb-24">
          <StatCard label="Active Projects" value={loading ? '—' : stats.projects} color="blue"   delta="Active" />
          <StatCard label="Proofs to Review" value={loading ? '—' : stats.proofs}   color="amber"  delta="Awaiting review" />
          <StatCard label="Open Tasks"      value={loading ? '—' : stats.tasks}    color="accent" delta="In progress" />
        </div>

        {/* ── PROJECTS TABLE ── */}
        <div className="card mb-24">
          <div className="card-header">
            <span className="card-title">Projects</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Project</th>
                <th>Number</th>
                <th>Product</th>
                <th style={{ width: 70 }} />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text3)' }}>Loading…</td></tr>
              ) : projects.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text3)' }}>No projects</td></tr>
              ) : projects.map(p => (
                <tr key={p.id} onClick={() => navigate(`/client/projects/${p.id}`)} style={{ cursor: 'pointer' }}>
                  <td className="td-main">{p.name}</td>
                  <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 12 }}>{p.project_number || '—'}</td>
                  <td style={{ fontSize: 12, color: 'var(--text3)' }}>{p.product?.name || p.product?.type || '—'}</td>
                  <td>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={e => { e.stopPropagation(); navigate(`/client/projects/${p.id}`) }}
                    >View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── OPEN PROOFS TABLE ── */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent Open Proofs</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Project</th>
                <th>Item</th>
                <th>Proof ID</th>
                <th style={{ width: 70 }} />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text3)' }}>Loading…</td></tr>
              ) : proofs.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text3)' }}>No open proofs</td></tr>
              ) : proofs.map(pr => (
                <tr key={pr.id}>
                  <td>{pr.item?.project?.name || '—'}</td>
                  <td>{pr.item?.name || '—'}</td>
                  <td className="td-main" style={{ fontFamily: 'DM Mono, monospace', fontSize: 12 }}>{proofLabel(pr)}</td>
                  <td>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => navigate(`/client/proofs/${pr.id}`)}
                    >View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  )
}
