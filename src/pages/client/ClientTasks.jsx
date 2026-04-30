import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { PillNav, Breadcrumb } from '../../components/ui'

const STATUS_TABS = [
  { id: 'Normal', label: 'Normal' },
  { id: 'Hot',    label: 'Hot'    },
]

function fmtUpdated(updatedAt) {
  if (!updatedAt) return '—'
  const d  = new Date(updatedAt)
  const mo = d.getMonth() + 1
  const dy = d.getDate()
  const yr = String(d.getFullYear()).slice(2)
  return `${mo}/${dy}/${yr}`
}

export default function ClientTasks() {
  const location      = useLocation()
  const [tasks,        setTasks]        = useState([])
  const [loading,      setLoading]      = useState(true)
  const [statusFilter, setStatusFilter] = useState('Normal')
  const [searchQuery,  setSearchQuery]  = useState('')

  useEffect(() => { setLoading(true); load() }, [location.pathname])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data: profile } = await supabase
      .from('profiles')
      .select('client_id')
      .eq('id', user.id)
      .single()
    const clientId = profile?.client_id
    if (!clientId) { setTasks([]); setLoading(false); return }

    const { data: projects } = await supabase
      .from('projects')
      .select('id')
      .eq('client_id', clientId)
    const projectIds = (projects || []).map(p => p.id)

    const { data: taskRows } = await supabase
      .from('tasks')
      .select('*, project:projects(name)')
      .in('project_id', projectIds.length ? projectIds : [''])
      .order('sort_order')
      .order('created_at')
    setTasks(taskRows || [])
    setLoading(false)
  }

  const filtered = tasks.filter(t => {
    if (t.status !== statusFilter) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const haystack = [t.note, t.status_note, t.project?.name].join(' ').toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })

  return (
    <div className="fade-in">
      <div className="topbar">
        <Breadcrumb segments={[{ label: 'Tasks' }]} />
        <PillNav tabs={STATUS_TABS} active={statusFilter} onChange={setStatusFilter} />
        <input
          type="search"
          placeholder="Search…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '5px 10px', color: 'var(--text)',
            fontSize: 13, width: 180, outline: 'none',
          }}
        />
      </div>

      <div className="page-content">
        <div className="card">
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ background: '#9dc691', color: '#fff' }}>Project</th>
                  <th style={{ background: '#9dc691', color: '#fff' }}>Task</th>
                  <th style={{ background: '#9dc691', color: '#fff' }}>Note</th>
                  <th style={{ background: '#9dc691', color: '#fff' }}>Status</th>
                  <th style={{ background: '#9dc691', color: '#fff' }}>Updated</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text3)' }}>
                      Loading…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text3)' }}>
                      No {statusFilter.toLowerCase()} tasks
                    </td>
                  </tr>
                ) : filtered.map(task => (
                  <tr key={task.id} style={{ background: '#f7fff5' }}>
                    <td>{task.project?.name || '—'}</td>
                    <td className="td-main" style={{ minWidth: 160 }}>
                      {task.note || <span style={{ color: 'var(--text3)' }}>—</span>}
                    </td>
                    <td style={{ minWidth: 140, color: task.status_note ? 'var(--text2)' : 'var(--text3)' }}>
                      {task.status_note || '—'}
                    </td>
                    <td style={{ fontWeight: 600, fontSize: 13 }}>{task.status || '—'}</td>
                    <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                      {fmtUpdated(task.updated_at)}
                    </td>
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
