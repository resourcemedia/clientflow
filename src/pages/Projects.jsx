import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { DEMO_PROJECTS, DEMO_CLIENTS, PRIORITIES, PROOF_STATUSES, INV_STATUSES, COLLECT_STATUSES } from '../lib/demo-data'
import { StatusBadge, Modal, EmptyState, StatCard, PillNav, FormGroup, fmt$, Breadcrumb } from '../components/ui'

const isDemo = !import.meta.env.VITE_SUPABASE_URL
const PRODUCT_TYPES = ['ST', 'CO', 'DS', 'OH']

export default function ProjectsPage() {
  const [projects, setProjects]           = useState([])
  const [clients, setClients]             = useState([])
  const [productMap, setProductMap]       = useState({}) // { type: name }
  const [loading, setLoading]             = useState(true)
  const [tab, setTab]                     = useState('work')
  const [editProject, setEditProject]     = useState(null)
  const [search, setSearch]               = useState('')
  const [showArchived, setShowArchived]   = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [searchParams]                    = useSearchParams()
  const [clientFilter, setClientFilter]   = useState(searchParams.get('client') || '')
  const [addingRow, setAddingRow]         = useState(null) // null | { client_id, name, product_type }
  const addInputRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (addingRow !== null) addInputRef.current?.focus()
  }, [addingRow])

  async function load() {
    setLoading(true)
    if (isDemo) {
      setProjects(DEMO_PROJECTS)
      setClients(DEMO_CLIENTS)
    } else {
      const [{ data: p }, { data: c }, { data: prods }] = await Promise.all([
        supabase.from('projects').select('*, client:clients(company,alias)').order('sort_order', { ascending: true, nullsFirst: false }).order('project_number', { ascending: false }),
        supabase.from('clients').select('id, company, alias').eq('status','active').order('company'),
        supabase.from('products').select('type, name').order('order_num', { nullsFirst: false }),
      ])
      setProjects(p || [])
      setClients(c || [])
      const map = {}
      ;(prods || []).forEach(prod => { if (prod.type) map[prod.type] = prod.name })
      setProductMap(map)
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

  function handleReorder(reordered) {
    setProjects(reordered)
    reordered.forEach((p, i) => {
      supabase.from('projects').update({ sort_order: i }).eq('id', p.id).then(() => {})
    })
  }

  function startAdd() {
    setAddingRow({
      client_id:    clientFilter || (clients[0]?.id || ''),
      name:         '',
      product_type: 'CO',
    })
  }

  async function handleAddSave() {
    const name = addingRow?.name?.trim()
    if (!name) { setAddingRow(null); return }
    if (isDemo) { setAddingRow(null); return }

    // Auto-generate next project number
    const nums = projects.map(p => parseInt(p.project_number, 10)).filter(n => !isNaN(n))
    const nextNumber = nums.length ? String(Math.max(...nums) + 1) : '1000'

    const { data } = await supabase
      .from('projects')
      .insert({
        name,
        client_id:    addingRow.client_id || null,
        product_type: addingRow.product_type,
        project_number: nextNumber,
        priority:     'Normal',
        proof_status: 'Open',
        inv_status:   'Open',
        collect_status: 'Open',
      })
      .select('*, client:clients(company,alias)')
      .single()
    if (data) setProjects(prev => [...prev, data])
    setAddingRow(null)
  }

  function handleAddKeyDown(e) {
    if (e.key === 'Enter')  handleAddSave()
    if (e.key === 'Escape') setAddingRow(null)
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
        <Breadcrumb segments={[
          { label: 'Dashboard', onClick: () => navigate('/') },
          { label: 'Projects' },
        ]} />
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
            clients={clients}
            productMap={productMap}
            loading={loading}
            showArchived={showArchived}
            confirmDelete={confirmDelete}
            addingRow={addingRow}
            setAddingRow={setAddingRow}
            addInputRef={addInputRef}
            clientFilter={clientFilter}
            onEdit={p => setEditProject(p)}
            onArchive={handleArchive}
            onDeleteRequest={id => setConfirmDelete(id)}
            onDeleteCancel={() => setConfirmDelete(null)}
            onDeleteConfirm={handleDelete}
            onView={id => navigate(`/projects/${id}`)}
            onReorder={handleReorder}
            onStartAdd={startAdd}
            onAddSave={handleAddSave}
            onAddKeyDown={handleAddKeyDown}
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

      {editProject && (
        <ProjectModal
          project={editProject}
          clients={clients}
          projects={projects}
          onClose={() => setEditProject(null)}
          onSaved={() => { setEditProject(null); load() }}
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
function WorkView({
  projects, clients, productMap, loading, showArchived, confirmDelete,
  addingRow, setAddingRow, addInputRef, clientFilter,
  onEdit, onArchive, onDeleteRequest, onDeleteCancel, onDeleteConfirm,
  onView, onReorder, onStartAdd, onAddSave, onAddKeyDown,
}) {
  const navigate = useNavigate()
  const [dragIdx, setDragIdx]         = useState(null)
  const [dragOverIdx, setDragOverIdx] = useState(null)

  function handleDragStart(e, idx) {
    e.dataTransfer.effectAllowed = 'move'
    setDragIdx(idx)
  }

  function handleDragOver(e, idx) {
    e.preventDefault()
    setDragOverIdx(idx)
  }

  function handleDrop(toIdx) {
    if (dragIdx === null || dragIdx === toIdx) { reset(); return }
    const reordered = [...projects]
    const [moved] = reordered.splice(dragIdx, 1)
    reordered.splice(toIdx, 0, moved)
    onReorder(reordered)
    reset()
  }

  function reset() { setDragIdx(null); setDragOverIdx(null) }

  if (loading) return <div className="card"><div className="empty-state text-dim">Loading…</div></div>

  if (projects.length === 0 && addingRow === null) {
    return (
      <div className="card">
        <EmptyState
          icon="📁"
          title={showArchived ? 'No archived projects' : 'No projects found'}
          sub={showArchived ? '' : 'Add a project to get started'}
        />
        {!showArchived && (
          <div style={{ textAlign: 'center', paddingBottom: 24 }}>
            <button className="btn btn-ghost btn-sm" onClick={onStartAdd}>+ Add first project</button>
          </div>
        )}
      </div>
    )
  }

  const groups = groupByClient(projects)

  return (
    <div className="card">
      <div className="card-header">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/clients')}>
          ← Clients
        </button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: 24 }}></th>
              <th>#</th><th>Client</th><th>Product</th><th>Project</th><th></th>
            </tr>
          </thead>
          <tbody>
            {groups.map(group => (
              <>
                {/* Client group header */}
                <tr key={`group-${group.name}`} style={{ background: 'var(--bg3)', pointerEvents: 'none' }}>
                  <td colSpan={6} style={{
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
                {group.projects.map((p) => {
                  const globalIdx = projects.indexOf(p)
                  return confirmDelete === p.id ? (
                    <tr key={p.id} style={{ background: 'var(--red-bg)' }}>
                      <td></td>
                      <td colSpan={4} style={{ padding: '10px 16px', color: 'var(--text2)', fontSize: 13 }}>
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
                    <tr
                      key={p.id}
                      draggable
                      onDragStart={e => handleDragStart(e, globalIdx)}
                      onDragOver={e => handleDragOver(e, globalIdx)}
                      onDrop={() => handleDrop(globalIdx)}
                      onDragEnd={reset}
                      onClick={() => onView(p.id)}
                      style={{
                        opacity: dragIdx === globalIdx ? 0.4 : (p.archived ? 0.55 : 1),
                        outline: dragOverIdx === globalIdx && dragIdx !== globalIdx
                          ? '2px solid var(--accent)' : undefined,
                        cursor: 'pointer',
                      }}
                    >
                      <td style={{
                        cursor: 'grab', color: 'var(--text3)',
                        fontSize: 15, userSelect: 'none', paddingRight: 0,
                      }}>
                        ⠿
                      </td>
                      <td className="text-mono text-dim">{p.project_number}</td>
                      <td style={{ color: 'var(--text2)', fontSize: 13 }}>{p.client?.company || '—'}</td>
                      <td style={{ color: 'var(--text2)', fontSize: 13, whiteSpace: 'nowrap' }}>
                        {p.product_type
                          ? `${p.product_type}${productMap[p.product_type] ? ` | ${productMap[p.product_type]}` : ''}`
                          : '—'}
                      </td>
                      <td className="td-main">{p.name}</td>
                      <td onClick={e => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                        <button className="btn btn-ghost btn-sm" style={{ marginRight: 4 }} onClick={() => onView(p.id)}>
                          Items
                        </button>
                        {!showArchived && (
                          <button className="btn btn-ghost btn-sm" style={{ marginRight: 4 }} title="Edit project" onClick={() => onEdit(p)}>
                            ✏️
                          </button>
                        )}
                        <button className="btn btn-ghost btn-sm" style={{ marginRight: 4 }} onClick={() => onArchive(p)}>
                          {p.archived ? 'Restore' : 'Archive'}
                        </button>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)', marginRight: 4 }} title="Delete project" onClick={() => onDeleteRequest(p.id)}>
                          🗑️
                        </button>
                        <button className="btn btn-ghost btn-sm" title="Add new project" onClick={onStartAdd}>
                          +
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </>
            ))}

            {/* Inline add row */}
            {addingRow !== null && (
              <tr style={{ background: 'var(--accent-glow)' }}>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      ref={addInputRef}
                      value={addingRow.name}
                      onChange={e => setAddingRow(r => ({ ...r, name: e.target.value }))}
                      placeholder="Project name…"
                      onKeyDown={onAddKeyDown}
                      style={{ flex: 1 }}
                    />
                    {!clientFilter && (
                      <select
                        value={addingRow.client_id}
                        onChange={e => setAddingRow(r => ({ ...r, client_id: e.target.value }))}
                        style={{ width: 140 }}
                      >
                        <option value="">No client</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{c.company}</option>)}
                      </select>
                    )}
                  </div>
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn btn-primary btn-sm" style={{ marginRight: 4 }} onClick={onAddSave}>
                    Save
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setAddingRow(null)}>
                    Cancel
                  </button>
                </td>
              </tr>
            )}

            {/* Empty state + add button when no groups */}
            {groups.length === 0 && addingRow === null && (
              <tr>
                <td colSpan={6} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text3)' }}>
                  No projects found.{' '}
                  <button className="btn btn-ghost btn-sm" onClick={onStartAdd}>+ Add first project</button>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Add button below table */}
        {groups.length > 0 && addingRow === null && (
          <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
            <button className="btn btn-ghost btn-sm" onClick={onStartAdd}>+ Add project</button>
          </div>
        )}
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

// ── PROJECT MODAL (edit only) ────────────────────────────────────────────
function ProjectModal({ project, clients, projects, onClose, onSaved }) {
  const [form, setForm] = useState({
    project_number: project?.project_number ?? '',
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

    const { error: err } = await supabase.from('projects').update(payload).eq('id', project.id)

    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  return (
    <Modal
      title={`Edit — ${project.name}`}
      onClose={onClose}
      footer={
        <>
          {error && <span style={{ color: 'var(--red)', fontSize: '0.82rem', flex: 1 }}>{error}</span>}
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
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
            {PRODUCT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
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
