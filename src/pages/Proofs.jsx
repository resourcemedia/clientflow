import { useState, useEffect, useRef, Fragment } from 'react'
import { useLocation } from 'react-router-dom'
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

function versionLabel(itemNumber, version) {
  return `${itemNumber}${String.fromCharCode(64 + version)}`
}

function fmtCommentDate(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`
}

// ── STATUS ICON ───────────────────────────────────────────────────────────────
function StatusIcon({ hasUrl }) {
  return (
    <svg width="25" height="25" viewBox="0 0 25 25" xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', opacity: hasUrl ? 1 : 0.35 }}>
      <circle cx="12.5" cy="12.5" r="12.5"/>
      <g>
        <path fill="#fff" d="M12.5,5.08c-4.57,0-8.28,3.16-8.28,7.07,0,2.27,1.26,4.29,3.21,5.59v3.57l2.67-2.4c.76.2,1.56.3,2.4.3,4.57,0,8.28-3.16,8.28-7.07s-3.71-7.07-8.28-7.07Z"/>
        <path d="M16.74,10.99h-8.48c-.28,0-.5-.22-.5-.5s.22-.5.5-.5h8.48c.28,0,.5.22.5.5s-.22.5-.5.5Z"/>
        <path d="M16.74,14.31h-8.48c-.28,0-.5-.22-.5-.5s.22-.5.5-.5h8.48c.28,0,.5.22.5.5s-.22.5-.5.5Z"/>
      </g>
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
  useEffect(() => { document.title = 'Proofs' }, [])
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
  const [editingUrlId,    setEditingUrlId]    = useState(null)
  const [urlDraft,        setUrlDraft]        = useState('')
  const urlDraftRef = useRef('')
  const [clientFilter,       setClientFilter]       = useState('')
  const [searchQuery,        setSearchQuery]        = useState('')
  const [editingCommentId,   setEditingCommentId]   = useState(null)
  const [editingCommentVal,  setEditingCommentVal]  = useState('')

  useEffect(() => {
    setLoading(true)
    setStatusFilter(null)
    setClientFilter('')
    setSearchQuery('')
    setExpandedProofId(null)
    setCommentVal('')
    setDrawerStatus('')
    load()
  }, [location.pathname])

  async function load() {
    setLoading(true)
    const { data: proofsData, error } = await supabase
      .from('proofs')
      .select(`
        id,
        version,
        status,
        url,
        image_url,
        project_items(
          id,
          name,
          item_number,
          projects(
            id,
            name,
            client_id,
            clients(company)
          )
        )
      `)
      .order('created_at', { ascending: false })
    if (error) console.error('proofs fetch error:', error.message)
    const clientMap = new Map()
    proofsData?.forEach(p => {
      const proj = p.project_items?.projects
      if (proj?.client_id) clientMap.set(proj.client_id, proj.clients?.company || proj.client_id)
    })
    setClientMap(clientMap)
    setProofs(proofsData || [])
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
      .select('*, profiles(name)')
      .eq('proof_id', proofId)
      .order('created_at', { ascending: true })
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
      .select('*, profiles(name)')
      .single()
    if (!data) return
    setCommentVal('')
    setSubmitLabel('Saved!')
    setTimeout(() => setSubmitLabel('Submit'), 1500)
    setProofComments(prev => ({ ...prev, [proofId]: [...(prev[proofId] || []), data] }))
  }

  async function deleteProof(proofId) {
    if (!window.confirm('Delete this proof? This cannot be undone.')) return
    await supabase.from('proofs').delete().eq('id', proofId)
    setProofs(ps => ps.filter(p => p.id !== proofId))
    if (expandedProofId === proofId) setExpandedProofId(null)
  }

  async function addProofVersion(proof) {
    const itemId = proof.project_items?.id
    if (!itemId) return
    const maxVersion = proofs
      .filter(p => p.project_items?.id === itemId)
      .reduce((max, p) => Math.max(max, p.version || 0), 0)
    await supabase.from('proofs').insert({ item_id: itemId, version: maxVersion + 1, status: 'Review', url: null })
    await load()
  }

  async function saveComment(proofId, commentId, newBody) {
    const trimmed = newBody.trim()
    if (!trimmed) return
    const { error } = await supabase.from('proof_comments').update({ body: trimmed }).eq('id', commentId)
    if (error) { console.error('saveComment failed:', error.message); return }
    setProofComments(prev => ({
      ...prev,
      [proofId]: (prev[proofId] || []).map(c => c.id === commentId ? { ...c, body: trimmed } : c),
    }))
    setEditingCommentId(null)
  }

  async function deleteComment(proofId, commentId) {
    if (!window.confirm('Delete this comment? This cannot be undone.')) return
    await supabase.from('proof_comments').delete().eq('id', commentId)
    setProofComments(prev => ({
      ...prev,
      [proofId]: (prev[proofId] || []).filter(c => c.id !== commentId),
    }))
  }

  // ── FILTER + GROUP ────────────────────────────────────────────────────────
  function toggleFilter(val) {
    setStatusFilter(f => f === val ? null : val)
  }

  const clientOptions = Array.from(clientMap.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const validProofs = proofs.filter(p =>
    p.project_items?.name &&
    p.project_items?.projects?.name &&
    p.project_items?.projects?.clients?.company
  )
  let filtered = statusFilter ? validProofs.filter(p => p.status === statusFilter) : validProofs
  if (clientFilter) {
    filtered = filtered.filter(p => p.project_items?.projects?.client_id === clientFilter)
  }
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase()
    filtered = filtered.filter(p => {
      const project = p.project_items?.projects?.name || ''
      const item    = p.project_items?.name || ''
      const ver     = p.project_items?.item_number && p.version
        ? versionLabel(p.project_items.item_number, p.version)
        : String(p.version || '')
      return [project, item, ver].join(' ').toLowerCase().includes(q)
    })
  }

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
      const ia = parseInt(a.project_items?.item_number, 10) || 0
      const ib = parseInt(b.project_items?.item_number, 10) || 0
      if (ia !== ib) return ia - ib
      return (a.version || 0) - (b.version || 0)
    })
  })
  clientGroups.sort((a, b) => a.clientName.localeCompare(b.clientName))

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="fade-in">
      <div className="topbar">
        <Breadcrumb segments={[{ label: 'Proofs' }]} />

        <select
          value={clientFilter}
          onChange={e => setClientFilter(e.target.value)}
          style={{
            background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 20,
            padding: '4px 10px', fontSize: 12, color: clientFilter ? 'var(--text)' : 'var(--text3)',
            outline: 'none', cursor: 'pointer',
          }}
        >
          <option value="">Client</option>
          {clientOptions.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Search"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 20,
            padding: '4px 10px', fontSize: 12, color: 'var(--text)',
            outline: 'none', width: 160,
          }}
        />

        <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 20, overflow: 'hidden', marginLeft: 'auto' }}>
          {STATUS_TABS.map((tab, i) => (
            <button
              key={tab.id}
              onClick={() => toggleFilter(tab.id)}
              style={{
                padding: '4px 14px', fontSize: 12, fontWeight: 500,
                cursor: 'pointer',
                border: 'none',
                borderLeft: i > 0 ? '1px solid var(--border)' : 'none',
                background: statusFilter === tab.id ? 'var(--accent)' : 'transparent',
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
                      <th style={{ ...thStyle, width: 80 }}>Version</th>
                      <th style={{ ...thStyle, width: 110 }}>Status</th>
                      <th style={thStyle}>URL</th>
                      <th style={{ ...thStyle, width: 108 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map(proof => (
                      <Fragment key={proof.id}>

                        {/* Proof row */}
                        <tr style={{ background: '#f2eaf4' }}>
                          <td
                            style={{ padding: '4px 4px 4px 8px', width: 32, cursor: 'pointer' }}
                            onClick={() => toggleDrawer(proof.id, proof.status)}
                          >
                            <div style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <StatusIcon hasUrl={!!proof.url} />
                            </div>
                          </td>
                          <td>{proof.project_items?.projects?.name || '—'}</td>
                          <td>{proof.project_items?.name || '—'}</td>
                          <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 600 }}>
                            {proof.version ? String.fromCharCode(64 + proof.version) : '—'}
                          </td>
                          <td onClick={e => e.stopPropagation()}>
                            <select
                              value={proof.status || 'Review'}
                              onChange={async e => {
                                const newStatus = e.target.value
                                await supabase.from('proofs').update({ status: newStatus }).eq('id', proof.id)
                                setProofs(ps => ps.map(p => p.id === proof.id ? { ...p, status: newStatus } : p))
                              }}
                              style={{
                                background: proof.status === 'Approved' ? '#22C55E'
                                  : proof.status === 'Revise' ? '#EF4444'
                                  : '#F59E0B',
                                border: 'none', borderRadius: 12,
                                padding: '3px 10px', fontSize: 12, fontWeight: 600,
                                color: '#fff', cursor: 'pointer', outline: 'none',
                                appearance: 'none', WebkitAppearance: 'none',
                              }}
                            >
                              <option value="Review">Review</option>
                              <option value="Revise">Revise</option>
                              <option value="Approved">Approved</option>
                            </select>
                          </td>
                          <td style={{ maxWidth: 260 }} onClick={e => e.stopPropagation()}>
                            {editingUrlId === proof.id ? (
                              <input
                                autoFocus
                                type="text"
                                value={urlDraft}
                                onChange={e => { setUrlDraft(e.target.value); urlDraftRef.current = e.target.value }}
                                onKeyDown={async e => {
                                  if (e.key === 'Enter') {
                                    const newUrl = urlDraftRef.current.trim()
                                    await supabase.from('proofs').update({ url: newUrl || null }).eq('id', proof.id)
                                    setProofs(ps => ps.map(p => p.id === proof.id ? { ...p, url: newUrl || null } : p))
                                    setEditingUrlId(null)
                                  } else if (e.key === 'Escape') {
                                    setEditingUrlId(null)
                                  }
                                }}
                                onBlur={async () => {
                                  const newUrl = urlDraftRef.current.trim()
                                  await supabase.from('proofs').update({ url: newUrl || null }).eq('id', proof.id)
                                  setProofs(ps => ps.map(p => p.id === proof.id ? { ...p, url: newUrl || null } : p))
                                  setEditingUrlId(null)
                                }}
                                style={{
                                  width: '100%', background: 'var(--bg3)',
                                  border: '1px solid var(--accent)', borderRadius: 6,
                                  padding: '3px 7px', fontSize: 12, color: 'var(--text)', outline: 'none',
                                }}
                              />
                            ) : proof.url ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5, overflow: 'hidden' }}>
                                <a
                                  href={proof.url} target="_blank" rel="noopener noreferrer"
                                  style={{ color: 'var(--text2)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}
                                >
                                  {proof.url}
                                </a>
                                <button
                                  onClick={() => { setEditingUrlId(proof.id); setUrlDraft(proof.url || ''); urlDraftRef.current = proof.url || '' }}
                                  style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 2, lineHeight: 1 }}
                                  title="Edit URL"
                                >
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                  </svg>
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => { setEditingUrlId(proof.id); setUrlDraft(''); urlDraftRef.current = '' }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 12, padding: 0 }}
                              >
                                + Add URL
                              </button>
                            )}
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
                                onClick={() => deleteProof(proof.id)}
                              >
                                <TrashIcon />
                              </button>
                              <button
                                className="btn btn-ghost btn-icon btn-sm"
                                title="Add new version"
                                style={{ color: 'var(--text3)', border: '1px solid #333' }}
                                onClick={() => addProofVersion(proof)}
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
                              <div style={{ display: 'flex', alignItems: 'flex-start' }}>

                                {/* ── left column: image area ── */}
                                <div style={{ width: 280, flexShrink: 0, padding: 16, borderRight: '1px solid #e8d8ef', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>

                                  {/* Click to View Proof */}
                                  <a
                                    href={proof.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ fontSize: 12, fontWeight: 600, color: '#000', textDecoration: 'none', cursor: proof.url ? 'pointer' : 'default' }}
                                  >Click to View Proof</a>

                                  {/* Thumbnail */}
                                  {proof.image_url && (
                                    <a href={proof.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', cursor: proof.url ? 'pointer' : 'default' }}>
                                      <img src={proof.image_url} alt="Proof thumbnail" style={{ width: 248, borderRadius: 6, display: 'block', border: '1px solid #e8d8ef' }} />
                                    </a>
                                  )}

                                  {/* Upload button */}
                                  <label style={{ cursor: 'pointer' }}>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      style={{ display: 'none' }}
                                      onChange={async e => {
                                        const file = e.target.files?.[0]
                                        if (!file) return
                                        const path = `proofs/${proof.id}/${file.name}`
                                        const { error: upErr } = await supabase.storage.from('proof-images').upload(path, file, { upsert: true })
                                        if (upErr) { console.error('Upload failed:', upErr.message); return }
                                        const { data: { publicUrl } } = supabase.storage.from('proof-images').getPublicUrl(path)
                                        await supabase.from('proofs').update({ image_url: publicUrl }).eq('id', proof.id)
                                        setProofs(ps => ps.map(p => p.id === proof.id ? { ...p, image_url: publicUrl } : p))
                                      }}
                                    />
                                    <span style={{ display: 'inline-block', padding: '4px 12px', fontSize: 12, fontWeight: 600, border: '1px solid #c9a6d4', borderRadius: 6, color: '#c9a6d4', background: 'none', cursor: 'pointer' }}>+ Add Image</span>
                                  </label>

                                </div>

                                {/* ── right column: comments ── */}
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>

                                  {/* Comment input row */}
                                  <div style={{ display: 'flex', gap: 8, padding: '10px 16px', borderBottom: '1px solid #e8d8ef' }}>
                                    <textarea
                                      value={commentVal}
                                      onChange={e => setCommentVal(e.target.value)}
                                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment(proof.id) } }}
                                      placeholder="Comments"
                                      rows={1}
                                      style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px', fontSize: 13, color: 'var(--text)', resize: 'none', lineHeight: '1.4', fontFamily: 'inherit' }}
                                    />
                                    <button className="btn btn-primary btn-sm" onClick={() => submitComment(proof.id)} style={{ fontSize: 13, minWidth: 68 }}>{submitLabel}</button>
                                  </div>

                                  {/* Comment thread */}
                                  {(proofComments[proof.id] || []).map(c => {
                                    const authorName = c.profiles?.name || 'Team'
                                    return (
                                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', borderBottom: '1px solid #e8d8ef' }}>
                                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#d5b6dd', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#fff', flexShrink: 0, userSelect: 'none' }}>
                                          {authorName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                                        </div>
                                        <span style={{ fontSize: 12, color: 'var(--text3)', flexShrink: 0 }}>{fmtCommentDate(c.created_at)}</span>
                                        <span style={{ fontSize: 13, color: 'var(--text)', flex: 1 }}>{c.body}</span>
                                        <button className="btn btn-ghost btn-icon btn-sm" title="Delete comment" onClick={() => deleteComment(proof.id, c.id)} style={{ color: 'var(--text3)', border: '1px solid #333', flexShrink: 0 }}><TrashIcon /></button>
                                      </div>
                                    )
                                  })}

                                </div>
                              </div>
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
