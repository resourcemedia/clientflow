import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { DEMO_PROJECTS, DEMO_CLIENTS, PRIORITIES, PROOF_STATUSES, INV_STATUSES, COLLECT_STATUSES } from '../lib/demo-data'
import { StatusBadge, Modal, EmptyState, StatCard, PillNav, FormGroup, fmt$ } from '../components/ui'

const isDemo = !import.meta.env.VITE_SUPABASE_URL

export default function ProjectsPage() {
  const [projects, setProjects] = useState([])
  const [clients, setClients]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState('work')
  const [showModal, setShowModal] = useState(false)
  const [editProject, setEditProject] = useState(null)
  const [search, setSearch]     = useState('')
  const [searchParams]          = useSearchParams()
  const [clientFilter, setClientFilter] = useState(searchParams.get('client') || '')
  const navigate = useNavigate()

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    if (isDemo) {
      setProjects(DEMO_PROJECTS)
      setClients(DEMO_CLIENTS)
    } else {
      const [{ data: p }, { data: c }] = await Promise.all([
        supabase.from('projects').select('*, client:clients(company,alias)').order('created_at', { ascending: false }),
        supabase.from('clients').select('id, company, alias').eq('status','active').order('company'),
      ])
      setProjects(p || [])
      setClients(c || [])
    }
    setLoading(false)
  }

  const filtered = projects.filter(p => {
    if (clientFilter && p.client_id !== clientFilter) return false
    const q = search.toLowerCase()
    return !q
      || p.name.toLowerCase().includes(q)
      || (p.project_number || '').includes(q)
      || (p.client?.company || '').toLowerCase().includes(q)
  })

  // Financial totals
  const totalEst       = filtered.reduce((s, p) => s + (p.est_amount  || 0), 0)
  const totalOwed      = filtered.reduce((s, p) => s + (p.client_owed || 0), 0)
  const totalPaid      = filtered.reduce((s, p) => s + (p.client_paid || 0), 0)
  const openCount      = filtered.filter(p => p.inv_status !== 'Paid').length

  const TABS = [
    { id: 'work',      label: 'Work view' },
    { id: 'financial', label: 'Financial view' },
  ]

  return (
    <div className="fade-in">
      <div className="topbar">
        <div className="topbar-title">Projects</div>
        <PillNav tabs={TABS} active={tab} onChange={setTab} />
        <select
          value={clientFilter}
          onChange={e => setClientFilter(e.target.value)}
          style={{ width: 180 }}
        >
          <option value="">All clients</option>
          {clients.map(c => (
            <option key={c.id} value={c.id}>{c.company}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Search projects…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: 200 }}
        />
        <button className="btn btn-primary" onClick={() => { setEditProject(null); setShowModal(true) }}>
          + Add project
        </button>
      </div>

      <div className="page-content">
        {/* Stats */}
        <div className="stat-grid mb-24">
          <StatCard label="Total projects" value={filtered.length}     color="blue" />
          <StatCard label="Open invoices"  value={openCount}           color="amber"  />
          <StatCard label="Total estimated" value={fmt$(totalEst)}     color="accent" />
          <StatCard label="Outstanding"     value={fmt$(totalOwed)}    color={totalOwed > 0 ? 'amber' : 'green'} />
        </div>

        {tab === 'work' ? (
          <WorkView projects={filtered} loading={loading} onEdit={p => { setEditProject(p); setShowModal(true) }} onNavigate={navigate} />
        ) : (
          <FinancialView projects={filtered} loading={loading} totalEst={totalEst} totalOwed={totalOwed} totalPaid={totalPaid} onNavigate={navigate} />
        )}
      </div>

      {showModal && (
        <ProjectModal
          project={editProject}
          clients={clients}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}

// ── WORK VIEW ──────────────────────────────────────────────────────────
function WorkView({ projects, loading, onEdit, onNavigate }) {
  if (loading) return <div className="card"><div className="empty-state text-dim">Loading…</div></div>
  return (
    <div className="card">
      <div className="card-header"><span className="card-title">All projects</span></div>
      <div className="table-wrap">
        {projects.length === 0 ? (
          <EmptyState icon="📁" title="No projects found" sub="Add a project to get started" />
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th><th>Project</th><th>Client</th><th>Type</th>
                <th>Priority</th><th>Proof</th><th>Invoice</th><th>Collect</th>
                <th>Start</th><th></th>
              </tr>
            </thead>
            <tbody>
              {projects.map(p => (
                <tr key={p.id} onClick={() => onNavigate(`/projects/${p.id}`)}>
                  <td className="text-mono text-dim">{p.project_number}</td>
                  <td className="td-main">{p.name}</td>
                  <td>{p.client?.company || '—'}</td>
                  <td><StatusBadge status={p.product_type} /></td>
                  <td><StatusBadge status={p.priority} /></td>
                  <td><StatusBadge status={p.proof_status} /></td>
                  <td><StatusBadge status={p.inv_status} /></td>
                  <td><StatusBadge status={p.collect_status} /></td>
                  <td className="text-mono text-dim">{p.start_date?.slice(0,10) || '—'}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <button className="btn btn-ghost btn-sm" onClick={() => onEdit(p)}>Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ── FINANCIAL VIEW ─────────────────────────────────────────────────────
function FinancialView({ projects, loading, totalEst, totalOwed, totalPaid, onNavigate }) {
  if (loading) return <div className="card"><div className="empty-state text-dim">Loading…</div></div>
  return (
    <div className="card">
      <div className="card-header"><span className="card-title">Financial overview</span></div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Project</th><th>Client</th><th>Est amount</th>
              <th>C owed</th><th>C paid</th><th>Balance</th>
              <th>Team owed</th><th>Team paid</th><th>Invoice</th>
            </tr>
          </thead>
          <tbody>
            {projects.map(p => {
              const balance = (p.client_owed || 0) - (p.client_paid || 0)
              return (
                <tr key={p.id} onClick={() => onNavigate(`/projects/${p.id}`)}>
                  <td className="td-main">{p.name}</td>
                  <td>{p.client?.company || '—'}</td>
                  <td className="text-mono">{fmt$(p.est_amount)}</td>
                  <td className="text-mono text-amber">{fmt$(p.client_owed)}</td>
                  <td className="text-mono text-green">{fmt$(p.client_paid)}</td>
                  <td className="text-mono" style={{ color: balance > 0 ? 'var(--red)' : 'var(--green)' }}>
                    {fmt$(balance)}
                  </td>
                  <td className="text-mono text-dim">{fmt$(p.team_owed)}</td>
                  <td className="text-mono text-dim">{fmt$(p.team_paid)}</td>
                  <td><StatusBadge status={p.inv_status} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {/* Totals row */}
        <div style={{
          padding: '14px 20px',
          borderTop: '2px solid var(--border2)',
          display: 'flex', justifyContent: 'flex-end', gap: 40,
          fontFamily: 'DM Mono, monospace', fontSize: 13
        }}>
          <span className="text-dim">Total est: <span style={{ color: 'var(--text)', fontWeight: 600 }}>{fmt$(totalEst)}</span></span>
          <span className="text-dim">Total owed: <span style={{ color: 'var(--amber)', fontWeight: 600 }}>{fmt$(totalOwed)}</span></span>
          <span className="text-dim">Total paid: <span style={{ color: 'var(--green)', fontWeight: 600 }}>{fmt$(totalPaid)}</span></span>
        </div>
      </div>
    </div>
  )
}

// ── PROJECT MODAL ──────────────────────────────────────────────────────
function ProjectModal({ project, clients, onClose, onSaved }) {
  const isEdit = !!project
  const [form, setForm] = useState({
    project_number: project?.project_number || '',
    name: project?.name || '',
    client_id: project?.client_id || (clients[0]?.id || ''),
    product_type: project?.product_type || 'CO',
    priority: project?.priority || 'Normal',
    area: project?.area || '',
    est_status: project?.est_status || 'Open',
    proof_status: project?.proof_status || 'Open',
    inv_status: project?.inv_status || 'Open',
    collect_status: project?.collect_status || 'Open',
    est_amount: project?.est_amount || '',
    client_owed: project?.client_owed || '',
    client_paid: project?.client_paid || '',
    team_owed: project?.team_owed || '',
    team_paid: project?.team_paid || '',
    start_date: project?.start_date || '',
    end_date: project?.end_date || '',
  })
  const [saving, setSaving] = useState(false)

  function set(field) { return e => setForm(f => ({ ...f, [field]: e.target.value })) }

  async function save() {
    if (!form.name.trim()) return
    setSaving(true)
    if (isDemo) {
      setTimeout(() => { setSaving(false); onSaved() }, 400)
      return
    }
    const payload = { ...form }
    if (isEdit) {
      await supabase.from('projects').update(payload).eq('id', project.id)
    } else {
      await supabase.from('projects').insert(payload)
    }
    setSaving(false)
    onSaved()
  }

  return (
    <Modal
      title={isEdit ? `Edit — ${project.name}` : 'Add new project'}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add project'}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <FormGroup label="Project #">
          <input value={form.project_number} onChange={set('project_number')} placeholder="e.g. 8037" />
        </FormGroup>
        <FormGroup label="Project name">
          <input value={form.name} onChange={set('name')} placeholder="e.g. FB Posts 52" />
        </FormGroup>
        <FormGroup label="Client" full>
          <select value={form.client_id} onChange={set('client_id')}>
            {clients.map(c => <option key={c.id} value={c.id}>{c.company}</option>)}
          </select>
        </FormGroup>
        <FormGroup label="Product type">
          <select value={form.product_type} onChange={set('product_type')}>
            {['ST','CO','DS','OH'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </FormGroup>
        <FormGroup label="Priority">
          <select value={form.priority} onChange={set('priority')}>
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </FormGroup>
        <FormGroup label="Area">
          <input value={form.area} onChange={set('area')} placeholder="e.g. Social, Web, Print" />
        </FormGroup>

        <div className="full" style={{ gridColumn: '1/-1', borderTop: '1px solid var(--border)', margin: '4px -20px 0', padding: '16px 20px 0' }}>
          <div className="text-xs text-dim fw-600" style={{ letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Status fields</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            <FormGroup label="Proof status">
              <select value={form.proof_status} onChange={set('proof_status')}>
                {PROOF_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </FormGroup>
            <FormGroup label="Invoice status">
              <select value={form.inv_status} onChange={set('inv_status')}>
                {INV_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </FormGroup>
            <FormGroup label="Collect status">
              <select value={form.collect_status} onChange={set('collect_status')}>
                {COLLECT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </FormGroup>
            <FormGroup label="Est status">
              <select value={form.est_status} onChange={set('est_status')}>
                {['Open','In Progress','Approved'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </FormGroup>
          </div>
        </div>

        <div className="full" style={{ gridColumn: '1/-1', borderTop: '1px solid var(--border)', margin: '4px -20px 0', padding: '16px 20px 0' }}>
          <div className="text-xs text-dim fw-600" style={{ letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Financials</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            <FormGroup label="Est amount"><input type="number" value={form.est_amount} onChange={set('est_amount')} /></FormGroup>
            <FormGroup label="Client owed"><input type="number" value={form.client_owed} onChange={set('client_owed')} /></FormGroup>
            <FormGroup label="Client paid"><input type="number" value={form.client_paid} onChange={set('client_paid')} /></FormGroup>
            <FormGroup label="Team owed"><input type="number" value={form.team_owed} onChange={set('team_owed')} /></FormGroup>
            <FormGroup label="Team paid"><input type="number" value={form.team_paid} onChange={set('team_paid')} /></FormGroup>
          </div>
        </div>

        <FormGroup label="Start date">
          <input type="date" value={form.start_date} onChange={set('start_date')} />
        </FormGroup>
        <FormGroup label="End date">
          <input type="date" value={form.end_date} onChange={set('end_date')} />
        </FormGroup>
      </div>
    </Modal>
  )
}
