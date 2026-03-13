import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { DEMO_INVOICES, DEMO_CLIENTS, DEMO_PROJECTS } from '../lib/demo-data'
import { Badge, Modal, EmptyState, StatCard, PillNav, FormGroup, fmt$ } from '../components/ui'

const isDemo = !import.meta.env.VITE_SUPABASE_URL

const TABS = [
  { id: 'invoices', label: 'Invoices' },
  { id: 'summary',  label: 'Revenue summary' },
]

const STATUS_COLORS = {
  Open:    { bg: 'var(--blue-bg)',   color: 'var(--blue)',   label: 'Open'    },
  Sent:    { bg: 'var(--amber-bg)',  color: 'var(--amber)',  label: 'Sent'    },
  Paid:    { bg: 'var(--green-bg)',  color: 'var(--green)',  label: 'Paid'    },
  Overdue: { bg: 'var(--red-bg)',    color: 'var(--red)',    label: 'Overdue' },
}

export default function BillingPage() {
  const [invoices, setInvoices] = useState([])
  const [clients, setClients]   = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState('invoices')
  const [showModal, setShowModal] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    if (isDemo) {
      setInvoices(DEMO_INVOICES)
      setClients(DEMO_CLIENTS)
      setProjects(DEMO_PROJECTS)
    } else {
      const [{ data: inv }, { data: cl }, { data: pr }] = await Promise.all([
        supabase.from('invoices').select('*, client:clients(company), project:projects(name)').order('issued_date', { ascending: false }),
        supabase.from('clients').select('id,company,alias').eq('status','active').order('company'),
        supabase.from('projects').select('id,name').order('name'),
      ])
      setInvoices(inv || [])
      setClients(cl || [])
      setProjects(pr || [])
    }
    setLoading(false)
  }

  async function updateStatus(id, status) {
    const update = { status, ...(status === 'Paid' ? { paid_date: new Date().toISOString().slice(0,10) } : {}) }
    if (!isDemo) await supabase.from('invoices').update(update).eq('id', id)
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, ...update } : i))
  }

  // Financial calculations
  const outstanding = invoices.filter(i => i.status !== 'Paid').reduce((s, i) => s + (i.amount || 0), 0)
  const paidMTD     = invoices.filter(i => i.status === 'Paid' && i.paid_date?.startsWith('2026-03')).reduce((s, i) => s + (i.amount || 0), 0)
  const invoicedMTD = invoices.filter(i => i.issued_date?.startsWith('2026-03')).reduce((s, i) => s + (i.amount || 0), 0)
  const overdue     = invoices.filter(i => i.status === 'Overdue')

  const filtered = statusFilter === 'all' ? invoices : invoices.filter(i => i.status === statusFilter)

  // Revenue by client for summary
  const byClient = {}
  invoices.forEach(inv => {
    const name = inv.client?.company || 'Unknown'
    if (!byClient[name]) byClient[name] = { invoiced: 0, collected: 0, outstanding: 0, count: 0 }
    byClient[name].invoiced    += inv.amount || 0
    byClient[name].count++
    if (inv.status === 'Paid') byClient[name].collected  += inv.amount || 0
    else                       byClient[name].outstanding += inv.amount || 0
  })

  return (
    <div className="fade-in">
      <div className="topbar">
        <div className="topbar-title">Billing</div>
        <PillNav tabs={TABS} active={tab} onChange={setTab} />
        {tab === 'invoices' && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ New invoice</button>
        )}
      </div>

      <div className="page-content">
        {/* Stats */}
        <div className="stat-grid mb-24">
          <StatCard label="Outstanding"  value={fmt$(outstanding)} color="amber" />
          <StatCard label="Paid (MTD)"   value={fmt$(paidMTD)}    color="green" />
          <StatCard label="Invoiced MTD" value={fmt$(invoicedMTD)} color="blue"  />
          <StatCard label="Overdue"      value={overdue.length}    color="red"
            delta={overdue.length > 0 ? `${overdue.length} invoice${overdue.length > 1 ? 's' : ''} past due` : null} />
        </div>

        {tab === 'invoices' ? (
          <InvoicesView
            invoices={filtered}
            loading={loading}
            statusFilter={statusFilter}
            onFilterChange={setStatusFilter}
            onStatusUpdate={updateStatus}
          />
        ) : (
          <SummaryView byClient={byClient} invoices={invoices} />
        )}
      </div>

      {showModal && (
        <NewInvoiceModal
          clients={clients}
          projects={projects}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}

// ── INVOICES VIEW ─────────────────────────────────────────────────────────────
function InvoicesView({ invoices, loading, statusFilter, onFilterChange, onStatusUpdate }) {
  return (
    <>
      {/* Status filter chips */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['all', 'Open', 'Sent', 'Overdue', 'Paid'].map(s => {
          const col = STATUS_COLORS[s] || { bg: 'var(--bg3)', color: 'var(--text2)' }
          const isActive = statusFilter === s
          return (
            <button key={s} onClick={() => onFilterChange(s)} style={{
              padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
              cursor: 'pointer', border: `1px solid ${isActive ? (col.color || 'var(--border)') : 'var(--border)'}`,
              background: isActive ? (col.bg || 'var(--bg3)') : 'transparent',
              color: isActive ? (col.color || 'var(--text)') : 'var(--text2)',
              transition: 'all 0.15s',
            }}>
              {s === 'all' ? 'All invoices' : col.label || s}
            </button>
          )
        })}
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">
            {statusFilter === 'all' ? 'All invoices' : STATUS_COLORS[statusFilter]?.label || statusFilter}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>{invoices.length} shown</span>
        </div>
        <div className="table-wrap">
          {loading ? (
            <div className="empty-state text-dim">Loading…</div>
          ) : invoices.length === 0 ? (
            <EmptyState icon="💰" title="No invoices found" />
          ) : (
            <table>
              <thead>
                <tr><th>Invoice</th><th>Client</th><th>Project</th><th>Amount</th><th>Issued</th><th>Due</th><th>Status</th><th>Action</th></tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id}>
                    <td className="text-mono text-accent">{inv.invoice_number}</td>
                    <td className="td-main">{inv.client?.company}</td>
                    <td style={{ color: 'var(--text2)' }}>{inv.project?.name || '—'}</td>
                    <td className="text-mono">{fmt$(inv.amount)}</td>
                    <td className="text-mono text-dim">{inv.issued_date || '—'}</td>
                    <td className="text-mono" style={{ color: inv.status === 'Overdue' ? 'var(--red)' : 'var(--text2)' }}>
                      {inv.due_date || '—'}
                    </td>
                    <td><InvoiceStatusBadge status={inv.status} /></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {inv.status !== 'Paid' && (
                          <button className="btn btn-primary btn-sm" onClick={() => onStatusUpdate(inv.id, 'Paid')}>
                            Mark paid
                          </button>
                        )}
                        {inv.status === 'Open' && (
                          <button className="btn btn-ghost btn-sm" onClick={() => onStatusUpdate(inv.id, 'Sent')}>
                            Mark sent
                          </button>
                        )}
                        {inv.status === 'Overdue' && (
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }}>
                            Remind
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  )
}

// ── SUMMARY VIEW ──────────────────────────────────────────────────────────────
function SummaryView({ byClient, invoices }) {
  const grandInvoiced    = Object.values(byClient).reduce((s, c) => s + c.invoiced, 0)
  const grandCollected   = Object.values(byClient).reduce((s, c) => s + c.collected, 0)
  const grandOutstanding = Object.values(byClient).reduce((s, c) => s + c.outstanding, 0)

  return (
    <div className="card">
      <div className="card-header"><span className="card-title">Revenue by client — all time</span></div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Client</th><th>Invoiced</th><th>Collected</th><th>Outstanding</th><th>Invoices</th><th>Avg invoice</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(byClient).sort((a,b) => b[1].invoiced - a[1].invoiced).map(([name, data]) => (
              <tr key={name}>
                <td className="td-main">{name}</td>
                <td className="text-mono">{fmt$(data.invoiced)}</td>
                <td className="text-mono text-green">{fmt$(data.collected)}</td>
                <td className="text-mono" style={{ color: data.outstanding > 0 ? 'var(--amber)' : 'var(--text2)' }}>
                  {fmt$(data.outstanding)}
                </td>
                <td className="text-mono text-dim">{data.count}</td>
                <td className="text-mono text-dim">{fmt$(data.count > 0 ? data.invoiced / data.count : 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* Grand total */}
        <div style={{ padding: '14px 20px', borderTop: '2px solid var(--border2)', display: 'flex', justifyContent: 'flex-end', gap: 40, fontFamily: 'DM Mono, monospace', fontSize: 13 }}>
          <span style={{ color: 'var(--text3)' }}>Total invoiced: <span style={{ color: 'var(--text)', fontWeight: 600 }}>{fmt$(grandInvoiced)}</span></span>
          <span style={{ color: 'var(--text3)' }}>Collected: <span style={{ color: 'var(--green)', fontWeight: 600 }}>{fmt$(grandCollected)}</span></span>
          <span style={{ color: 'var(--text3)' }}>Outstanding: <span style={{ color: 'var(--amber)', fontWeight: 600 }}>{fmt$(grandOutstanding)}</span></span>
        </div>
      </div>
    </div>
  )
}

// ── NEW INVOICE MODAL ─────────────────────────────────────────────────────────
function NewInvoiceModal({ clients, projects, onClose, onSaved }) {
  const [form, setForm] = useState({
    invoice_number: `#${1049 + Math.floor(Math.random() * 10)}`,
    client_id: clients[0]?.id || '',
    project_id: projects[0]?.id || '',
    amount: '',
    status: 'Open',
    issued_date: new Date(2026, 2, 13).toISOString().slice(0,10),
    due_date: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  function set(f) { return e => setForm(p => ({ ...p, [f]: e.target.value })) }

  async function save() {
    if (!form.amount || isNaN(+form.amount)) return
    setSaving(true)
    if (!isDemo) await supabase.from('invoices').insert({ ...form, amount: +form.amount })
    setTimeout(() => { setSaving(false); onSaved() }, isDemo ? 400 : 0)
  }

  return (
    <Modal title="New invoice" onClose={onClose} footer={
      <>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Create invoice'}</button>
      </>
    }>
      <div className="form-grid">
        <FormGroup label="Invoice #">
          <input value={form.invoice_number} onChange={set('invoice_number')} />
        </FormGroup>
        <FormGroup label="Status">
          <select value={form.status} onChange={set('status')}>
            <option value="Open">Open</option>
            <option value="Sent">Sent</option>
            <option value="Paid">Paid</option>
          </select>
        </FormGroup>
        <FormGroup label="Client" full>
          <select value={form.client_id} onChange={set('client_id')}>
            {clients.map(c => <option key={c.id} value={c.id}>{c.company}</option>)}
          </select>
        </FormGroup>
        <FormGroup label="Project" full>
          <select value={form.project_id} onChange={set('project_id')}>
            <option value="">— None —</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </FormGroup>
        <FormGroup label="Amount ($)">
          <input type="number" step="0.01" min="0" value={form.amount} onChange={set('amount')} placeholder="0.00" />
        </FormGroup>
        <FormGroup label="Issued date">
          <input type="date" value={form.issued_date} onChange={set('issued_date')} />
        </FormGroup>
        <FormGroup label="Due date">
          <input type="date" value={form.due_date} onChange={set('due_date')} />
        </FormGroup>
        <FormGroup label="Notes" full>
          <textarea value={form.notes} onChange={set('notes')} rows={2} placeholder="Optional notes…" />
        </FormGroup>
      </div>
    </Modal>
  )
}

function InvoiceStatusBadge({ status }) {
  const s = STATUS_COLORS[status] || { bg: 'var(--bg4)', color: 'var(--text2)', label: status }
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}
