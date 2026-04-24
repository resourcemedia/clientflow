import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'

function versionLabel(itemNumber, version) {
  return `${itemNumber}${String.fromCharCode(64 + version)}`
}

export default function ClientProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [project, setProject] = useState(null)
  const [items,   setItems]   = useState([])
  const [tasks,   setTasks]   = useState([])
  const [proofs,  setProofs]  = useState({}) // { [itemId]: Proof[] }
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState({}) // { [itemId]: true }

  useEffect(() => { load() }, [id])

  async function load() {
    setLoading(true)
    const [{ data: proj }, { data: itemRows }, { data: taskRows }] = await Promise.all([
      supabase.from('projects').select('*, client:clients(id,company,alias), product:products(type,name)').eq('id', id).single(),
      supabase.from('project_items').select('*').eq('project_id', id).order('sort_order').order('item_number'),
      supabase.from('tasks').select('id, note, status, status_note').eq('project_id', id).order('sort_order').order('created_at'),
    ])

    // Validate client ownership
    if (!proj || proj.client_id !== profile?.client_id) {
      navigate('/client')
      return
    }

    setProject(proj)
    setItems(itemRows || [])
    setTasks(taskRows || [])
    setLoading(false)
  }

  async function loadProofs(itemId) {
    if (proofs[itemId]) return
    const { data } = await supabase
      .from('proofs')
      .select('*')
      .eq('item_id', itemId)
      .order('version')
    setProofs(prev => ({ ...prev, [itemId]: data || [] }))
  }

  function toggleItem(itemId) {
    const opening = !expanded[itemId]
    setExpanded(prev => ({ ...prev, [itemId]: opening }))
    if (opening) loadProofs(itemId)
  }

  if (loading) return (
    <div className="fade-in">
      <div className="topbar"><div className="topbar-title">Project</div></div>
      <div className="page-content"><div className="card"><div className="empty-state text-dim">Loading…</div></div></div>
    </div>
  )

  const clientName = project?.client?.company || project?.client?.alias || '—'

  return (
    <div className="fade-in">
      <div className="topbar">
        <div className="topbar-title">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/client')} style={{ marginRight: 8 }}>← Back</button>
          {project?.name}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text3)' }}>{clientName}</div>
      </div>

      <div className="page-content">

        {/* Project info */}
        <div className="card mb-24">
          <div className="card-header"><span className="card-title">Project Info</span></div>
          <table>
            <tbody>
              <tr>
                <td style={{ width: 160, color: 'var(--text3)', fontSize: 13 }}>Client</td>
                <td>{clientName}</td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text3)', fontSize: 13 }}>Project Number</td>
                <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 13 }}>{project?.project_number || '—'}</td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text3)', fontSize: 13 }}>Product</td>
                <td>{project?.product?.name || project?.product?.type || '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Items */}
        <div className="card mb-24">
          <div className="card-header"><span className="card-title">Items</span></div>
          {items.length === 0 ? (
            <div className="empty-state text-dim" style={{ padding: '1.5rem' }}>No items</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40 }} />
                  <th>Item</th>
                  <th>Order</th>
                  <th>Scheduled</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <>
                    <tr
                      key={item.id}
                      onClick={() => toggleItem(item.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={{ textAlign: 'center', fontSize: 12, color: 'var(--text3)' }}>
                        {expanded[item.id] ? '▾' : '▸'}
                      </td>
                      <td className="td-main">{item.name}</td>
                      <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
                        {item.item_number ? `0${item.item_number}` : '—'}
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--text3)' }}>{item.scheduled_date || '—'}</td>
                    </tr>
                    {expanded[item.id] && (
                      <tr key={`proofs-${item.id}`}>
                        <td colSpan={4} style={{ padding: 0 }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#f2eaf4' }}>
                            <thead>
                              <tr>
                                <th style={{ width: 40, background: '#d5b6dd', borderTop: 'none', borderBottom: 'none' }} />
                                <th style={{ padding: '6px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#fff', background: '#d5b6dd', borderTop: 'none', borderBottom: 'none' }}>Proof</th>
                                <th style={{ padding: '6px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#fff', background: '#d5b6dd', borderTop: 'none', borderBottom: 'none' }}>Status</th>
                                <th style={{ padding: '6px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#fff', background: '#d5b6dd', borderTop: 'none', borderBottom: 'none' }}>Comments / Changes</th>
                                <th style={{ padding: '6px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#fff', background: '#d5b6dd', borderTop: 'none', borderBottom: 'none' }}>Link</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(proofs[item.id] || []).length === 0 ? (
                                <tr><td colSpan={5} style={{ padding: '10px 16px', color: 'var(--text3)', fontSize: 13 }}>No proofs yet</td></tr>
                              ) : (proofs[item.id] || []).map(proof => (
                                <tr key={proof.id} style={{ borderBottom: '1px solid #d5b6dd' }}>
                                  <td style={{ width: 40, borderRight: '1px solid #d5b6dd' }} />
                                  <td style={{ padding: '6px 12px', fontFamily: 'DM Mono, monospace', fontSize: 12, borderRight: '1px solid #d5b6dd' }}>
                                    {versionLabel(item.item_number, proof.version)}
                                  </td>
                                  <td style={{ padding: '6px 12px', fontSize: 13, borderRight: '1px solid #d5b6dd' }}>{proof.status || '—'}</td>
                                  <td style={{ padding: '6px 12px', fontSize: 13, borderRight: '1px solid #d5b6dd' }}>{proof.comments || '—'}</td>
                                  <td style={{ padding: '6px 12px' }}>
                                    {proof.url
                                      ? <a href={proof.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">View</a>
                                      : <span style={{ color: 'var(--text3)', fontSize: 13 }}>—</span>}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Tasks */}
        <div className="card">
          <div className="card-header"><span className="card-title">Tasks</span></div>
          {tasks.length === 0 ? (
            <div className="empty-state text-dim" style={{ padding: '1.5rem' }}>No tasks</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Status</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map(t => (
                  <tr key={t.id}>
                    <td className="td-main">{t.note || '—'}</td>
                    <td style={{ fontSize: 13, color: 'var(--text3)' }}>{t.status || '—'}</td>
                    <td style={{ fontSize: 13, color: 'var(--text3)' }}>{t.status_note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  )
}
