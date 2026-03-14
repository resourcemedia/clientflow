import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { DEMO_PROJECTS, DEMO_CLIENTS, PRIORITIES, PROOF_STATUSES, INV_STATUSES, COLLECT_STATUSES } from '../lib/demo-data'
import { StatusBadge, Modal, EmptyState, StatCard, PillNav, FormGroup, fmt$ } from '../components/ui'

const isDemo = !import.meta.env.VITE_SUPABASE_URL

export default function ProjectsPage() {
  const [projects, setProjects]           = useState([])
  const [clients, setClients]             = useState([])
  const [loading, setLoading]             = useState(true)
  const [tab, setTab]                     = useState('work')
  const [showModal, setShowModal]         = useState(false)
  const [editProject, setEditProject]     = useState(null)
  const [search, setSearch]               = useState('')
  const [showArchived, setShowArchived]   = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [searchParams]                    = useSearchParams()
  const [clientFilter, setClientFilter]   = useState(searchParams.get('client') || '')
  const navigate = useNavigate()

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    if (isDemo) {
      setProjects(DEMO_PROJECTS)
      setClients(DEMO_CLIENTS)
    } else {
      const [{ data: p }, { data: c }] = await Promise.all([
        supabase.from('projects').select('*, client:clients(company,alias)').order('project_number', { ascending: false }),
        supabase.from('clients').select('id, company, alias').eq('status','active').order('company'),
      ])
      setProjects(p || [])
      setClients(c || [])
    }
    setLoading(false)
  }

  async function handleArchive(project) {
    const newVal = !project.archived
    await supabase.from('projects').update({ archived: newVal }).eq('id', project.id)
    setProjects(ps => ps.map(p => p.id === project.id ? { ...p, archived: newVal } : p))
  }

  async function handleDelete(id) {
    await supabase.from('projects').delete().eq('id', id)
    setProjects(ps => ps.filter(p => p.id !== id))
    setConfirmDelete(null)
  }

  const filtered = projects.filter(p => {
    if (!showArchived && p.archived) return false
    if (showArchived  && !p.archived) return false
    if (clientFilter && p.client_id !== clientFilter) return false
    const q = search.toLowerCase()
    return !q
      || p.name.toLowerCase().includes(q)
      || (p.project_number || '').includes(q)
      || (p.client?.company || '').toLowerCase().includes(q)
  })

  const totalEst  = filtered.reduce((s, p) => s + (p.est_amount  || 0), 0)
  const totalOwed = filtered.reduce((s, p) => s + (p.client_owed || 0), 0)
  const totalPaid = filtered.reduce((s, p) => s + (p.client_paid || 0), 0)
  const openCount = filtered.filter(p => p.inv_status !== 'Paid').length

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
        <button
          className={`btn ${showArchived ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setShowArchived(v => !v)}
        >
          {showArchived ? 'Archived' : 'Active'}
        </button>
        <button className="btn btn-primary" onClick={() => { setEditProject(null); setShowModal(true) }}>
          + Add project
        </button>
      </div>

      <div className="page-content">
        <div className="stat-grid mb-24">
          <StatCard label={showArchived ? 'Archived projects' : 'Total projects'} value={filtered.length} color="blue" />
          <StatCard label="Open invoices"   value={openCount}       color="amber"  />
          <StatCard label="Total estimated" value={fmt$(totalEst)}  color="accent" />
          <StatCard label="Outstanding"     value={fmt$(totalOwed)} color={totalOwed > 0 ? 'amber' : 'green'} />
        </div>

        {tab === 'work' ? (
          <WorkView
            projects={filtered}
            loading={loading}
            showArchived={showArchived}
            confirmDelete={confirmDelete}
            onEdit={p => { setEditProject(p); setShowModal(true) }}
            onArchive={handleArchive}
            onDeleteRequest={id => setConfirmDelete(id)}
            onDeleteCancel={() => setConfirmDelete(null)}
            onDeleteConfirm={handleDelete}
            onView={id => navigate(`/projects/${id}`)}
          />
        ) : (
          <FinancialView
            projects={filtered}
            loading={loading}
            totalEst={totalEst}
            totalOwed={totalOwed}
            totalPaid={totalPaid}
            onView={id => navigate(`/projects/${id}`)}
          />
        )}
      </div>

      {showModal && (
        <ProjectModal
          project={editProject}
          clients={clients}
          projects={projects}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}

// ── GROUP helpers ───────────────────────────────────────────────────────
function groupByClient(projects) {
  const map = {}
  for (const p of projects) {
    const key  = p.client_id || '__none__'
    const name = p.client?.company || p.client?.alias || 'No client'
    if (!map[key]) map[key] = { name, projects: [] }
    map[key].projects.push(p)
  }
  return Object.values(map).sort((a, b) => a.name.localeCompare(b.name))
}

// ── WORK VIEW ───────────────────────────────────────────────────────────
function WorkView({ projects, loading, showArchived, confirmDelete, onEdit, onArchive, onDeleteRequest, onDeleteCancel, onDeleteConfirm, onView }) {
  if (loading) return <div className="card"><div className="empty-state text-dim">Loading…</div></div>

  if (projects.length === 0) {
    return (
      <div className="card">
        <EmptyState icon="📁" title={showArchived ? 'No archived projects' : 'No projects found'} sub={showArchived ? '' : 'Add a project to get started'} />
      </div>
    )
  }

  const groups = groupByClient(projects)

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">{showArchived ? 'Archived projects' : 'All projects'}</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th><th>Project</th><th>Type</th>
              <th>Priority</th><th>Proof</th><th>Invoice</th><th>Collect</th>
              <th>Start</th><th></th>
            </tr>
          </thead>
          <tbody>
            {groups.map(group => (
              <>
                {/* Client group header */}
                <tr key={`group-${group.name}`} style={{ background: 'var(--bg3)', pointerEvents: 'none' }}>
                  <td colSpan={9} style={{
                    padding: '7px 16px',
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.07em',
                    textTransform: 'uppercase',
                    color: 'var(--text2)',
                  }}>
                    {group.name}
                  </td>
                </tr>

                {/* Project rows */}
                {group.projects.map(p => (
                  confirmDelete === p.id ? (
                    <tr key={p.id} style={{ background: 'var(--red-bg)' }}>
                      <td colSpan={8} style={{ padding: '10px 16px', color: 'var(--text2)', fontSize: 13 }}>
                        Delete <strong>{p.name}</strong>? This cannot be undone.
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button
                          className="btn btn-sm"
                          style={{ background: 'var(--red)', color: '#fff', marginRight: 6 }}
                          onClick={() => onDeleteConfirm(p.id)}
                        >
                          Delete
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={onDeleteCancel}>Cancel</button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={p.id} style={{ opacity: p.archived ? 0.55 : 1 }}>
                      <td className="text-mono text-dim">{p.project_number}</td>
                      <td className="td-main">{p.name}</td>
                      <td><StatusBadge status={p.product_type} /></td>
                      <td><StatusBadge status={p.priority} /></td>
                      <td><StatusBadge status={p.proof_status} /></td>
                      <td><StatusBadge status={p.inv_status} /></td>
                      <td><StatusBadge status={p.collect_status} /></td>
                      <td className="text-mono text-dim">{p.start_date?.slice(0,10) || '—'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="btn btn-ghost btn-sm" style={{ marginRight: 4 }} onClick={() => onView(p.id)}>
                          View
                        </button>
                        {!showArchived && (
                          <button className="btn btn-ghost btn-sm" style={{ marginRight: 4 }} onClick={() => onEdit(p)}>
                            Edit
                          </button>
                        )}
                        <button className="btn btn-ghost btn-sm" style={{ marginRight: 4 }} onClick={() => onArchive(p)}>
                          {p.archived ? 'Restore' : 'Archive'}
                        </button>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => onDeleteRequest(p.id)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  )
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── FINANCIAL VIEW ──────────────────────────────────────────────────────
function FinancialView({ projects, loading, totalEst, totalOwed, totalPaid, onView }) {
  if (loading) return <div className="card"><div className="empty-state text-dim">Loading…</div></div>
  return (
    <div className="card">
      <div className="card-header"><span className="card-title">Financial overview</span></div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th><th>Project</th><th>Client</th><th>Est amount</th>
              <th>C owed</th><th>C paid</th><th>Balance</th>
              <th>Team owed</th><th>Team paid</th><th>Invoice</th><th></th>
            </tr>
          </thead>
          <tbody>
            {projects.map(p => {
              const balance = (p.client_owed || 0) - (p.client_paid || 0)
              return (
                <tr key={p.id}>
                  <td className="text-mono text-dim">{p.project_number}</td>
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
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => onView(p.id)}>View</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div style={{
          padding: '14px 20px',
          borderTop: '2px solid var(--border2)',
          display: 'flex', justifyContent: 'flex-end', gap: 40,
          fontFamily: 'DM Mono, monospace', fontSize: 13,
        }}>
          <span className="text-dim">Total est: <span style={{ color: 'var(--text)', fontWeight: 600 }}>{fmt$(totalEst)}</span></span>
          <span className="text-dim">Total owed: <span style={{ color: 'var(--amber)', fontWeight: 600 }}>{fmt$(totalOwed)}</span></span>
          <span className="text-dim">Total paid: <span style={{ color: 'var(--green)', fontWeight: 600 }}>{fmt$(totalPaid)}</span></span>
        </div>
      </div>
    </div>
  )
}

// ── PROJECT MODAL ───────────────────────────────────────────────────────
function ProjectModal({ project, clients, projects, onClose, onSaved }) {
  const isEdit = !!project

  // Auto-generate next project number for new projects
  const nextNumber = (() => {
    const nums = projects
      .map(p => parseInt(p.project_number, 10))
      .filter(n => !isNaN(n))
    return nums.length ? String(Math.max(...nums) + 1) : '1000'
  })()

  const [form, setForm] = useState({
    project_number: project?.project_number ?? nextNumber,
    name:           project?.name           || '',
    client_id:      project?.client_id      || (clients[0]?.id || ''),
    product_type:   project?.product_type   || 'CO',
    priority:       project?.priority       || 'Normal',
    area:           project?.area           || '',
    est_status:     project?.est_status     || 'Open',
    proof_status:   project?.proof_status   || 'Open',
    inv_status:     project?.inv_status     || 'Open',
    collect_status: project?.collect_status || 'Open',
    est_amount:     project?.est_amount     || '',
    client_owed:    project?.client_owed    || '',
    client_paid:    project?.client_paid    || '',
    team_owed:      project?.team_owed      || '',
    team_paid:      project?.team_paid      || '',
    start_date:     project?.start_date     || '',
    end_date:       project?.end_date       || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  // Duplicate number check (warn but don't block)
  const isDupe = form.project_number.trim() !== '' && projects.some(
    p => p.project_number === form.project_number.trim() && p.id !== project?.id
  )

  function set(field) { return e => setForm(f => ({ ...f, [field]: e.target.value })) }

  async function save() {
    if (!form.name.trim()) return
    setError('')
    setSaving(true)
    if (isDemo) {
      setTimeout(() => { setSaving(false); onSaved() }, 400)
      return
    }

    const NUMERIC = ['est_amount','client_owed','client_paid','team_owed','team_paid']
    const payload = { ...form }
    NUMERIC.forEach(k => { payload[k] = payload[k] === '' ? null : Number(payload[k]) })
    if (!payload.client_id)  payload.client_id  = null
    if (!payload.start_date) payload.start_date = null
    if (!payload.end_date)   payload.end_date   = null

    const { error: err } = isEdit
      ? await supabase.from('projects').update(payload).eq('id', project.id)
      : await supabase.from('projects').insert(payload)

    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  return (
    <Modal
      title={isEdit ? `Edit — ${project.name}` : 'Add new project'}
      onClose={onClose}
      footer={
        <>
          {error && <span style={{ color: 'var(--red)', fontSize: '0.82rem', flex: 1 }}>{error}</span>}
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
          {isDupe && (
            <div style={{
              marginTop: 5, padding: '5px 8px',
              background: 'var(--amber-bg)', border: '1px solid var(--amber)',
              borderRadius: 6, fontSize: '0.78rem', color: 'var(--amber)',
            }}>
              Project #{form.project_number} already exists — you can still save with this number.
            </div>
          )}
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
            <FormGroup label="Est amount"><input type="number" value={form.est_amount}  onChange={set('est_amount')} /></FormGroup>
            <FormGroup label="Client owed"><input type="number" value={form.client_owed} onChange={set('client_owed')} /></FormGroup>
            <FormGroup label="Client paid"><input type="number" value={form.client_paid} onChange={set('client_paid')} /></FormGroup>
            <FormGroup label="Team owed"><input type="number" value={form.team_owed}   onChange={set('team_owed')} /></FormGroup>
            <FormGroup label="Team paid"><input type="number" value={form.team_paid}   onChange={set('team_paid')} /></FormGroup>
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
