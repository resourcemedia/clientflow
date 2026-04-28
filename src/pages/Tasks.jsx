import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PillNav, Breadcrumb } from '../components/ui'

const STATUS_TABS = [
  { id: 'Normal', label: 'Normal' },
  { id: 'High',   label: 'High'   },
  { id: 'Hot',    label: 'Hot'    },
]

function initials(str) {
  if (!str) return '?'
  return str.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function fmtUpdated(updatedAt, updaterName) {
  if (!updatedAt) return '—'
  const d  = new Date(updatedAt)
  const mo = d.getMonth() + 1
  const dy = d.getDate()
  const yr = String(d.getFullYear()).slice(2)
  const by = updaterName ? ` by ${initials(updaterName)}` : ''
  return `${mo}/${dy}/${yr}${by}`
}

function productLabel(project, productMap) {
  if (!project?.product_type) return '—'
  const name = productMap?.[project.product_type]
  return name ? `${project.product_type} | ${name}` : project.product_type
}

function clientLabel(project) {
  return project?.client?.company || project?.client?.alias || '—'
}

// ── AVATAR ───────────────────────────────────────────────────────────────────
function Avatar({ name, size = 26, color = 'var(--accent)' }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.42, fontWeight: 600, color: '#fff',
      flexShrink: 0, userSelect: 'none',
    }}>
      {initials(name)}
    </div>
  )
}

// ── DRAG HANDLE ICON ─────────────────────────────────────────────────────────
function DragHandle() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" style={{ color: 'var(--text3)', cursor: 'grab' }}>
      <circle cx="4" cy="3"  r="1.2"/><circle cx="10" cy="3"  r="1.2"/>
      <circle cx="4" cy="7"  r="1.2"/><circle cx="10" cy="7"  r="1.2"/>
      <circle cx="4" cy="11" r="1.2"/><circle cx="10" cy="11" r="1.2"/>
    </svg>
  )
}

// ── EXISTING TASK ROW ─────────────────────────────────────────────────────────
function TaskRow({ task, idx, profiles, projects, productMap, onSave, onAddBelow, onDelete, onDragStart, onDragOver, onDrop, isDragging, isDragTarget }) {
  const [editField, setEditField]   = useState(null)
  const [noteVal,   setNoteVal]     = useState(task.note || '')
  const [snoteVal,  setSnoteVal]    = useState(task.status_note || '')
  const [assignOpen, setAssignOpen] = useState(false)
  const assignRef = useRef(null)

  // Close assign dropdown on outside click
  useEffect(() => {
    if (!assignOpen) return
    function handleClick(e) {
      if (assignRef.current && !assignRef.current.contains(e.target)) {
        setAssignOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [assignOpen])

  function commitNote() {
    setEditField(null)
    if (noteVal.trim() !== (task.note || '').trim()) {
      onSave(task.id, { note: noteVal.trim() })
    }
  }

  function commitStatusNote() {
    setEditField(null)
    if (snoteVal.trim() !== (task.status_note || '').trim()) {
      onSave(task.id, { status_note: snoteVal.trim() })
    }
  }

  function assignTo(profileId) {
    setAssignOpen(false)
    if (profileId !== task.assigned_to) {
      onSave(task.id, { assigned_to: profileId || null })
    }
  }

  function toggleDone() {
    onSave(task.id, { status: task.status === 'Done' ? 'Open' : 'Done' })
  }

  const assignee = profiles.find(p => p.id === task.assigned_to)

  const rowStyle = {
    opacity: isDragging ? 0.4 : 1,
    background: isDragTarget ? 'var(--accent-glow)' : '#f7fff5',
    transition: 'background 0.1s',
  }

  return (
    <tr
      style={rowStyle}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* drag handle */}
      <td style={{ padding: '8px 4px', width: 28, cursor: 'grab' }}>
        <DragHandle />
      </td>

      {/* alias */}
      <td>{task.project?.client?.alias || '—'}</td>

      {/* project */}
      <td>{task.project?.name || '—'}</td>

      {/* task (note) */}
      <td className="td-main" style={{ minWidth: 160 }}>
        {editField === 'note' ? (
          <input
            autoFocus
            value={noteVal}
            onChange={e => setNoteVal(e.target.value)}
            onBlur={commitNote}
            onKeyDown={e => { if (e.key === 'Enter') commitNote(); if (e.key === 'Escape') { setNoteVal(task.note || ''); setEditField(null) } }}
            style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--accent)', borderRadius: 6, padding: '4px 8px', color: 'var(--text)', fontSize: 13 }}
          />
        ) : (
          <span
            onClick={() => { setNoteVal(task.note || ''); setEditField('note') }}
            style={{ cursor: 'text', display: 'block', minHeight: 22 }}
          >
            {task.note || <span style={{ color: 'var(--text3)' }}>Click to add…</span>}
          </span>
        )}
      </td>

      {/* status note */}
      <td style={{ minWidth: 140 }}>
        {editField === 'status_note' ? (
          <input
            autoFocus
            value={snoteVal}
            onChange={e => setSnoteVal(e.target.value)}
            onBlur={commitStatusNote}
            onKeyDown={e => { if (e.key === 'Enter') commitStatusNote(); if (e.key === 'Escape') { setSnoteVal(task.status_note || ''); setEditField(null) } }}
            style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--accent)', borderRadius: 6, padding: '4px 8px', color: 'var(--text)', fontSize: 13 }}
          />
        ) : (
          <span
            onClick={() => { setSnoteVal(task.status_note || ''); setEditField('status_note') }}
            style={{ cursor: 'text', display: 'block', minHeight: 22, color: task.status_note ? 'var(--text2)' : 'var(--text3)' }}
          >
            {task.status_note || 'Add note…'}
          </span>
        )}
      </td>

      {/* status */}
      <td style={{ fontWeight: 600, fontSize: 13 }}>{task.status || '—'}</td>

      {/* assigned */}
      <td style={{ position: 'relative' }} ref={assignRef}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {assignee
            ? <Avatar name={assignee.name} />
            : <div style={{ width: 26, height: 26, borderRadius: '50%', border: '1.5px dashed var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 14 }}>?</div>
          }
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={() => setAssignOpen(v => !v)}
            style={{ padding: '2px 4px', fontSize: 14, lineHeight: 1 }}
            title="Assign"
          >+</button>
        </div>
        {assignOpen && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, zIndex: 200,
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: 8, boxShadow: 'var(--shadow-lg)',
            minWidth: 160, padding: '4px 0',
          }}>
            <div
              onClick={() => assignTo(null)}
              style={{ padding: '8px 14px', cursor: 'pointer', fontSize: 13, color: 'var(--text3)' }}
            >— Unassigned</div>
            {profiles.map(p => (
              <div
                key={p.id}
                onClick={() => assignTo(p.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 14px', cursor: 'pointer', fontSize: 13,
                  background: p.id === task.assigned_to ? 'var(--accent-glow)' : undefined,
                  color: p.id === task.assigned_to ? 'var(--accent2)' : 'var(--text2)',
                }}
              >
                <Avatar name={p.name} size={22} />
                {p.name}
              </div>
            ))}
          </div>
        )}
      </td>

      {/* updated */}
      <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
        {fmtUpdated(task.updated_at, task.updater?.name)}
      </td>

      {/* actions */}
      <td style={{ padding: '8px 12px 8px 4px' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end' }}>
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={onAddBelow}
            title="Add task below"
            style={{ color: 'var(--text3)', border: '1px solid #333' }}
          ><PlusIcon /></button>
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={() => onDelete(task.id)}
            title="Delete task"
            style={{ color: 'var(--text3)', border: '1px solid #333' }}
          >
            <TrashIcon />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── NEW TASK ROW (unsaved) ────────────────────────────────────────────────────
function NewTaskRow({ row, projects, profiles, onChange, onCommit, onDiscard }) {
  const [assignOpen, setAssignOpen] = useState(false)
  const assignRef = useRef(null)

  useEffect(() => {
    if (!assignOpen) return
    function handleClick(e) {
      if (assignRef.current && !assignRef.current.contains(e.target)) {
        setAssignOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [assignOpen])

  const assignee = profiles.find(p => p.id === row.assigned_to)

  return (
    <tr style={{ background: 'var(--accent-glow)' }}>
      {/* drag handle placeholder */}
      <td style={{ width: 28 }} />

      {/* project selector (covers alias + project cols) */}
      <td colSpan={2}>
        <select
          value={row.project_id}
          onChange={e => onChange('project_id', e.target.value)}
          autoFocus
          style={{
            width: '100%', background: 'var(--bg3)', border: '1px solid var(--accent)',
            borderRadius: 6, padding: '5px 8px', color: 'var(--text)', fontSize: 13,
          }}
        >
          <option value="">— Select project —</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>
              {p.client?.company || p.client?.alias || '?'} · {p.product?.type} | {p.product?.name} · {p.name}
            </option>
          ))}
        </select>
      </td>

      {/* task text */}
      <td className="td-main">
        <input
          placeholder="Task description…"
          value={row.note}
          onChange={e => onChange('note', e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onCommit(); if (e.key === 'Escape') onDiscard() }}
          style={{
            width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)',
            borderRadius: 6, padding: '4px 8px', color: 'var(--text)', fontSize: 13,
          }}
        />
      </td>

      {/* note */}
      <td>
        <input
          placeholder="Add note…"
          value={row.status_note}
          onChange={e => onChange('status_note', e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onCommit(); if (e.key === 'Escape') onDiscard() }}
          style={{
            width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)',
            borderRadius: 6, padding: '4px 8px', color: 'var(--text)', fontSize: 13,
          }}
        />
      </td>

      {/* status placeholder */}
      <td />

      {/* assigned */}
      <td style={{ position: 'relative' }} ref={assignRef}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {assignee
            ? <Avatar name={assignee.name} />
            : <div style={{ width: 26, height: 26, borderRadius: '50%', border: '1.5px dashed var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 14 }}>?</div>
          }
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={() => setAssignOpen(v => !v)}
            style={{ padding: '2px 4px', fontSize: 14 }}
          >+</button>
        </div>
        {assignOpen && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, zIndex: 200,
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: 8, boxShadow: 'var(--shadow-lg)',
            minWidth: 160, padding: '4px 0',
          }}>
            {profiles.map(p => (
              <div
                key={p.id}
                onClick={() => { onChange('assigned_to', p.id); setAssignOpen(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 14px', cursor: 'pointer', fontSize: 13,
                  color: 'var(--text2)',
                }}
              >
                <Avatar name={p.name} size={22} />
                {p.name}
              </div>
            ))}
          </div>
        )}
      </td>

      {/* updated placeholder */}
      <td />

      {/* save / discard */}
      <td style={{ padding: '8px 12px 8px 4px', whiteSpace: 'nowrap' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="btn btn-primary btn-sm" onClick={onCommit}>Save</button>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onDiscard} title="Discard" style={{ color: 'var(--text3)' }}>✕</button>
        </div>
      </td>
    </tr>
  )
}

// ── CHECK ICON ────────────────────────────────────────────────────────────────
function CheckIcon({ done }) {
  return done
    ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
    : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/></svg>
}

function PlusIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
}

function TrashIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function TasksPage() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const [tasks,        setTasks]        = useState([])
  const [projects,     setProjects]     = useState([])
  const [profiles,     setProfiles]     = useState([])
  const [loading,      setLoading]      = useState(true)
  const [statusFilter, setStatusFilter] = useState('Normal')
  const [clientFilter, setClientFilter] = useState('')
  const [searchQuery,  setSearchQuery]  = useState('')
  const [newRows,      setNewRows]      = useState([])
  const [dragIdx,      setDragIdx]      = useState(null)
  const [productMap,   setProductMap]   = useState({})
  const dragOver = useRef(null)

  useEffect(() => { setLoading(true); load() }, [location.pathname])

  async function load() {
    setLoading(true)
    const [{ data: taskRows }, { data: projectRows }, { data: profileRows }, { data: productRows }] = await Promise.all([
      supabase
        .from('tasks')
        .select(`
          *,
          project:projects(id, name, product_type,
            client:clients(company, alias)
          ),
          updater:profiles!tasks_updated_by_fkey(name)
        `)
        .order('sort_order')
        .order('created_at'),
      supabase
        .from('projects')
        .select('id, name, product_type, client:clients(company,alias)')
        .neq('archived', true)
        .order('name'),
      supabase
        .from('profiles')
        .select('id, name, role')
        .order('name'),
      supabase
        .from('products')
        .select('type, name')
        .order('order_num', { nullsFirst: false }),
    ])
    setTasks(taskRows || [])
    setProjects((projectRows || []).sort((a, b) => {
      const ca = a.client?.company || a.client?.alias || ''
      const cb = b.client?.company || b.client?.alias || ''
      if (ca !== cb) return ca.localeCompare(cb)
      return (a.name || '').localeCompare(b.name || '')
    }))
    setProfiles(profileRows || [])
    const map = {}
    ;(productRows || []).forEach(p => { if (p.type) map[p.type] = p.name })
    setProductMap(map)
    setLoading(false)
  }

  // ── FILTER ─────────────────────────────────────────────────────────────────
  const clients = [...new Map(
    tasks
      .map(t => t.project?.client)
      .filter(Boolean)
      .map(c => [c.company || c.alias, c])
  ).values()].sort((a, b) => (a.company || a.alias || '').localeCompare(b.company || b.alias || ''))

  const filtered = tasks.filter(t => {
    if (t.status !== statusFilter) return false
    if (clientFilter) {
      const label = t.project?.client?.company || t.project?.client?.alias || ''
      if (label !== clientFilter) return false
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const haystack = [
        t.note,
        t.status_note,
        t.project?.name,
        t.project?.client?.company,
        t.project?.client?.alias,
        productLabel(t.project, productMap),
      ].join(' ').toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })

  // ── SAVE EXISTING ──────────────────────────────────────────────────────────
  async function saveTask(taskId, updates) {
    const { data } = await supabase
      .from('tasks')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', taskId)
      .select(`
        *,
        project:projects(id, name, product_type,
          client:clients(company, alias)
        ),
        updater:profiles!tasks_updated_by_fkey(name)
      `)
      .single()
    if (data) setTasks(ts => ts.map(t => t.id === taskId ? data : t))
  }

  // ── CREATE NEW ─────────────────────────────────────────────────────────────
  async function createTask(payload) {
    const { data } = await supabase
      .from('tasks')
      .insert(payload)
      .select(`
        *,
        project:projects(id, name, product_type,
          client:clients(company, alias)
        ),
        updater:profiles!tasks_updated_by_fkey(name)
      `)
      .single()
    if (data) setTasks(ts => [...ts, data])
    return data
  }

  // ── DELETE ─────────────────────────────────────────────────────────────────
  async function deleteTask(taskId) {
    await supabase.from('tasks').delete().eq('id', taskId)
    setTasks(ts => ts.filter(t => t.id !== taskId))
  }

  // ── INLINE ADD ─────────────────────────────────────────────────────────────
  function addRowAfter(contextTask) {
    setNewRows(rs => [...rs, {
      _tempId:    crypto.randomUUID(),
      project_id: contextTask?.project_id || '',
      note:       '',
      assigned_to: null,
      status_note: '',
      status:     statusFilter,
    }])
  }

  function updateNewRow(tempId, field, value) {
    setNewRows(rs => rs.map(r => r._tempId === tempId ? { ...r, [field]: value } : r))
  }

  async function commitNewRow(tempRow) {
    if (!tempRow.note.trim() && !tempRow.project_id) {
      setNewRows(rs => rs.filter(r => r._tempId !== tempRow._tempId))
      return
    }
    const maxOrder = tasks.reduce((m, t) => Math.max(m, t.sort_order || 0), 0)
    const saved = await createTask({
      project_id:  tempRow.project_id || null,
      note:        tempRow.note.trim(),
      assigned_to: tempRow.assigned_to || null,
      status_note: tempRow.status_note.trim() || null,
      status:      tempRow.status || statusFilter,
      sort_order:  maxOrder + 1,
    })
    if (saved) setNewRows(rs => rs.filter(r => r._tempId !== tempRow._tempId))
  }

  // ── DRAG AND DROP ──────────────────────────────────────────────────────────
  function handleDragStart(idx) { setDragIdx(idx) }

  function handleDragOver(e, idx) {
    e.preventDefault()
    dragOver.current = idx
    setDragIdx(d => d) // force re-render for target highlight
  }

  function handleDrop() {
    const from = dragIdx
    const to   = dragOver.current
    if (from === null || to === null || from === to) {
      setDragIdx(null); dragOver.current = null; return
    }
    const reordered = [...filtered]
    const [moved]   = reordered.splice(from, 1)
    reordered.splice(to, 0, moved)

    // Merge back if filtered (non-All view keeps other-status tasks)
    const others = tasks.filter(t => t.status !== statusFilter)
    setTasks([...reordered, ...others])

    reordered.forEach((t, i) => {
      supabase.from('tasks').update({ sort_order: i }).eq('id', t.id)
    })
    setDragIdx(null)
    dragOver.current = null
  }

  return (
    <div className="fade-in">
      <div className="topbar">
        <Breadcrumb segments={[{ label: 'Tasks' }]} />
        <PillNav tabs={STATUS_TABS} active={statusFilter} onChange={setStatusFilter} />
        <select
          value={clientFilter}
          onChange={e => setClientFilter(e.target.value)}
          style={{
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '5px 10px', color: clientFilter ? 'var(--text)' : 'var(--text3)',
            fontSize: 13, cursor: 'pointer',
          }}
        >
          <option value="">All clients</option>
          {clients.map(c => {
            const label = c.company || c.alias
            return <option key={label} value={label}>{label}</option>
          })}
        </select>
        <input
          type="search"
          placeholder="Search…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '5px 10px', color: 'var(--text)',
            fontSize: 13, width: 180, outline: 'none',
          }}
        />
        <button
          className="btn btn-primary"
          onClick={() => addRowAfter(filtered[filtered.length - 1])}
        >
          + Add task
        </button>
      </div>

      <div className="page-content">
        <div className="card">
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 28, padding: '10px 6px 10px 4px', background: '#9dc691', color: '#fff' }} />
                  <th style={{ background: '#9dc691', color: '#fff' }}>Alias</th>
                  <th style={{ background: '#9dc691', color: '#fff' }}>Project</th>
                  <th style={{ background: '#9dc691', color: '#fff' }}>Task</th>
                  <th style={{ background: '#9dc691', color: '#fff' }}>Note</th>
                  <th style={{ background: '#9dc691', color: '#fff' }}>Status</th>
                  <th style={{ background: '#9dc691', color: '#fff' }}>Assigned</th>
                  <th style={{ background: '#9dc691', color: '#fff' }}>Updated</th>
                  <th style={{ width: 72, background: '#9dc691', color: '#fff' }} />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text3)' }}>
                      Loading…
                    </td>
                  </tr>
                ) : filtered.length === 0 && newRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text3)' }}>
                      No {statusFilter.toLowerCase()} tasks
                    </td>
                  </tr>
                ) : (
                  <>
                    {newRows.map(row => (
                      <NewTaskRow
                        key={row._tempId}
                        row={row}
                        projects={projects}
                        profiles={profiles}
                        onChange={(f, v) => updateNewRow(row._tempId, f, v)}
                        onCommit={() => commitNewRow(row)}
                        onDiscard={() => setNewRows(rs => rs.filter(r => r._tempId !== row._tempId))}
                      />
                    ))}
                    {filtered.map((task, idx) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        idx={idx}
                        profiles={profiles}
                        projects={projects}
                        productMap={productMap}
                        onSave={saveTask}
                        onAddBelow={() => addRowAfter(task)}
                        onDelete={deleteTask}
                        isDragging={dragIdx === idx}
                        isDragTarget={dragOver.current === idx && dragIdx !== null && dragIdx !== idx}
                        onDragStart={() => handleDragStart(idx)}
                        onDragOver={e => handleDragOver(e, idx)}
                        onDrop={handleDrop}
                      />
                    ))}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
