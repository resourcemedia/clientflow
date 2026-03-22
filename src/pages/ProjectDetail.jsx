import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { StatusBadge, Modal, FormGroup, Breadcrumb } from '../components/ui'

const ITEM_STATUSES  = ['Open', 'In Progress', 'Review', 'Revise', 'Approved', 'Complete', 'No Go']
const PROOF_STATUSES = ['Open', 'In Progress', 'Review', 'Revise', 'Approved', 'Complete', 'No Go']

function versionLabel(itemNumber, version) {
  return `${itemNumber}${String.fromCharCode(64 + version)}`
}

// ── MAIN PAGE ───────────────────────────────────────────────────────────────
export default function ProjectDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [project, setProject]   = useState(null)
  const [items, setItems]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [userRole, setUserRole] = useState('manager') // 'manager' | 'team' | 'client' | 'client_team'

  // view state machine
  const [view, setView]                 = useState('items') // 'items' | 'proofs' | 'proof-detail'
  const [selectedItem, setSelectedItem] = useState(null)
  const [selectedProof, setSelectedProof] = useState(null)

  // proofs keyed by item_id, loaded on demand
  const [proofsCache, setProofsCache] = useState({})

  // modals
  const [itemModal, setItemModal]   = useState(null) // null | 'new' | item object
  const [confirmDelete, setConfirmDelete] = useState(null) // null | { type, id, label }

  useEffect(() => { loadProject(); loadRole() }, [id])

  async function loadRole() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (data?.role) setUserRole(data.role)
  }

  async function loadProject() {
    setLoading(true)
    const [{ data: proj }, { data: itemRows }] = await Promise.all([
      supabase.from('projects').select('*, client:clients(id,company,alias)').eq('id', id).single(),
      supabase.from('project_items').select('*').eq('project_id', id).order('sort_order').order('item_number'),
    ])
    setProject(proj)
    setItems(itemRows || [])
    setLoading(false)
  }

  async function loadProofsForItem(itemId) {
    if (proofsCache[itemId]) return
    const { data } = await supabase
      .from('proofs')
      .select('*')
      .eq('item_id', itemId)
      .order('version')
    setProofsCache(c => ({ ...c, [itemId]: data || [] }))
  }

  // ── ITEM ACTIONS ────────────────────────────────────────────────────────────
  async function handleViewProofs(item) {
    setSelectedItem(item)
    await loadProofsForItem(item.id)
    setView('proofs')
  }

  async function syncCalendarEvent(itemId, form) {
    const clientName = project.client?.company || project.client?.alias || ''
    const title      = `${clientName} | ${project.name} | ${form.name.trim()}`
    const clientId   = project.client?.id || project.client_id

    if (form.scheduled_date) {
      const { data: existing } = await supabase
        .from('calendar_events')
        .select('id')
        .eq('item_id', itemId)
        .maybeSingle()

      if (existing) {
        await supabase.from('calendar_events').update({
          title,
          event_date: form.scheduled_date,
          channel:    project.product_type,
          client_id:  clientId,
        }).eq('id', existing.id)
      } else {
        await supabase.from('calendar_events').insert({
          item_id:    itemId,
          title,
          event_date: form.scheduled_date,
          channel:    project.product_type,
          client_id:  clientId,
          status:     'scheduled',
        })
      }
    } else {
      // scheduled_date cleared — remove any linked calendar event
      await supabase.from('calendar_events').delete().eq('item_id', itemId)
    }
  }

  async function handleSaveItem(form, existing) {
    const payload = {
      project_id:     id,
      item_number:    form.item_number.trim(),
      name:           form.name.trim(),
      scheduled_date: form.scheduled_date || null,
      status:         form.status,
      sort_order:     form.sort_order !== '' ? parseInt(form.sort_order, 10) : 0,
    }
    let savedItem = null
    if (existing) {
      const { data } = await supabase.from('project_items').update(payload).eq('id', existing.id).select().single()
      if (data) {
        setItems(its => its.map(i => i.id === existing.id ? data : i))
        if (selectedItem?.id === existing.id) setSelectedItem(data)
        savedItem = data
      }
    } else {
      const { data } = await supabase.from('project_items').insert(payload).select().single()
      if (data) {
        setItems(its => [...its, data])
        savedItem = data
      }
    }
    if (savedItem) await syncCalendarEvent(savedItem.id, form)
    setItemModal(null)
  }

  async function handleDeleteItem(itemId) {
    await supabase.from('project_items').delete().eq('id', itemId)
    setItems(its => its.filter(i => i.id !== itemId))
    setConfirmDelete(null)
    if (view !== 'items') setView('items')
  }

  // ── PROOF ACTIONS ───────────────────────────────────────────────────────────
  async function handleAddProof() {
    const existing = proofsCache[selectedItem.id] || []
    const nextVersion = existing.length + 1
    const { data } = await supabase.from('proofs').insert({
      project_id: id,
      item_id:    selectedItem.id,
      version:    nextVersion,
      status:     'Open',
    }).select().single()
    if (data) {
      setProofsCache(c => ({ ...c, [selectedItem.id]: [...(c[selectedItem.id] || []), data] }))
      setSelectedProof({ ...data })
      setView('proof-detail')
    }
  }

  async function handleViewProofDetail(proof) {
    setSelectedProof({ ...proof })
    setView('proof-detail')
  }

  async function handleSaveProofDetail(updatedProof) {
    const { error } = await supabase.from('proofs').update({
      proof_link:       updatedProof.proof_link       || null,
      image_url:        updatedProof.image_url        || null,
      post_copy:        updatedProof.post_copy        || null,
      client_comments:  updatedProof.client_comments  || null,
      status:           updatedProof.status,
    }).eq('id', updatedProof.id)
    if (!error) {
      setProofsCache(c => ({
        ...c,
        [selectedItem.id]: (c[selectedItem.id] || []).map(p =>
          p.id === updatedProof.id ? { ...p, ...updatedProof } : p
        ),
      }))
      setSelectedProof({ ...updatedProof })
    }
    return error
  }

  async function handleDeleteProof(proofId) {
    await supabase.from('proofs').delete().eq('id', proofId)
    setProofsCache(c => ({
      ...c,
      [selectedItem.id]: (c[selectedItem.id] || []).filter(p => p.id !== proofId),
    }))
    setConfirmDelete(null)
    if (selectedProof?.id === proofId) setView('proofs')
  }

  // ── RENDER ──────────────────────────────────────────────────────────────────
  if (loading) {
    return <div className="page-content"><div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text3)' }}>Loading…</div></div>
  }
  if (!project) {
    return <div className="page-content"><div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text3)' }}>Project not found.</div></div>
  }

  const clientName   = project.client?.company || project.client?.alias || '—'
  const projectLabel = [project.project_number, project.name].filter(Boolean).join(' ')

  return (
    <div className="fade-in">
      {/* Topbar breadcrumb */}
      <div className="topbar">
        <Breadcrumb segments={[
          { label: 'Projects', onClick: () => navigate('/projects') },
          project.client?.id
            ? { label: clientName, onClick: () => navigate(`/clients/${project.client.id}`) }
            : { label: clientName },
          view !== 'items'
            ? { label: projectLabel, onClick: () => setView('items') }
            : { label: projectLabel },
          ...(view === 'proofs' && selectedItem
            ? [{ label: `${selectedItem.item_number} ${selectedItem.name}` }]
            : []),
          ...(view === 'proof-detail' && selectedItem && selectedProof
            ? [
                { label: `${selectedItem.item_number} ${selectedItem.name}`, onClick: () => setView('proofs') },
                { label: `Proof ${versionLabel(selectedItem.item_number, selectedProof.version)}` },
              ]
            : []),
        ]} />
      </div>

      <div className="page-content">
        {/* Project header card */}

        {/* Items view */}
        {view === 'items' && (
          <ItemsSection
            clientId={project.client?.id || project.client_id}
            project={project}
            items={items}
            confirmDelete={confirmDelete}
            onViewProofs={handleViewProofs}
            onAddItem={() => setItemModal('new')}
            onEditItem={item => setItemModal(item)}
            onDeleteRequest={(item) => setConfirmDelete({ type: 'item', id: item.id, label: `${item.item_number} ${item.name}` })}
            onDeleteCancel={() => setConfirmDelete(null)}
            onDeleteConfirm={() => handleDeleteItem(confirmDelete.id)}
          />
        )}

        {/* Proofs view */}
        {view === 'proofs' && selectedItem && (
          <ProofsSection
            project={project}
            item={selectedItem}
            proofs={proofsCache[selectedItem.id] || []}
            confirmDelete={confirmDelete}
            onBack={() => setView('items')}
            onAddProof={handleAddProof}
            onViewProof={handleViewProofDetail}
            onEditProof={handleViewProofDetail}
            onDeleteRequest={(proof) => setConfirmDelete({ type: 'proof', id: proof.id, label: versionLabel(selectedItem.item_number, proof.version) })}
            onDeleteCancel={() => setConfirmDelete(null)}
            onDeleteConfirm={() => handleDeleteProof(confirmDelete.id)}
          />
        )}

        {/* Proof detail view */}
        {view === 'proof-detail' && selectedItem && selectedProof && (
          <ProofDetailSection
            item={selectedItem}
            proof={selectedProof}
            userRole={userRole}
            onBack={() => setView('proofs')}
            onSave={handleSaveProofDetail}
          />
        )}
      </div>

      {/* Item add/edit modal */}
      {itemModal && (
        <ItemModal
          item={itemModal === 'new' ? null : itemModal}
          items={items}
          onClose={() => setItemModal(null)}
          onSave={(form) => handleSaveItem(form, itemModal === 'new' ? null : itemModal)}
        />
      )}
    </div>
  )
}


// ── ITEMS SECTION ───────────────────────────────────────────────────────────
function ItemsSection({ clientId, project, items, confirmDelete, onViewProofs, onAddItem, onEditItem, onDeleteRequest, onDeleteCancel, onDeleteConfirm }) {
  const navigate = useNavigate()
  return (
    <div className="card">
      <div className="card-header">
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => navigate(clientId ? `/projects?client=${clientId}` : '/projects')}
        >
          ← Projects
        </button>
        <button className="btn btn-primary btn-sm" onClick={onAddItem}>+ Add item</button>
      </div>
      <div className="table-wrap">
        {items.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text3)' }}>
            No items yet — add one to get started.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 50 }}>#</th>
                <th style={{ width: 1, whiteSpace: 'nowrap' }}>Project #</th>
                <th style={{ width: 1, whiteSpace: 'nowrap' }}>Product</th>
                <th style={{ width: 1, whiteSpace: 'nowrap' }}>Project Name</th>
                <th>Item Name</th>
                <th style={{ width: 120 }}>Scheduled</th>
                <th style={{ width: 110 }}>Status</th>
                <th style={{ width: 1 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                confirmDelete?.type === 'item' && confirmDelete.id === item.id ? (
                  <tr key={item.id} style={{ background: 'var(--red-bg)' }}>
                    <td colSpan={7} style={{ padding: '10px 16px', color: 'var(--text2)', fontSize: 13 }}>
                      Delete <strong>{item.item_number} {item.name}</strong>? This cannot be undone.
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn btn-sm" style={{ background: 'var(--red)', color: '#fff', marginRight: 6 }} onClick={onDeleteConfirm}>Delete</button>
                      <button className="btn btn-ghost btn-sm" onClick={onDeleteCancel}>Cancel</button>
                    </td>
                  </tr>
                ) : (
                  <tr key={item.id} onClick={() => onViewProofs(item)} style={{ cursor: 'pointer' }}>
                    <td className="text-mono text-dim">{item.item_number}</td>
                    <td className="text-mono text-dim" style={{ whiteSpace: 'nowrap' }}>{project?.project_number || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{project?.product_type || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{project?.name || '—'}</td>
                    <td className="td-main">{item.name}</td>
                    <td className="text-mono text-dim">
                      {item.scheduled_date
                        ? (() => { const [y,m,d] = item.scheduled_date.slice(0,10).split('-'); return `${m}/${d}/${y.slice(2)}` })()
                        : '—'}
                    </td>
                    <td><StatusBadge status={item.status} /></td>
                    <td onClick={e => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn btn-ghost btn-sm" style={{ marginRight: 4 }} onClick={() => onViewProofs(item)}>
                        Proofs
                      </button>
                      <button className="btn btn-ghost btn-sm" style={{ marginRight: 4 }} title="Edit item" onClick={() => onEditItem(item)}>
                        ✏️
                      </button>
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} title="Delete item" onClick={() => onDeleteRequest(item)}>
                        🗑️
                      </button>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ── PROOFS SECTION ──────────────────────────────────────────────────────────
function ProofsSection({ project, item, proofs, confirmDelete, onBack, onAddProof, onViewProof, onEditProof, onDeleteRequest, onDeleteCancel, onDeleteConfirm }) {
  return (
    <div className="card">
      <div className="card-header">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>← Items</button>
        <button className="btn btn-primary btn-sm" onClick={onAddProof}>+ Add proof</button>
      </div>
      <div className="table-wrap">
        {proofs.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text3)' }}>
            No proofs yet — add one to start the approval cycle.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 1, whiteSpace: 'nowrap' }}>Project</th>
                <th style={{ width: 1, whiteSpace: 'nowrap' }}>Item</th>
                <th style={{ width: 70 }}>Version</th>
                <th style={{ width: 120 }}>Status</th>
                <th style={{ width: 1 }}></th>
              </tr>
            </thead>
            <tbody>
              {proofs.map(proof => (
                confirmDelete?.type === 'proof' && confirmDelete.id === proof.id ? (
                  <tr key={proof.id} style={{ background: 'var(--red-bg)' }}>
                    <td colSpan={4} style={{ padding: '10px 16px', color: 'var(--text2)', fontSize: 13 }}>
                      Delete proof <strong>{versionLabel(item.item_number, proof.version)}</strong>? This cannot be undone.
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn btn-sm" style={{ background: 'var(--red)', color: '#fff', marginRight: 6 }} onClick={onDeleteConfirm}>Delete</button>
                      <button className="btn btn-ghost btn-sm" onClick={onDeleteCancel}>Cancel</button>
                    </td>
                  </tr>
                ) : (
                  <tr key={proof.id} onClick={() => onViewProof(proof)} style={{ cursor: 'pointer' }}>
                    <td style={{ whiteSpace: 'nowrap' }}>{project?.name || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{item.item_number} {item.name}</td>
                    <td className="text-mono" style={{ fontWeight: 600 }}>{versionLabel(item.item_number, proof.version)}</td>
                    <td><StatusBadge status={proof.status} /></td>
                    <td onClick={e => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn btn-ghost btn-sm" style={{ marginRight: 4 }} title="Edit proof" onClick={() => onEditProof(proof)}>✏️</button>
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} title="Delete proof" onClick={() => onDeleteRequest(proof)}>🗑️</button>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ── PROOF DETAIL SECTION ────────────────────────────────────────────────────
function ProofDetailSection({ item, proof, userRole, onBack, onSave }) {
  const [form, setForm]     = useState({ ...proof })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [error, setError]   = useState('')

  const isClient      = userRole === 'client' || userRole === 'client_team'
  const isManager     = !isClient
  const hasProofLink  = !!(form.proof_link)
  const hasSocialMedia = !!(form.image_url || form.post_copy)
  // Client sees proof link only if no social media content, and vice versa
  const showProofLink   = isManager || !hasSocialMedia
  const showSocialMedia = isManager || !hasProofLink

  function set(field) {
    return e => { setForm(f => ({ ...f, [field]: e.target.value })); setSaved(false) }
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    const err = await onSave(form)
    setSaving(false)
    if (err) setError(err.message)
    else setSaved(true)
  }

  const inputStyle = { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0.55rem 0.75rem', color: 'var(--text)', fontSize: '0.875rem' }
  const vLabel = versionLabel(item.item_number, proof.version)

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">
          Proof Details —&nbsp;
          <span className="text-mono" style={{ fontWeight: 700, fontSize: 14 }}>{vLabel}</span>
        </span>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>← Proofs</button>
      </div>

      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 720 }}>
        {/* Proof Link — hidden from clients when social media is present */}
        {showProofLink && (
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text2)', marginBottom: 6, fontWeight: 500 }}>
              Proof Link
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={form.proof_link || ''}
                onChange={set('proof_link')}
                placeholder="Google Drive URL, webpage, PDF link…"
                readOnly={isClient}
                style={{ flex: 1, ...inputStyle }}
              />
              <button
                className="btn btn-ghost btn-sm"
                disabled={!form.proof_link}
                onClick={() => form.proof_link && window.open(form.proof_link, '_blank', 'noreferrer')}
              >
                Open
              </button>
            </div>
          </div>
        )}

        {/* Social media block — hidden from clients when proof link is present */}
        {showSocialMedia && (
          <>
            {/* Proof Image URL + preview */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text2)', marginBottom: 6, fontWeight: 500 }}>
                Proof Image
              </label>
              {isManager ? (
                <input
                  value={form.image_url || ''}
                  onChange={set('image_url')}
                  placeholder="Paste image URL…"
                  style={{ width: '100%', ...inputStyle }}
                />
              ) : null}
              {form.image_url && (
                <div style={{ marginTop: isManager ? 8 : 0, border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', maxWidth: 420 }}>
                  <img src={form.image_url} alt="Proof" style={{ width: '100%', display: 'block' }} onError={e => { e.target.style.display = 'none' }} />
                </div>
              )}
            </div>

            {/* Post copy */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text2)', marginBottom: 6, fontWeight: 500 }}>
                Post Copy
              </label>
              <textarea
                value={form.post_copy || ''}
                onChange={set('post_copy')}
                placeholder="Enter social media post copy…"
                readOnly={isClient}
                rows={4}
                style={{ width: '100%', ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>
          </>
        )}

        {/* Status */}
        <div style={{ maxWidth: 220 }}>
          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text2)', marginBottom: 6, fontWeight: 500 }}>
            Status
          </label>
          <select
            value={form.status}
            onChange={set('status')}
            style={{ width: '100%', ...inputStyle }}
          >
            {PROOF_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Client comments */}
        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text2)', marginBottom: 6, fontWeight: 500 }}>
            Comments / Revisions
          </label>
          <textarea
            value={form.client_comments || ''}
            onChange={set('client_comments')}
            placeholder="Client feedback and revision notes…"
            rows={3}
            style={{ width: '100%', ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>

        {/* Save row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 4 }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          {saved  && <span style={{ fontSize: 12, color: 'var(--green)' }}>Saved</span>}
          {error  && <span style={{ fontSize: 12, color: 'var(--red)' }}>{error}</span>}
        </div>
      </div>
    </div>
  )
}

// ── ITEM MODAL ──────────────────────────────────────────────────────────────
function ItemModal({ item, items, onClose, onSave }) {
  const isEdit = !!item

  // Auto-generate item number: next after highest existing number
  const nextNumber = (() => {
    const nums = items.map(i => parseInt(i.item_number, 10)).filter(n => !isNaN(n))
    const next = nums.length ? Math.max(...nums) + 1 : 1
    return String(next).padStart(2, '0')
  })()

  const [form, setForm] = useState({
    item_number:    item?.item_number    ?? nextNumber,
    name:           item?.name           || '',
    scheduled_date: item?.scheduled_date || '',
    status:         item?.status         || 'Open',
    sort_order:     item?.sort_order     != null ? String(item.sort_order) : '',
  })
  const [saving, setSaving] = useState(false)

  function set(field) { return e => setForm(f => ({ ...f, [field]: e.target.value })) }

  async function handleSave() {
    if (!form.item_number.trim() || !form.name.trim()) return
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  return (
    <Modal
      title={isEdit ? `Edit item — ${item.item_number} ${item.name}` : 'Add item'}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add item'}
          </button>
        </>
      }
    >
      <div className="form-grid" style={{ padding: '20px 24px' }}>
        <FormGroup label="Item #">
          <input value={form.item_number} onChange={set('item_number')} placeholder="01" />
        </FormGroup>
        <FormGroup label="Name">
          <input value={form.name} onChange={set('name')} placeholder="e.g. Front, Home Page, Post 1" />
        </FormGroup>
        <FormGroup label="Scheduled date">
          <input type="date" value={form.scheduled_date} onChange={set('scheduled_date')} />
        </FormGroup>
        <FormGroup label="Status">
          <select value={form.status} onChange={set('status')}>
            {ITEM_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </FormGroup>
        <FormGroup label="Sort order">
          <input type="number" value={form.sort_order} onChange={set('sort_order')} placeholder="0" />
        </FormGroup>
      </div>
    </Modal>
  )
}
