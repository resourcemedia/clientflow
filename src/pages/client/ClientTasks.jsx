import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { Breadcrumb } from '../../components/ui'

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

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function Avatar({ name, size = 26 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'var(--accent)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.42, fontWeight: 600, color: '#fff',
      flexShrink: 0, userSelect: 'none',
    }}>
      {initials(name)}
    </div>
  )
}

function DragHandle() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" style={{ color: 'var(--text3)', cursor: 'grab' }}>
      <circle cx="4" cy="3"  r="1.2"/><circle cx="10" cy="3"  r="1.2"/>
      <circle cx="4" cy="7"  r="1.2"/><circle cx="10" cy="7"  r="1.2"/>
      <circle cx="4" cy="11" r="1.2"/><circle cx="10" cy="11" r="1.2"/>
    </svg>
  )
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

function QuickAddRow({ onCommit, onDiscard }) {
  const [note, setNote] = useState('')
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  return (
    <tr style={{ background: 'var(--accent-glow)' }}>
      <td style={{ width: 28 }} />
      <td colSpan={7}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '3px 0' }}>
          <input
            ref={inputRef}
            value={note}
            onChange={e => setNote(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') onCommit(note)
              if (e.key === 'Escape') onDiscard()
            }}
            placeholder="Task description…"
            style={{
              flex: 1, background: 'var(--bg3)', border: '1px solid var(--accent)',
              borderRadius: 6, padding: '4px 8px', color: 'var(--text)', fontSize: 13,
            }}
          />
          <button className="btn btn-primary btn-sm" onClick={() => onCommit(note)}>Save</button>
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={onDiscard}
            style={{ color: 'var(--text3)' }}
          >✕</button>
        </div>
      </td>
    </tr>
  )
}

function TaskRow({ task, profiles, projects, onSave, onAddBelow, onDelete, onDragStart, onDragOver, onDrop, isDragging, isDragTarget, highlighted, currentCycle, onStamp }) {
  const [editField,  setEditField]  = useState(null)
  const [noteVal,    setNoteVal]    = useState(task.note || '')
  const [snoteVal,   setSnoteVal]   = useState(task.status_note || '')
  const [assignOpen, setAssignOpen] = useState(false)
  const assignRef   = useRef(null)
  const noteValRef  = useRef(task.note || '')
  const snoteValRef = useRef(task.status_note || '')

  useEffect(() => {
    if (!assignOpen) return
    function handleClick(e) {
      if (assignRef.current && !assignRef.current.contains(e.target)) setAssignOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [assignOpen])

  function commitNote() {
    setEditField(null)
    if (noteValRef.current.trim() !== (task.note || '').trim()) onSave(task.id, { note: noteValRef.current.trim() })
  }

  function commitStatusNote() {
    setEditField(null)
    if (snoteValRef.current.trim() !== (task.status_note || '').trim()) onSave(task.id, { status_note: snoteValRef.current.trim() })
  }

  const assignee = profiles.find(p => p.id === task.assigned_to)
  const isHot    = task.status === 'Hot'

  return (
    <tr
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{
        opacity:    isDragging  ? 0.4 : 1,
        background: highlighted ? '#fff8e1' : isDragTarget ? 'var(--accent-glow)' : '#f7fff5',
        outline:    highlighted ? '2px solid #f59e0b' : 'none',
        outlineOffset: '-2px',
        transition: 'background 0.1s',
      }}
    >
      <td style={{ padding: '8px 4px', width: 28, cursor: 'grab', borderBottom: '1px solid #9dc691', borderRight: '1px solid #9dc691' }}>
        <DragHandle />
      </td>

      <td style={{ paddingLeft: 4, borderBottom: '1px solid #9dc691', borderRight: '1px solid #9dc691' }}>
        <div style={{ position: 'relative', display: 'inline-block', maxWidth: 200, minWidth: 200 }}>
          <select
            value={task.project_id || ''}
            onChange={e => onSave(task.id, { project_id: e.target.value || null })}
            style={{
              fontSize: 12, padding: '3px 6px', borderRadius: 6,
              border: '1px solid var(--border)', background: 'var(--bg2)',
              color: 'transparent', cursor: 'pointer', width: '100%',
            }}
          >
            {!task.project_id && <option value="">— None —</option>}
            {projects.map(p => {
              const alias = p.client?.alias || p.client?.company || '?'
              return <option key={p.id} value={p.id}>{alias} | {p.name}</option>
            })}
          </select>
          <span style={{
            position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)',
            fontSize: 12, color: 'var(--text)', pointerEvents: 'none',
            whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: 'calc(100% - 22px)',
          }}>
            {task.project_id
              ? (projects.find(p => p.id === task.project_id)?.name || '—')
              : '— None —'}
          </span>
        </div>
      </td>

      <td className="td-main" style={{ minWidth: 160, borderBottom: '1px solid #9dc691', borderRight: '1px solid #9dc691' }}>
        {editField === 'note' ? (
          <textarea
            autoFocus
            ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }}
            value={noteVal}
            onChange={e => { setNoteVal(e.target.value); noteValRef.current = e.target.value; e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
            onBlur={commitNote}
            onKeyDown={e => { if (e.key === 'Escape') { setNoteVal(task.note || ''); noteValRef.current = task.note || ''; setEditField(null) } }}
            style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--accent)', borderRadius: 6, padding: '4px 8px', color: 'var(--text)', fontSize: 13, resize: 'none', lineHeight: '1.4', boxSizing: 'border-box', overflow: 'hidden', minHeight: 28 }}
          />
        ) : (
          <span
            onClick={() => { setNoteVal(task.note || ''); noteValRef.current = task.note || ''; setEditField('note') }}
            style={{ cursor: 'text', display: 'block', minHeight: 22, whiteSpace: 'pre-wrap' }}
          >
            {task.note || <span style={{ color: 'var(--text3)' }}>Click to add…</span>}
          </span>
        )}
      </td>

      <td style={{ minWidth: 120, borderBottom: '1px solid #9dc691', borderRight: '1px solid #9dc691' }}>
        {editField === 'status_note' ? (
          <textarea
            autoFocus
            ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }}
            value={snoteVal}
            onChange={e => { setSnoteVal(e.target.value); snoteValRef.current = e.target.value; e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
            onBlur={commitStatusNote}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitStatusNote() }
              if (e.key === 'Escape') { setSnoteVal(task.status_note || ''); snoteValRef.current = task.status_note || ''; setEditField(null) }
            }}
            style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--accent)', borderRadius: 6, padding: '4px 8px', color: 'var(--text)', fontSize: 13, resize: 'none', lineHeight: '1.4', boxSizing: 'border-box', overflow: 'hidden', minHeight: 28 }}
          />
        ) : (
          <span
            onClick={() => { setSnoteVal(task.status_note || ''); snoteValRef.current = task.status_note || ''; setEditField('status_note') }}
            style={{ cursor: 'text', display: 'block', minHeight: 22, color: task.status_note ? 'var(--text2)' : 'var(--text3)', whiteSpace: 'pre-wrap' }}
          >
            {task.status_note || 'Add note…'}
          </span>
        )}
      </td>

      <td style={{ width: 52, textAlign: 'center', borderBottom: '1px solid #9dc691', borderRight: '1px solid #9dc691' }}>
        <button
          onClick={() => onSave(task.id, { status: isHot ? 'Normal' : 'Hot' })}
          title={isHot ? 'Hot — click for Normal' : 'Normal — click for Hot'}
          style={{
            width: 32, height: 32, border: 'none', background: 'none',
            cursor: 'pointer', padding: 0, margin: '0 auto',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div style={{
            width: 14, height: 14, borderRadius: '50%',
            background: isHot ? '#e05252' : '#6ab04c',
            flexShrink: 0,
          }} />
        </button>
      </td>

      <td style={{ position: 'relative', borderBottom: '1px solid #9dc691', borderRight: '1px solid #9dc691' }} ref={assignRef}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {assignee
            ? <Avatar name={assignee.name} />
            : <div style={{ width: 26, height: 26, borderRadius: '50%', border: '1.5px dashed var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 14 }}>?</div>
          }
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={() => setAssignOpen(v => !v)}
            style={{ padding: '2px 4px', fontSize: 14, lineHeight: 1 }}
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
              onClick={() => { onSave(task.id, { assigned_to: null }); setAssignOpen(false) }}
              style={{ padding: '8px 14px', cursor: 'pointer', fontSize: 13, color: 'var(--text3)' }}
            >— Unassigned</div>
            {profiles.map(p => (
              <div
                key={p.id}
                onClick={() => { onSave(task.id, { assigned_to: p.id }); setAssignOpen(false) }}
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

      <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap', borderBottom: '1px solid #9dc691', borderRight: '1px solid #9dc691' }}>
        {fmtUpdated(task.updated_at, task.updater?.name)}
      </td>

      <td style={{ padding: '8px 12px 8px 4px', borderBottom: '1px solid #9dc691' }}>
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
          ><TrashIcon /></button>
        </div>
      </td>
    </tr>
  )
}

export default function ClientTasks() {
  const location    = useLocation()
  const { profile } = useAuth()

  const [tasks,        setTasks]        = useState([])
  const [projects,     setProjects]     = useState([])
  const [profiles,     setProfiles]     = useState([])
  const [loading,      setLoading]      = useState(true)
  const [currentCycle, setCurrentCycle] = useState('A')

  const [clientFilter,  setClientFilter]  = useState('')
  const [projectFilter, setProjectFilter] = useState('')

  const [activeBtn,         setActiveBtn]         = useState('All')
  const [filteredProjectId, setFilteredProjectId] = useState(null)
  const [hotHighlightId,    setHotHighlightId]    = useState(null)

  const [projectDeck,    setProjectDeck]    = useState([])
  const [projectDeckPos, setProjectDeckPos] = useState(0)
  const [hotDeck,        setHotDeck]        = useState([])
  const [hotDeckPos,     setHotDeckPos]     = useState(0)

  const [newRows, setNewRows] = useState([])

  const [dragIdx, setDragIdx] = useState(null)
  const dragOver = useRef(null)

  useEffect(() => {
    if (!profile?.client_id) return
    let isMounted = true
    async function load() {
      setLoading(true)
      const clientId = profile.client_id

      const { data: projectRows } = await supabase
        .from('projects')
        .select('id, name, product_type, client:clients(company, alias)')
        .eq('client_id', clientId)
        .neq('archived', true)
        .order('name')

      const projectIds = (projectRows || []).map(p => p.id)
      if (!projectIds.length) {
        if (!isMounted) return
        setTasks([])
        setProjects([])
        setProfiles([])
        setLoading(false)
        return
      }

      const [{ data: taskRows }, { data: profileRows }, { data: settingsRow }] = await Promise.all([
        supabase
          .from('tasks')
          .select(`
            *,
            project:projects(id, name, product_type, cycle_tag,
              client:clients(company, alias)
            ),
            updater:profiles!tasks_updated_by_fkey(name)
          `)
          .in('project_id', projectIds)
          .order('sort_order')
          .order('created_at'),
        supabase
          .from('profiles')
          .select('id, name, role')
          .order('name'),
        supabase
          .from('app_config')
          .select('current_cycle')
          .eq('id', 1)
          .maybeSingle(),
      ])

      if (!isMounted) return
      setTasks(taskRows || [])
      setCurrentCycle(settingsRow?.current_cycle || 'A')
      setProjects((projectRows || []).sort((a, b) => {
        const ca = a.client?.company || a.client?.alias || ''
        const cb = b.client?.company || b.client?.alias || ''
        if (ca !== cb) return ca.localeCompare(cb)
        return (a.name || '').localeCompare(b.name || '')
      }))
      setProfiles(profileRows || [])
      setLoading(false)
    }
    load()
    return () => { isMounted = false }
  }, [location.pathname, profile?.client_id])

  const filtered = tasks.filter(t => {
    if (clientFilter) {
      const alias = (t.project?.client?.alias || t.project?.client?.company || '').toLowerCase()
      if (!alias.includes(clientFilter.toLowerCase())) return false
    }
    if (projectFilter) {
      const pname = (t.project?.name || '').toLowerCase()
      if (!pname.includes(projectFilter.toLowerCase())) return false
    }
    if (activeBtn === 'Hot')           return t.status === 'Hot'
    if (activeBtn === 'RandomProject') return t.project_id === filteredProjectId
    if (activeBtn === 'RandomHot')     return t.status === 'Hot'
    return true
  })

  const textFiltered = tasks.filter(t => {
    if (!t.project_id) return false
    if (clientFilter) {
      const alias = (t.project?.client?.alias || t.project?.client?.company || '').toLowerCase()
      if (!alias.includes(clientFilter.toLowerCase())) return false
    }
    if (projectFilter) {
      const pname = (t.project?.name || '').toLowerCase()
      if (!pname.includes(projectFilter.toLowerCase())) return false
    }
    return true
  })
  const cycleSeenIds  = new Set()
  const cycleProjects = []
  for (const t of textFiltered) {
    if (!cycleSeenIds.has(t.project_id)) {
      cycleSeenIds.add(t.project_id)
      cycleProjects.push(t)
    }
  }
  const cycleTotal     = cycleProjects.length
  const cycleRemaining = cycleProjects.filter(
    t => !t.project?.cycle_tag || t.project.cycle_tag !== currentCycle
  ).length

  async function saveTask(taskId, updates) {
    const { data } = await supabase
      .from('tasks')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', taskId)
      .select(`
        *,
        project:projects(id, name, product_type, cycle_tag,
          client:clients(company, alias)
        ),
        updater:profiles!tasks_updated_by_fkey(name)
      `)
      .single()
    if (data) setTasks(ts => ts.map(t => t.id === taskId ? data : t))
  }

  async function createTask(payload) {
    const { data } = await supabase
      .from('tasks')
      .insert(payload)
      .select(`
        *,
        project:projects(id, name, product_type, cycle_tag,
          client:clients(company, alias)
        ),
        updater:profiles!tasks_updated_by_fkey(name)
      `)
      .single()
    if (data) setTasks(ts => [...ts, data])
    return data
  }

  async function stampProject(projectId) {
    setTasks(ts => ts.map(t =>
      t.project_id === projectId
        ? { ...t, project: { ...t.project, cycle_tag: currentCycle } }
        : t
    ))
    await supabase.from('projects').update({ cycle_tag: currentCycle }).eq('id', projectId)
  }

  async function deleteTask(taskId) {
    await supabase.from('tasks').delete().eq('id', taskId)
    setTasks(ts => ts.filter(t => t.id !== taskId))
  }

  const unassignedProject = projects.find(p =>
    (p.client?.alias || p.client?.company || '').toLowerCase() === 'unassigned' ||
    p.name?.toLowerCase() === 'unassigned'
  )

  async function commitQuickAdd(tempId, note, projectId) {
    setNewRows(rs => rs.filter(r => r._tempId !== tempId))
    const trimmed = note?.trim()
    if (!trimmed) return
    const maxOrder = tasks.reduce((m, t) => Math.max(m, t.sort_order || 0), 0)
    await createTask({
      project_id:  projectId || null,
      note:        trimmed,
      status:      'Normal',
      sort_order:  maxOrder + 1,
    })
  }

  function addNewRow(projectId) {
    setNewRows(rs => [...rs, { _tempId: crypto.randomUUID(), project_id: projectId || null }])
  }

  function handleDragStart(idx) { setDragIdx(idx) }

  function handleDragOver(e, idx) {
    e.preventDefault()
    dragOver.current = idx
    setDragIdx(d => d)
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
    const filteredIds = new Set(filtered.map(t => t.id))
    const others = tasks.filter(t => !filteredIds.has(t.id))
    setTasks([...reordered, ...others])
    reordered.forEach((t, i) => {
      supabase.from('tasks').update({ sort_order: i }).eq('id', t.id)
    })
    setDragIdx(null)
    dragOver.current = null
  }

  function handleAll() {
    setActiveBtn('All')
    setFilteredProjectId(null)
    setHotHighlightId(null)
  }

  function handleHot() {
    setActiveBtn('Hot')
    setFilteredProjectId(null)
    setHotHighlightId(null)
  }

  async function handleRandomProject() {
    const baseTasks = tasks.filter(t => {
      if (!t.project_id) return false
      if (clientFilter) {
        const alias = (t.project?.client?.alias || t.project?.client?.company || '').toLowerCase()
        if (!alias.includes(clientFilter.toLowerCase())) return false
      }
      if (projectFilter) {
        const pname = (t.project?.name || '').toLowerCase()
        if (!pname.includes(projectFilter.toLowerCase())) return false
      }
      return true
    })

    const seenIds = new Set()
    let pool = []
    for (const t of baseTasks) {
      if (!seenIds.has(t.project_id)) {
        seenIds.add(t.project_id)
        if (!t.project?.cycle_tag || t.project.cycle_tag !== currentCycle) {
          pool.push(t.project_id)
        }
      }
    }

    let activeCycle = currentCycle
    let cycleAdvanced = false
    if (pool.length === 0) {
      activeCycle = activeCycle
        ? String.fromCharCode(((activeCycle.charCodeAt(0) - 65 + 1) % 26) + 65)
        : 'A'
      await supabase.from('app_config').update({ current_cycle: activeCycle }).eq('id', 1)
      setCurrentCycle(activeCycle)

      const seen2 = new Set()
      pool = []
      for (const t of baseTasks) {
        if (!seen2.has(t.project_id)) {
          seen2.add(t.project_id)
          pool.push(t.project_id)
        }
      }
      cycleAdvanced = true
    }

    if (pool.length === 0) return

    const poolSet = new Set(pool)
    let deck = cycleAdvanced ? [] : projectDeck.filter(id => poolSet.has(id))
    let pos  = cycleAdvanced ? 0  : projectDeckPos

    if (deck.length === 0 || pos >= deck.length) {
      deck = shuffle(pool)
      pos  = 0
      setProjectDeck(deck)
    }

    setActiveBtn('RandomProject')
    setFilteredProjectId(deck[pos])
    setProjectDeckPos(pos + 1)
    setHotHighlightId(null)
  }

  function handleRandomHot() {
    const hotIds = tasks.filter(t => t.status === 'Hot').map(t => t.id)
    if (hotIds.length === 0) return

    const poolSet   = new Set(hotIds)
    const validDeck = hotDeck.filter(id => poolSet.has(id))
    let   deck      = validDeck
    let   pos       = hotDeckPos

    if (deck.length === 0 || pos >= deck.length) {
      deck = shuffle(hotIds)
      pos  = 0
      setHotDeck(deck)
    }

    setActiveBtn('RandomHot')
    setHotHighlightId(deck[pos])
    setHotDeckPos(pos + 1)
    setFilteredProjectId(null)
  }

  const ACTIVE_COLORS = {
    All:           '#6b7280',
    RandomProject: '#6ab04c',
    RandomHot:     '#e05252',
    Hot:           '#e05252',
  }

  function execBtnStyle(key) {
    const active = activeBtn === key
    const color  = ACTIVE_COLORS[key]
    return {
      padding: '5px 12px', borderRadius: 6, cursor: 'pointer',
      border:     `1px solid ${active ? color : 'var(--border)'}`,
      background: active ? color : 'transparent',
      color:      active ? '#fff' : 'var(--text2)',
      fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
    }
  }

  return (
    <div className="fade-in">
      <div className="topbar">
        <Breadcrumb segments={[{ label: 'Tasks' }]} />

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            placeholder="Project"
            value={projectFilter}
            onChange={e => setProjectFilter(e.target.value)}
            style={{
              background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '5px 10px', color: 'var(--text)',
              fontSize: 13, width: 130, outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button style={execBtnStyle('All')}           onClick={handleAll}>All</button>
          <button style={execBtnStyle('Hot')}           onClick={handleHot}>Hot</button>
          <button
            className="btn btn-primary"
            onClick={() => addNewRow(unassignedProject?.id)}
          >+ Add Task</button>
        </div>
      </div>

      <div className="page-content">
        <div className="card">
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 28, padding: '10px 6px 10px 4px', background: '#9dc691', color: '#fff' }} />
                  <th style={{ background: '#9dc691', color: '#fff' }}>Project</th>
                  <th style={{ background: '#9dc691', color: '#fff' }}>Task</th>
                  <th style={{ background: '#9dc691', color: '#fff' }}>Note</th>
                  <th style={{ width: 52, background: '#9dc691', color: '#fff' }}>Status</th>
                  <th style={{ background: '#9dc691', color: '#fff' }}>Assigned</th>
                  <th style={{ background: '#9dc691', color: '#fff' }}>Updated</th>
                  <th style={{ width: 72, background: '#9dc691', color: '#fff' }} />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text3)' }}>
                      Loading…
                    </td>
                  </tr>
                ) : filtered.length === 0 && newRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text3)' }}>
                      No tasks
                    </td>
                  </tr>
                ) : (
                  <>
                    {newRows.map(row => (
                      <QuickAddRow
                        key={row._tempId}
                        onCommit={note => commitQuickAdd(row._tempId, note, row.project_id)}
                        onDiscard={() => setNewRows(rs => rs.filter(r => r._tempId !== row._tempId))}
                      />
                    ))}
                    {filtered.map((task, idx) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        profiles={profiles}
                        projects={projects}
                        onSave={saveTask}
                        onAddBelow={() => addNewRow(task.project_id)}
                        onDelete={deleteTask}
                        isDragging={dragIdx === idx}
                        isDragTarget={dragOver.current === idx && dragIdx !== null && dragIdx !== idx}
                        onDragStart={() => handleDragStart(idx)}
                        onDragOver={e => handleDragOver(e, idx)}
                        onDrop={handleDrop}
                        highlighted={activeBtn === 'RandomHot' && task.id === hotHighlightId}
                        currentCycle={currentCycle}
                        onStamp={stampProject}
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
