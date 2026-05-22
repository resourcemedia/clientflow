import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { DEMO_CLIENTS, CLIENT_STATUSES } from '../lib/demo-data'
import { Modal, FormGroup, initials, Breadcrumb, fmt$ } from '../components/ui'

const isDemo = !import.meta.env.VITE_SUPABASE_URL

export default function ClientsPage() {
  useEffect(() => { document.title = 'Clients | ClientFlow' }, [])
  const [clients, setClients]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [editClient, setEditClient] = useState(null)
  const [search, setSearch]       = useState('')
  const [addingRow, setAddingRow] = useState(null) // null | {company:'', alias:''}
  const [dragIdx, setDragIdx]     = useState(null)
  const [dragOverIdx, setDragOverIdx] = useState(null)
  const [editingRateId, setEditingRateId] = useState(null)
  const [editRateVal,   setEditRateVal]   = useState('')
  const editRateRef = useRef('')
  const addInputRef = useRef(null)
  const navigate = useNavigate()

  function startEditRate(client) {
    setEditingRateId(client.id)
    const val = client.hourly_rate != null ? String(client.hourly_rate) : ''
    setEditRateVal(val)
    editRateRef.current = val
  }

  async function commitRate(clientId) {
    setEditingRateId(null)
    const num = parseFloat(editRateRef.current)
    const rate = isNaN(num) ? 0 : num
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, hourly_rate: rate } : c))
    if (!isDemo) await supabase.from('clients').update({ hourly_rate: rate }).eq('id', clientId)
  }

  useEffect(() => { loadClients() }, [])

  useEffect(() => {
    if (addingRow !== null) addInputRef.current?.focus()
  }, [addingRow])

  async function loadClients() {
    setLoading(true)
    if (isDemo) {
      setClients(DEMO_CLIENTS)
    } else {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('company')
      if (error) console.error('clients load error:', error)
      setClients(data || [])
    }
    setLoading(false)
  }

  const q = search.toLowerCase()
  const filtered = clients.filter(c =>
    (c.company || '').toLowerCase().includes(q) ||
    (c.alias   || '').toLowerCase().includes(q)
  )

  // ── inline add ──────────────────────────────────────────────────────────
  function startAdd() {
    setAddingRow({ company: '', alias: '', hourly_rate: '' })
  }

  async function handleAddSave() {
    const company = addingRow?.company?.trim()
    if (!company) { setAddingRow(null); return }
    if (isDemo)   { setAddingRow(null); return }
    const { data } = await supabase
      .from('clients')
      .insert({
        company,
        alias:       addingRow.alias?.trim() || null,
        hourly_rate: addingRow.hourly_rate !== '' ? Number(addingRow.hourly_rate) : 0,
        status:      'active',
      })
      .select()
      .single()
    if (data) setClients(prev => [...prev, data])
    setAddingRow(null)
  }

  function handleAddKeyDown(e) {
    if (e.key === 'Enter')  handleAddSave()
    if (e.key === 'Escape') setAddingRow(null)
  }

  // ── drag-and-drop ───────────────────────────────────────────────────────
  function handleDragStart(e, idx) {
    e.dataTransfer.effectAllowed = 'move'
    setDragIdx(idx)
  }

  function handleDragOver(e, idx) {
    e.preventDefault()
    setDragOverIdx(idx)
  }

  async function handleDrop(toIdx) {
    if (dragIdx === null || dragIdx === toIdx) { reset(); return }
    const reordered = [...filtered]
    const [moved] = reordered.splice(dragIdx, 1)
    reordered.splice(toIdx, 0, moved)
    // Merge reordered filtered back into full clients list preserving non-filtered
    setClients(reordered)
    reset()
    reordered.forEach((c, i) => {
      supabase.from('clients').update({ sort_order: i }).eq('id', c.id).then(() => {})
    })
  }

  function reset() { setDragIdx(null); setDragOverIdx(null) }

  // ── render ───────────────────────────────────────────────────────────────
  return (
    <div className="fade-in">
      <div className="topbar">
        <Breadcrumb segments={[
          { label: 'Dashboard', onClick: () => navigate('/') },
          { label: 'Clients' },
        ]} />
        <input
          type="text"
          placeholder="Filter clients…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: 220 }}
        />
        <button className="btn btn-ghost" onClick={startAdd}>+ Add client</button>
      </div>

      <div className="page-content">
        <div className="card">
          <div className="table-wrap">
            {loading ? (
              <div className="empty-state"><div className="text-dim">Loading…</div></div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 24 }}></th>
                    <th>Client</th>
                    <th style={{ width: 110, textAlign: 'right' }}>Hourly Rate</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((client, idx) => (
                    <tr
                      key={client.id}
                      draggable
                      onDragStart={e => handleDragStart(e, idx)}
                      onDragOver={e => handleDragOver(e, idx)}
                      onDrop={() => handleDrop(idx)}
                      onDragEnd={reset}
                      style={{
                        opacity: dragIdx === idx ? 0.4 : 1,
                        outline: dragOverIdx === idx && dragIdx !== idx
                          ? '2px solid var(--accent)' : undefined,
                      }}
                    >
                      {/* Drag handle */}
                      <td style={{
                        cursor: 'grab', color: 'var(--text3)',
                        fontSize: 15, userSelect: 'none', paddingRight: 0,
                      }}>
                        ⠿
                      </td>

                      {/* Client name */}
                      <td>
                        <div className="flex-center gap-12">
                          <div style={{
                            width: 32, height: 32, borderRadius: 8,
                            background: 'var(--accent-glow)',
                            border: '1px solid var(--accent)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 700, color: 'var(--accent2)', flexShrink: 0,
                          }}>
                            {initials(client.alias || client.company)}
                          </div>
                          <div>
                            <div className="td-main">{client.company}</div>
                            {client.alias && <div className="text-dim text-xs">{client.alias}</div>}
                          </div>
                        </div>
                      </td>

                      {/* Hourly rate */}
                      <td style={{ textAlign: 'right', paddingRight: 16, whiteSpace: 'nowrap' }}>
                        {editingRateId === client.id ? (
                          <input
                            autoFocus
                            type="number"
                            min="0"
                            step="0.01"
                            value={editRateVal}
                            onChange={e => { setEditRateVal(e.target.value); editRateRef.current = e.target.value }}
                            onBlur={() => commitRate(client.id)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') e.target.blur()
                              if (e.key === 'Escape') setEditingRateId(null)
                            }}
                            style={{ width: 90, textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: 13 }}
                          />
                        ) : (
                          <span
                            onClick={() => startEditRate(client)}
                            style={{ cursor: 'text', fontFamily: 'DM Mono, monospace', fontSize: 13, color: client.hourly_rate ? 'var(--text2)' : 'var(--text3)' }}
                          >
                            {client.hourly_rate ? fmt$(client.hourly_rate) : '—'}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td onClick={e => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ marginRight: 4 }}
                          onClick={() => navigate(`/clients/${client.id}/account`)}
                        >
                          Account
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ marginRight: 4 }}
                          onClick={() => navigate(`/projects?client=${client.id}`)}
                        >
                          Projects
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ marginRight: 4 }}
                          title="Edit client"
                          onClick={() => setEditClient(client)}
                        >
                          ✏️
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          title="Add new client"
                          onClick={startAdd}
                        >
                          +
                        </button>
                      </td>
                    </tr>
                  ))}

                  {/* Inline add row */}
                  {addingRow !== null && (
                    <tr style={{ background: 'var(--accent-glow)' }}>
                      <td></td>
                      <td>
                        <input
                          ref={addInputRef}
                          value={addingRow.company}
                          onChange={e => setAddingRow(r => ({ ...r, company: e.target.value }))}
                          placeholder="Client name…"
                          onKeyDown={handleAddKeyDown}
                          style={{ width: '100%' }}
                        />
                      </td>
                      <td style={{ padding: '7px 8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ color: 'var(--text3)', fontSize: 13 }}>$</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={addingRow.hourly_rate}
                            onChange={e => setAddingRow(r => ({ ...r, hourly_rate: e.target.value }))}
                            placeholder="0.00"
                            onKeyDown={handleAddKeyDown}
                            style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 7px', color: 'var(--text)', fontSize: 13, textAlign: 'right' }}
                          />
                        </div>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="btn btn-primary btn-sm" style={{ marginRight: 4 }} onClick={handleAddSave}>
                          Save
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setAddingRow(null)}>
                          Cancel
                        </button>
                      </td>
                    </tr>
                  )}

                  {/* Empty state row */}
                  {filtered.length === 0 && addingRow === null && (
                    <tr>
                      <td colSpan={4} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text3)' }}>
                        No clients found.{' '}
                        <button className="btn btn-ghost btn-sm" onClick={startAdd}>
                          + Add first client
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Edit modal */}
      {editClient && (
        <ClientModal
          client={editClient}
          onClose={() => setEditClient(null)}
          onSaved={() => { setEditClient(null); loadClients() }}
        />
      )}
    </div>
  )
}

// ── CLIENT EDIT MODAL ────────────────────────────────────────────────────
function ClientModal({ client, onClose, onSaved }) {
  const [form, setForm] = useState({
    company:           client?.company           || '',
    alias:             client?.alias             || '',
    email:             client?.email             || '',
    facebook_url:      client?.facebook_url      || '',
    google_drive_url:  client?.google_drive_url  || '',
    hourly_rate:       client?.hourly_rate       ?? '',
    status:            client?.status            || 'active',
    transition_status: client?.transition_status || '',
    notes:             client?.notes             || '',
  })
  const [saving, setSaving] = useState(false)

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function save() {
    if (!form.company.trim()) return
    setSaving(true)
    if (isDemo) {
      setTimeout(() => { setSaving(false); onSaved() }, 400)
      return
    }
    const payload = {
      ...form,
      hourly_rate: form.hourly_rate !== '' ? Number(form.hourly_rate) : 0,
      updated_at:  new Date().toISOString(),
    }
    await supabase.from('clients').update(payload).eq('id', client.id)
    setSaving(false)
    onSaved()
  }

  return (
    <Modal
      title={`Edit — ${client.company}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <FormGroup label="Company name" full>
          <input value={form.company} onChange={set('company')} placeholder="e.g. Arrow Auto Glass" />
        </FormGroup>
        <FormGroup label="Alias / short name">
          <input value={form.alias} onChange={set('alias')} placeholder="e.g. Arrow" />
        </FormGroup>
        <FormGroup label="Hourly Rate">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'var(--text3)', fontSize: 14 }}>$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.hourly_rate}
              onChange={set('hourly_rate')}
              placeholder="0.00"
              style={{ flex: 1 }}
            />
          </div>
        </FormGroup>
        <FormGroup label="Email">
          <input type="email" value={form.email} onChange={set('email')} placeholder="client@domain.com" />
        </FormGroup>
        <FormGroup label="Facebook URL">
          <input value={form.facebook_url} onChange={set('facebook_url')} placeholder="https://facebook.com/…" />
        </FormGroup>
        <FormGroup label="Google Drive folder URL">
          <input value={form.google_drive_url} onChange={set('google_drive_url')} placeholder="https://drive.google.com/…" />
        </FormGroup>
        <FormGroup label="Status">
          <select value={form.status} onChange={set('status')}>
            {CLIENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </FormGroup>
        <FormGroup label="Transition status">
          <input value={form.transition_status} onChange={set('transition_status')} placeholder="e.g. In Progress" />
        </FormGroup>
        <FormGroup label="Notes" full>
          <textarea value={form.notes} onChange={set('notes')} placeholder="Internal notes…" rows={3} />
        </FormGroup>
      </div>
    </Modal>
  )
}
