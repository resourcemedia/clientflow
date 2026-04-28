import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
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
  const [proofs,       setProofs]       = useState([])
  const [loading,      setLoading]      = useState(true)
  const [statusFilter, setStatusFilter] = useState('Review')

  useEffect(() => { setLoading(true); load() }, [location.pathname])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('proofs')
      .select(`
        id, proof_number, status, url,
        item:project_items(
          name,
          project:projects(
            name, client_id,
            client:clients(name)
          )
        )
      `)
      .order('created_at', { ascending: false })
    setProofs(data || [])
    setLoading(false)
  }

  function toggleFilter(val) {
    setStatusFilter(f => f === val ? null : val)
  }

  // null = show all
  const filtered = statusFilter ? proofs.filter(p => p.status === statusFilter) : proofs

  // Group by client, sort within each group by project name then proof_number
  const groupMap = filtered.reduce((acc, proof) => {
    const clientId   = proof.item?.project?.client_id || '__none__'
    const clientName = proof.item?.project?.client?.name || '—'
    if (!acc[clientId]) acc[clientId] = { clientId, clientName, rows: [] }
    acc[clientId].rows.push(proof)
    return acc
  }, {})

  const clientGroups = Object.values(groupMap)
  clientGroups.forEach(group => {
    group.rows.sort((a, b) => {
      const pa = a.item?.project?.name || ''
      const pb = b.item?.project?.name || ''
      if (pa !== pb) return pa.localeCompare(pb)
      return (a.proof_number || '').localeCompare(b.proof_number || '')
    })
  })
  clientGroups.sort((a, b) => a.clientName.localeCompare(b.clientName))

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
                      <tr key={proof.id} style={{ background: '#f2eaf4' }}>
                        <td style={{ padding: '8px 4px 8px 12px', width: 32 }}>
                          <StatusIcon status={proof.status} />
                        </td>
                        <td>{proof.item?.project?.name || '—'}</td>
                        <td>{proof.item?.name || '—'}</td>
                        <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 600 }}>
                          {proof.proof_number || '—'}
                        </td>
                        <td>{proof.status || '—'}</td>
                        <td style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {proof.url
                            ? <a href={proof.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text2)', fontSize: 12 }}>{proof.url}</a>
                            : <span style={{ color: 'var(--text3)' }}>—</span>
                          }
                        </td>
                        <td style={{ padding: '8px 12px 8px 4px' }}>
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
