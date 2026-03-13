import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { DEMO_CLIENTS, CLIENT_STATUSES } from '../lib/demo-data'
import { Badge, StatusBadge, Modal, EmptyState, StatCard, FormGroup, initials } from '../components/ui'

const isDemo = !import.meta.env.VITE_SUPABASE_URL

export default function ClientsPage() {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editClient, setEditClient] = useState(null)
  const [search, setSearch] = useState('')
  const navigate = useNavigate()

  useEffect(() => { loadClients() }, [])

  async function loadClients() {
    setLoading(true)
    if (isDemo) {
      setClients(DEMO_CLIENTS)
    } else {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('company')
      if (!error) setClients(data || [])
    }
    setLoading(false)
  }

  const filtered = clients.filter(c =>
    c.company.toLowerCase().includes(search.toLowerCase()) ||
    (c.alias || '').toLowerCase().includes(search.toLowerCase())
  )

  const active = clients.filter(c => c.status === 'active').length

  function openAdd()  { setEditClient(null); setShowModal(true) }
  function openEdit(c) { setEditClient(c); setShowModal(true) }

  return (
    <div className="fade-in">
      {/* Topbar */}
      <div className="topbar">
        <div className="topbar-title">Clients</div>
        <input
          type="text"
          placeholder="Search clients…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: 220 }}
        />
        <button className="btn btn-primary" onClick={openAdd}>+ Add client</button>
      </div>

      <div className="page-content">
        {/* Stats */}
        <div className="stat-grid mb-24">
          <StatCard label="Total clients"   value={clients.length}       color="blue" />
          <StatCard label="Active"           value={active}               color="green" />
          <StatCard label="Inactive"         value={clients.length - active} color="amber" />
          <StatCard label="With Facebook"    value={clients.filter(c => c.facebook_url).length} color="accent" />
        </div>

        {/* Table */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">All clients</span>
            <span className="text-dim text-sm">{filtered.length} showing</span>
          </div>
          <div className="table-wrap">
            {loading ? (
              <div className="empty-state"><div className="text-dim">Loading…</div></div>
            ) : filtered.length === 0 ? (
              <EmptyState icon="👤" title="No clients found" sub="Add your first client to get started" action={
                <button className="btn btn-primary" onClick={openAdd}>+ Add client</button>
              } />
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Alias</th>
                    <th>Facebook</th>
                    <th>Google Drive</th>
                    <th>Status</th>
                    <th>Added</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(client => (
                    <tr key={client.id} onClick={() => navigate(`/clients/${client.id}`)}>
                      <td>
                        <div className="flex-center gap-12">
                          <div className="client-avatar" style={{
                            width: 34, height: 34, borderRadius: 8,
                            background: 'var(--accent-glow)',
                            border: '1px solid var(--accent)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 12, fontWeight: 700, color: 'var(--accent2)',
                            flexShrink: 0
                          }}>
                            {initials(client.alias || client.company)}
                          </div>
                          <div>
                            <div className="td-main">{client.company}</div>
                            <div className="text-dim text-xs">{client.email || '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td>{client.alias || '—'}</td>
                      <td>
                        {client.facebook_url
                          ? <Badge variant="blue">Linked</Badge>
                          : <Badge variant="gray">Not set</Badge>}
                      </td>
                      <td>
                        {client.google_drive_url
                          ? <Badge variant="green">Linked</Badge>
                          : <Badge variant="gray">Not set</Badge>}
                      </td>
                      <td><StatusBadge status={client.status} /></td>
                      <td className="text-mono text-dim">{client.created_at?.slice(0, 10) || '—'}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(client)}>Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <ClientModal
          client={editClient}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); loadClients() }}
        />
      )}
    </div>
  )
}

// ── CLIENT MODAL ────────────────────────────────────────────────────────
function ClientModal({ client, onClose, onSaved }) {
  const isEdit = !!client
  const [form, setForm] = useState({
    company: client?.company || '',
    alias: client?.alias || '',
    email: client?.email || '',
    facebook_url: client?.facebook_url || '',
    google_drive_url: client?.google_drive_url || '',
    status: client?.status || 'active',
    transition_status: client?.transition_status || '',
    notes: client?.notes || '',
  })
  const [saving, setSaving] = useState(false)

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function save() {
    if (!form.company.trim()) return
    setSaving(true)
    if (isDemo) {
      // In demo mode just close — no real save
      setTimeout(() => { setSaving(false); onSaved() }, 400)
      return
    }
    const payload = { ...form, updated_at: new Date().toISOString() }
    if (isEdit) {
      await supabase.from('clients').update(payload).eq('id', client.id)
    } else {
      await supabase.from('clients').insert(payload)
    }
    setSaving(false)
    onSaved()
  }

  return (
    <Modal
      title={isEdit ? `Edit — ${client.company}` : 'Add new client'}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add client'}
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
          <textarea value={form.notes} onChange={set('notes')} placeholder="Internal notes about this client…" rows={3} />
        </FormGroup>
      </div>
    </Modal>
  )
}
