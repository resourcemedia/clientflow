import { useState, useEffect, Fragment } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Breadcrumb } from '../components/ui'

const STATUS_TABS = [
  { id: 'Review',   label: 'Review'   },
  { id: 'Revise',   label: 'Revise'   },
  { id: 'Approved', label: 'Approved' },
]

const thStyle = {
  padding: '6px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600,
  letterSpacing: '0.07em', textTransform: 'uppercase', color: '#fff',
  background: '#d5b6dd', borderTop: 'none', borderBottom: 'none',
}

function fmtCommentDate(ts) {
  if (!ts) return ''
  const d    = new Date(ts)
  const mo   = d.getMonth() + 1
  const dy   = d.getDate()
  const yr   = String(d.getFullYear()).slice(2)
  let h      = d.getHours()
  const ampm = h >= 12 ? 'pm' : 'am'
  h = h % 12 || 12
  const min  = String(d.getMinutes()).padStart(2, '0')
  return `${mo}/${dy}/${yr}  |  ${h}:${min} ${ampm}`
}

// ── STATUS ICON ───────────────────────────────────────────────────────────────
function StatusIcon({ status }) {
  if (status === 'Review') {
    return (
      <svg width="22" height="22" viewBox="0 0 22 22">
        <circle cx="11" cy="11" r="10" fill="#333" />
      </svg>
    )
  }
  if (status === 'Revise') {
    return (
      <svg width="22" height="22" viewBox="0 0 22 22">
        <circle cx="11" cy="11" r="10" fill="none" stroke="#333" strokeWidth="1.5" />
        <path d="M11,1 A10,10 0 0 1 11,21 Z" fill="#333" />
      </svg>
    )
  }
  return (
    <svg width="22" height="22" viewBox="0 0 22 22">
      <circle cx="11" cy="11" r="10" fill="none" stroke="#999" strokeWidth="1.5" />
    </svg>
  )
}

// ── ACTION ICONS ──────────────────────────────────────────────────────────────
function ViewIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 25 25" fill="currentColor">
      <path d="M18.22,11.18c-.28,0-.5.22-.5.5v5.49c0,.89-.72,1.62-1.62,1.62H7.93c-.89,0-1.62-.72-1.62-1.62v-8.17c0-.89.73-1.62,1.62-1.62h5.32c.28,0,.5-.22.5-.5s-.22-.5-.5-.5h-5.32c-1.44,0-2.62,1.17-2.62,2.62v8.17c0,1.44,1.17,2.62,2.62,2.62h8.17c1.44,0,2.62-1.17,2.62-2.62v-5.49c0-.28-.22-.5-.5-.5Z"/>
      <path d="M14.8,5.22c-.28,0-.5.22-.5.5s.22.5.5.5h3.18l-8.69,8.69c-.2.2-.2.51,0,.71.1.1.23.15.35.15s.26-.05.35-.15l8.69-8.69v3.18c0,.28.22.5.5.5s.5-.22.5-.5v-4.89h-4.89Z"/>
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6M14 11v6"/>
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  )
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function ProofsPage() {
  const navigate      = useNavigate()
  const location      = useLocation()
  const { profile }   = useAuth()

  const [proofs,          setProofs]          = useState([])
  const [loading,         setLoading]         = useState(true)
  const [statusFilter,    setStatusFilter]    = useState(null)
  const [expandedProofId, setExpandedProofId] = useState(null)
  const [drawerStatus,    setDrawerStatus]    = useState('')
  const [commentVal,      setCommentVal]      = useState('')
  const [submitLabel,     setSubmitLabel]     = useState('Submit')
  const [proofComments,   setProofComments]   = useState({})
  const [clientMap,       setClientMap]       = useState(new Map())

  useEffect(() => {
    setLoading(true)
    setStatusFilter(null)
    setExpandedProofId(null)
    setCommentVal('')
    setDrawerStatus('')
    load()
  }, [location.pathname])

  async function load() {
    setLoading(true)
    const [{ data, error }, { data: clientsData }] = await Promise.all([
      supabase
        .from('proofs')
        .select(`
          id,
          proof_number,
          status,
          url,
          project_items(
            name,
            projects(
              id,
              name,
              client_id
            )
          )
        `)
        .order('created_at', { ascending: false }),
      supabase
        .from('clients')
        .select('id, name'),
    ])
    if (error) console.error('proofs fetch error:', error.message)
    const clientMap = new Map((clientsData || []).map(c => [c.id, c.name]))
    setClientMap(clientMap)
    setProofs(data || [])
    setLoading(false)
  }

  // ── DRAWER ────────────────────────────────────────────────────────────────
  function toggleDrawer(proofId, currentStatus) {
    if (expandedProofId === proofId) {
      setExpandedProofId(null)
      setCommentVal('')
      setDrawerStatus('')
    } else {
      setExpandedProofId(proofId)
      setCommentVal('')
      setDrawerStatus(currentStatus || 'Review')
      setSubmitLabel('Submit')
      loadComments(proofId)
    }
  }

  async function loadComments(proofId) {
    const { data } = await supabase
      .from('proof_comments')
      .select('id, body, created_at, profile:profiles(name, role)')
      .eq('proof_id', proofId)
      .order('created_at', { ascending: false })
    setProofComments(prev => ({ ...prev, [proofId]: data || [] }))
  }

  async function updateProofStatus(proofId, newStatus) {
    await supabase.from('proofs').update({ status: newStatus }).eq('id', proofId)
    setProofs(ps => ps.map(p => p.id === proofId ? { ...p, status: newStatus } : p))
    setDrawerStatus(newStatus)
  }

  async function submitComment(proofId) {
    if (!commentVal.trim()) return
    const { data } = await supabase
      .from('proof_comments')
      .insert({
        proof_id:   proofId,
        profile_id: profile?.id,
        body:       commentVal.trim(),
      })
      .select('id, body, created_at, profile:profiles(name, role)')
      .single()
    if (!data) return
    setCommentVal('')
    setSubmitLabel('Saved!')
    setTimeout(() => setSubmitLabel('Submit'), 1500)
    setProofComments(prev => ({ ...prev, [proofId]: [data, ...(prev[proofId] || [])] }))
  }

  // ── FILTER + GROUP ────────────────────────────────────────────────────────
  function toggleFilter(val) {
    setStatusFilter(f => f === val ? null : val)
  }

  const filtered = statusFilter ? proofs.filter(p => p.status === statusFilter) : proofs

  const groupMap = filtered.reduce((acc, proof) => {
    const clientId   = proof.project_items?.projects?.client_id || '__none__'
    const clientName = clientMap.get(proof.project_items?.projects?.client_id) || '—'
    if (!acc[clientId]) acc[clientId] = { clientId, clientName, rows: [] }
    acc[clientId].rows.push(proof)
    return acc
  }, {})

  const clientGroups = Object.values(groupMap)
  clientGroups.forEach(group => {
    group.rows.sort((a, b) => {
      const pa = a.project_items?.projects?.name || ''
      const pb = b.project_items?.projects?.name || ''
      if (pa !== pb) return pa.localeCompare(pb)
      return (a.proof_number || '').localeCompare(b.proof_number || '')
    })
  })
  clientGroups.sort((a, b) => a.clientName.localeCompare(b.clientName))

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="fade-in">
      <div className="topbar">
        <Breadcrumb segments={[
          { label: 'Dashboard', onClick: () => navigate('/') },
          { label: 'Proofs' },
        ]} />
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          {STATUS_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => toggleFilter(tab.id)}
              style={{
                padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                cursor: 'pointer',
                border: `1px solid ${statusFilter === tab.id ? '#d5b6dd' : 'var(--border)'}`,
                background: statusFilter === tab.id ? '#d5b6dd' : 'transparent',
                color: statusFilter === tab.id ? '#fff' : 'var(--text2)',
                transition: 'all 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="page-content">
        {loading ? (
          <div className="empty-state text-dim">Loading…</div>
        ) : clientGroups.length === 0 ? (
          <div className="empty-state text-dim">
            {statusFilter ? `No ${statusFilter.toLowerCase()} proofs found.` : 'No proofs found.'}
          </div>
        ) : (
          clientGroups.map(group => (
            <div key={group.clientId} style={{ marginBottom: 24 }}>

              {/* Client bar */}
              <div style={{
                background: '#595958',
                borderRadius: '8px 8px 0 0',
                padding: '7px 16px',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                color: '#fff',
                userSelect: 'none',
              }}>
                {group.clientName}
              </div>

              {/* Proof table */}
              <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 8px 8px' }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ ...thStyle, width: 32, padding: '6px 4px 6px 12px' }} />
                      <th style={thStyle}>Project</th>
                      <th style={thStyle}>Item</th>
                      <th style={{ ...thStyle, width: 80 }}>Proof</th>
                      <th style={{ ...thStyle, width: 110 }}>Status</th>
                      <th style={thStyle}>URL</th>
                      <th style={{ ...thStyle, width: 108 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map(proof => (
                      <Fragment key={proof.id}>

                        {/* Proof row */}
                        <tr
                          style={{ background: '#f2eaf4', cursor: 'pointer' }}
                          onClick={() => toggleDrawer(proof.id, proof.status)}
                        >
                          <td style={{ padding: '8px 4px 8px 12px', width: 32 }}>
                            <StatusIcon status={proof.status} />
                          </td>
                          <td>{proof.project_items?.projects?.name || '—'}</td>
                          <td>{proof.project_items?.name || '—'}</td>
                          <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 600 }}>
                            {proof.proof_number || '—'}
                          </td>
                          <td>{proof.status || '—'}</td>
                          <td style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {proof.url
                              ? <a href={proof.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color: 'var(--text2)', fontSize: 12 }}>{proof.url}</a>
                              : <span style={{ color: 'var(--text3)' }}>—</span>
                            }
                          </td>
                          <td style={{ padding: '8px 12px 8px 4px' }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                              <button
                                className="btn btn-ghost btn-icon btn-sm"
                                title="View proof"
                                style={{ color: 'var(--text3)', border: '1px solid #333' }}
                                onClick={() => proof.url && window.open(proof.url, '_blank')}
                              >
                                <ViewIcon />
                              </button>
                              <button
                                className="btn btn-ghost btn-icon btn-sm"
                                title="Delete proof"
                                style={{ color: 'var(--text3)', border: '1px solid #333' }}
                              >
                                <TrashIcon />
                              </button>
                              <button
                                className="btn btn-ghost btn-icon btn-sm"
                                title="Add new version"
                                style={{ color: 'var(--text3)', border: '1px solid #333' }}
                              >
                                <PlusIcon />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Comment drawer */}
                        {expandedProofId === proof.id && (
                          <tr style={{ background: '#faf5fb' }}>
                            <td colSpan={7} style={{ padding: 0, borderBottom: '1px solid #d5b6dd' }}>

                              {/* Controls row */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px' }}>

                                {/* View button */}
                                <button
                                  onClick={() => proof.url && window.open(proof.url, '_blank', 'noopener,noreferrer')}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: 5,
                                    opacity: proof.url ? 1 : 0.4,
                                    cursor: proof.url ? 'pointer' : 'default',
                                    border: '1px solid var(--border)', borderRadius: 6,
                                    padding: '4px 10px', background: 'none',
                                    fontSize: 13, color: 'var(--text)',
                                  }}
                                >
                                  <ViewIcon /> View
                                </button>

                                {/* Status toggles */}
                                <div style={{ display: 'flex', border: '1px solid #c9a6d4', borderRadius: 6, overflow: 'hidden' }}>
                                  {['Review', 'Revise', 'Approved'].map((s, i) => {
                                    const active = drawerStatus === s
                                    return (
                                      <button
                                        key={s}
                                        onClick={() => updateProofStatus(proof.id, s)}
                                        style={{
                                          padding: '4px 14px', fontSize: 13,
                                          border: 'none',
                                          borderRight: i < 2 ? '1px solid #c9a6d4' : 'none',
                                          background: active ? '#d5b6dd' : 'transparent',
                                          color: active ? '#fff' : 'var(--text)',
                                          cursor: 'pointer', fontWeight: active ? 600 : 400,
                                        }}
                                      >
                                        {s}
                                      </button>
                                    )
                                  })}
                                </div>

                                {/* Comment input */}
                                <input
                                  value={commentVal}
                                  onChange={e => setCommentVal(e.target.value)}
                                  onKeyDown={e => { if (e.key === 'Enter') submitComment(proof.id) }}
                                  placeholder="Comments"
                                  style={{
                                    flex: 1, background: 'var(--bg3)',
                                    border: '1px solid var(--border)', borderRadius: 6,
                                    padding: '5px 10px', fontSize: 13, color: 'var(--text)',
                                  }}
                                />

                                {/* Submit */}
                                <button
                                  className="btn btn-primary btn-sm"
                                  onClick={() => submitComment(proof.id)}
                                  style={{ fontSize: 13, minWidth: 68 }}
                                >
                                  {submitLabel}
                                </button>

                              </div>

                              {/* Comment thread */}
                              {(proofComments[proof.id] || []).length > 0 && (
                                <div style={{ borderTop: '1px solid #e8d8ef', padding: '0 16px' }}>
                                  {(proofComments[proof.id] || []).map((c, i) => {
                                    const roleLabel = c.profile?.role === 'client' ? 'Client' : 'Manager'
                                    const isLast    = i === (proofComments[proof.id].length - 1)
                                    return (
                                      <div
                                        key={c.id}
                                        style={{
                                          padding: '10px 0',
                                          borderBottom: isLast ? 'none' : '1px solid #e8d8ef',
                                        }}
                                      >
                                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>
                                          {roleLabel}
                                          <span style={{ fontWeight: 400, color: 'var(--text3)', marginLeft: 6 }}>
                                            {fmtCommentDate(c.created_at)}
                                          </span>
                                        </div>
                                        <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                                          {c.body}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}

                            </td>
                          </tr>
                        )}

                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>
          ))
        )}
      </div>
    </div>
  )
}
