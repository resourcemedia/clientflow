import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Breadcrumb } from '../components/ui'

function todayISO() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const CATEGORY_COLORS = {
  primary:    '#ffb8b8',
  secondary:  '#4fd1b8',
  accounting: '#63ca7a',
  overhead:   '#b9dd67',
  charity:    '#c6c7fe',
  personal:   '#ebb8e5',
}

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

// ── SHARED COMPONENTS ─────────────────────────────────────────────────────────
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

function ChainIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
  </svg>
}

function ExternalLinkIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
    <polyline points="15 3 21 3 21 9"/>
    <line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
}

// ── QUICK ADD ROW ─────────────────────────────────────────────────────────────
function QuickAddRow({ onCommit, onDiscard }) {
  const [note, setNote] = useState('')
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  return (
    <tr style={{ background: 'var(--accent-glow)' }}>
      <td style={{ width: 28 }} />
      <td style={{ width: 36 }} />
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

// ── TASK ROW ─────────────────────────────────────────────────────────────────
function TaskRow({ task, profiles, projects, onSave, onToggleVisible, onContext, isContext, onAddBelow, onDelete, onDragStart, onDragOver, onDrop, isDragging, isDragTarget, highlighted, onCycleToggle, onStartEdit, onEndEdit }) {
  const [editField,  setEditField]  = useState(null)
  const [noteVal,    setNoteVal]    = useState(task.note || '')
  const [snoteVal,   setSnoteVal]   = useState(task.status_note || '')
  const [assignOpen, setAssignOpen] = useState(false)
  const [linkOpen,   setLinkOpen]   = useState(false)
  const [linkDraft,  setLinkDraft]  = useState('')
  const assignRef   = useRef(null)
  const linkRef     = useRef(null)
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

  useEffect(() => {
    if (!linkOpen) return
    setLinkDraft(task.link_url || '')
    function handleClick(e) {
      if (linkRef.current && !linkRef.current.contains(e.target)) setLinkOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [linkOpen])

  async function saveLink() {
    const trimmed = linkDraft.trim()
    await onSave(task.id, { link_url: trimmed || null })
    setLinkOpen(false)
  }

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
      {/* drag handle */}
      <td style={{ padding: '8px 4px', width: 28, cursor: 'grab', borderBottom: '1px solid #9dc691', borderRight: '1px solid #9dc691' }}>
        <DragHandle />
      </td>

      {/* cycle date tag */}
      <td
        onClick={() => onCycleToggle(task.id, task.cycle_date)}
        style={{ width: 56, textAlign: 'center', padding: '0 4px', borderBottom: '1px solid #9dc691', borderRight: '1px solid #9dc691', cursor: 'pointer' }}
      >
        {task.cycle_date ? (() => {
          const today = todayISO()
          const parts = task.cycle_date.split('-')
          const label = `${parseInt(parts[1])}/${parseInt(parts[2])}`
          return (
            <span style={{
              background: task.cycle_date === today ? '#22c55e' : '#ef4444',
              color: '#fff', borderRadius: 4,
              padding: '2px 6px', fontSize: 11, fontWeight: 600, display: 'inline-block',
            }}>{label}</span>
          )
        })() : (
          <span style={{
            display: 'inline-block', width: 40, height: 22,
            border: '1.5px solid var(--border2)', borderRadius: 4,
          }} />
        )}
      </td>

      {/* alias */}
      <td style={{ fontSize: 13, color: 'var(--text2)', whiteSpace: 'nowrap', paddingRight: 4, borderBottom: '1px solid #9dc691', borderRight: '1px solid #9dc691' }}>
        {task.project?.client?.alias || task.project?.client?.company || '—'}
      </td>

      {/* project dropdown */}
      <td style={{ paddingLeft: 4, borderBottom: '1px solid #9dc691', borderRight: '1px solid #9dc691' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: CATEGORY_COLORS[task.project?.category] || '#e5e7eb' }} />
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
        </div>
      </td>

      {/* task note */}
      <td className="td-main" style={{ minWidth: 160, borderBottom: '1px solid #9dc691', borderRight: '1px solid #9dc691' }}>
        {editField === 'note' ? (
          <textarea
            autoFocus
            ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }}
            value={noteVal}
            onChange={e => { setNoteVal(e.target.value); noteValRef.current = e.target.value; e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
            onFocus={onStartEdit}
            onBlur={() => { commitNote(); onEndEdit?.() }}
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

      {/* status note */}
      <td style={{ minWidth: 120, borderBottom: '1px solid #9dc691', borderRight: '1px solid #9dc691' }}>
        {editField === 'status_note' ? (
          <textarea
            autoFocus
            ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }}
            value={snoteVal}
            onChange={e => { setSnoteVal(e.target.value); snoteValRef.current = e.target.value; e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
            onFocus={onStartEdit}
            onBlur={() => { commitStatusNote(); onEndEdit?.() }}
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

      {/* status dot — click to toggle Normal ↔ Hot */}
      <td style={{ width: 52, textAlign: 'center', borderBottom: '1px solid #9dc691', borderRight: '1px solid #9dc691' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          <button
            onClick={() => onSave(task.id, { status: isHot ? 'Normal' : 'Hot' })}
            title={isHot ? 'Hot — click for Normal' : 'Normal — click for Hot'}
            style={{ width: 20, height: 20, border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <div style={{ width: 13, height: 13, borderRadius: '50%', background: isHot ? '#e05252' : '#6ab04c', flexShrink: 0 }} />
          </button>
          <button
            onClick={() => onToggleVisible(task.id, task.visible)}
            title={task.visible === false ? 'Hidden — click to show' : 'Visible — click to hide'}
            style={{ width: 20, height: 20, border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <div style={{ width: 13, height: 13, borderRadius: '50%', background: task.visible === false ? '#d1d5db' : '#6b7280', flexShrink: 0 }} />
          </button>
          <button
            onClick={() => onContext(task)}
            title={isContext ? 'Exit context view' : 'Show project context'}
            style={{ width: 20, height: 20, border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <div style={{ width: 13, height: 13, borderRadius: '50%', background: isContext ? '#3b82f6' : '#bfdbfe', flexShrink: 0 }} />
          </button>
        </div>
      </td>

      {/* assigned */}
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

      {/* updated */}
      <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap', borderBottom: '1px solid #9dc691', borderRight: '1px solid #9dc691' }}>
        {fmtUpdated(task.updated_at, task.updater?.name)}
      </td>

      {/* actions */}
      <td style={{ padding: '8px 12px 8px 4px', borderBottom: '1px solid #9dc691', position: 'relative' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end' }}>

          {/* link button group + popover */}
          <div ref={linkRef} style={{ position: 'relative' }}>
            <div style={{ display: 'flex', border: '1px solid #333', borderRadius: 6, overflow: 'hidden' }}>
              <button
                title={task.link_url ? 'Edit link' : 'Add link'}
                onClick={() => setLinkOpen(v => !v)}
                style={{
                  width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: task.link_url ? 'var(--green)' : 'transparent',
                  border: 'none', borderRight: '1px solid #333',
                  cursor: 'pointer',
                  color: task.link_url ? '#fff' : 'var(--text3)',
                }}
              ><ChainIcon /></button>
              <button
                title="Open link"
                onClick={() => task.link_url && window.open(task.link_url, '_blank')}
                disabled={!task.link_url}
                style={{
                  width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: task.link_url ? 'var(--green)' : 'transparent',
                  border: 'none',
                  cursor: task.link_url ? 'pointer' : 'default',
                  color: task.link_url ? '#fff' : 'var(--text3)',
                  opacity: task.link_url ? 1 : 0.4,
                }}
              ><ExternalLinkIcon /></button>
            </div>

            {linkOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 300,
                background: 'var(--bg2)', border: '1px solid var(--border)',
                borderRadius: 8, boxShadow: 'var(--shadow-lg)',
                padding: '8px 10px', display: 'flex', gap: 8, alignItems: 'center',
                minWidth: 260,
              }}>
                <input
                  autoFocus
                  type="text"
                  value={linkDraft}
                  onChange={e => setLinkDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveLink(); if (e.key === 'Escape') setLinkOpen(false) }}
                  placeholder="https://…"
                  style={{
                    flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)',
                    borderRadius: 6, padding: '5px 8px', fontSize: 12,
                    color: 'var(--text)', outline: 'none',
                  }}
                />
                <button className="btn btn-primary btn-sm" onClick={saveLink}>Save</button>
              </div>
            )}
          </div>

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

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function TasksPage() {
  useEffect(() => { document.title = 'Tasks' }, [])
  const location = useLocation()

  const [tasks,        setTasks]        = useState([])
  const [projects,     setProjects]     = useState([])
  const [profiles,     setProfiles]     = useState([])
  const [loading,      setLoading]      = useState(true)

  // text filters
  const [clientFilter,   setClientFilter]   = useState(() => localStorage.getItem('tasks_clientFilter')   || '')
  const [projectFilter,  setProjectFilter]  = useState(() => localStorage.getItem('tasks_projectFilter')  || '')
  const [categoryFilter, setCategoryFilter] = useState(() => localStorage.getItem('tasks_categoryFilter') || '')

  // execution buttons
  const [activeBtn, setActiveBtn] = useState(() => {
    const saved = localStorage.getItem('tasks_activeBtn')
    return (saved === 'Hot') ? 'Hot' : 'All'
  })
  const [filteredProjectId, setFilteredProjectId] = useState(null)
  const [filteredTaskId,    setFilteredTaskId]    = useState(null)
  const [hotHighlightId,    setHotHighlightId]    = useState(null)
  const [showMode, setShowMode] = useState(() => localStorage.getItem('tasks_showMode') || 'show')

  const [contextTaskId, setContextTaskId] = useState(null)
  const [editingTaskId, setEditingTaskId] = useState(null)
  const savedFilters = useRef(null)

  useEffect(() => {
    localStorage.setItem('tasks_clientFilter',   clientFilter)
    localStorage.setItem('tasks_projectFilter',  projectFilter)
    localStorage.setItem('tasks_categoryFilter', categoryFilter)
    localStorage.setItem('tasks_activeBtn',      activeBtn)
    localStorage.setItem('tasks_showMode',       showMode)
  }, [clientFilter, projectFilter, categoryFilter, activeBtn, showMode])

  // inline add rows
  const [newRows, setNewRows] = useState([])

  // drag state
  const [dragIdx, setDragIdx] = useState(null)
  const dragOver = useRef(null)

  useEffect(() => {
    let isMounted = true
    async function load() {
      setLoading(true)
      const [{ data: taskRows }, { data: projectRows }, { data: profileRows }] = await Promise.all([
        supabase
          .from('tasks')
          .select(`
            *,
            project:projects(id, name, product_type, cycle_tag, category,
              client:clients(company, alias)
            ),
            updater:profiles!tasks_updated_by_fkey(name)
          `)
          .order('sort_order')
          .order('created_at'),
        supabase
          .from('projects')
          .select('id, name, product_type, client:clients(company, alias)')
          .neq('archived', true)
          .order('name'),
        supabase
          .from('profiles')
          .select('id, name, role')
          .order('name'),
      ])
      if (!isMounted) return
      setTasks(taskRows || [])
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
  }, [location.pathname])

  // ── FILTERING ──────────────────────────────────────────────────────────────
  const filtered = tasks.filter(t => {
    if (t.id === editingTaskId) return true
    if (clientFilter) {
      const alias = (t.project?.client?.alias || t.project?.client?.company || '').toLowerCase()
      if (!alias.includes(clientFilter.toLowerCase())) return false
    }
    if (projectFilter) {
      const pname = (t.project?.name || '').toLowerCase()
      if (!pname.includes(projectFilter.toLowerCase())) return false
    }
    if (categoryFilter && t.id !== editingTaskId && t.project?.category != null && t.project.category !== categoryFilter) return false
    if (activeBtn === 'Hot')           { if (t.status !== 'Hot') return false }
    if (activeBtn === 'RandomProject') {
      if (filteredTaskId != null ? t.id !== filteredTaskId : t.project_id !== filteredProjectId) return false
    }
    if (activeBtn === 'RandomHot')     { if (t.id !== filteredTaskId) return false }
    if (showMode === 'hide' && t.visible === false) return false
    return true
  })

  // ── SAVE ───────────────────────────────────────────────────────────────────
  async function toggleTaskVisible(taskId, currentVisible) {
    const newVal = currentVisible === false ? true : false
    setTasks(ts => ts.map(t => t.id === taskId ? { ...t, visible: newVal } : t))
    const { error } = await supabase.from('tasks').update({ visible: newVal }).eq('id', taskId)
    if (error) setTasks(ts => ts.map(t => t.id === taskId ? { ...t, visible: currentVisible } : t))
  }

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

  // ── CREATE ─────────────────────────────────────────────────────────────────
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

  // ── CYCLE DATE TOGGLE ─────────────────────────────────────────────────────
  async function toggleCycleDate(taskId, currentCycleDate) {
    const today = todayISO()
    const newDate = currentCycleDate === today ? null : today
    setTasks(ts => ts.map(t => t.id === taskId ? { ...t, cycle_date: newDate } : t))
    await supabase.from('tasks').update({ cycle_date: newDate }).eq('id', taskId)
  }

  // ── DELETE ─────────────────────────────────────────────────────────────────
  async function deleteTask(taskId) {
    await supabase.from('tasks').delete().eq('id', taskId)
    setTasks(ts => ts.filter(t => t.id !== taskId))
  }

  // ── QUICK ADD ──────────────────────────────────────────────────────────────
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
      link_url:    null,
    })
  }

  function addNewRow(projectId) {
    setNewRows(rs => [...rs, { _tempId: crypto.randomUUID(), project_id: projectId || null }])
  }

  // ── DRAG AND DROP ──────────────────────────────────────────────────────────
  function handleDragStart(idx) { setDragIdx(idx) }

  function handleDragOver(e, idx) {
    e.preventDefault()
    dragOver.current = idx
    setDragIdx(d => d)
  }

  async function handleDrop() {
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
    const merged = [...reordered, ...others]
    setTasks(merged)
    await Promise.all(
      merged.map((t, i) => supabase.from('tasks').update({ sort_order: i }).eq('id', t.id))
    )
    setDragIdx(null)
    dragOver.current = null
  }

  // ── EXECUTION BUTTON HANDLERS ─────────────────────────────────────────────
  function handleContext(task) {
    if (contextTaskId === task.id) {
      const s = savedFilters.current
      setClientFilter(s.clientFilter)
      setProjectFilter(s.projectFilter)
      localStorage.setItem('tasks_clientFilter', s.clientFilter)
      localStorage.setItem('tasks_projectFilter', s.projectFilter)
      setActiveBtn(s.activeBtn)
      setFilteredProjectId(s.filteredProjectId)
      setFilteredTaskId(null)
      setHotHighlightId(s.hotHighlightId)
      setShowMode(s.showMode)
      savedFilters.current = null
      setContextTaskId(null)
    } else {
      savedFilters.current = { clientFilter, projectFilter, activeBtn, filteredProjectId, hotHighlightId, showMode }
      setClientFilter('')
      setProjectFilter('')
      setActiveBtn('RandomProject')
      setFilteredProjectId(task.project_id)
      setFilteredTaskId(null)
      setHotHighlightId(null)
      setContextTaskId(task.id)
    }
  }

  function handleAll() {
    setActiveBtn('All')
    setFilteredProjectId(null)
    setFilteredTaskId(null)
    setHotHighlightId(null)
  }

  function handleHot() {
    setActiveBtn('Hot')
    setFilteredProjectId(null)
    setFilteredTaskId(null)
    setHotHighlightId(null)
  }

  function handleRandomProject() {
    const today = todayISO()
    const pool = tasks.filter(t => {
      if (!t.project_id) return false
      if (clientFilter) {
        const alias = (t.project?.client?.alias || t.project?.client?.company || '').toLowerCase()
        if (!alias.includes(clientFilter.toLowerCase())) return false
      }
      if (projectFilter) {
        const pname = (t.project?.name || '').toLowerCase()
        if (!pname.includes(projectFilter.toLowerCase())) return false
      }
      if (categoryFilter && t.project?.category !== categoryFilter) return false
      return !t.cycle_date || t.cycle_date < today
    })
    if (pool.length === 0) return
    const picked = pool[Math.floor(Math.random() * pool.length)]
    setActiveBtn('RandomProject')
    setFilteredTaskId(picked.id)
    setFilteredProjectId(null)
    setHotHighlightId(null)
  }

  function handleRandomHot() {
    const today = todayISO()
    const pool = tasks.filter(t => {
      if (t.status !== 'Hot') return false
      if (categoryFilter && t.project?.category !== categoryFilter) return false
      return !t.cycle_date || t.cycle_date < today
    })
    if (pool.length === 0) return
    const picked = pool[Math.floor(Math.random() * pool.length)]
    setActiveBtn('RandomHot')
    setFilteredTaskId(picked.id)
    setHotHighlightId(picked.id)
    setFilteredProjectId(null)
  }

  // ── BUTTON STYLES ──────────────────────────────────────────────────────────
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

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="fade-in">
      <div className="topbar">
        <Breadcrumb segments={[{ label: 'Tasks' }]} />

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            placeholder="Client"
            value={clientFilter}
            onChange={e => { setClientFilter(e.target.value); localStorage.setItem('tasks_clientFilter', e.target.value) }}
            style={{
              background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '5px 10px', color: 'var(--text)',
              fontSize: 13, width: 110, outline: 'none',
            }}
          />
          <input
            type="text"
            placeholder="Project"
            value={projectFilter}
            onChange={e => { setProjectFilter(e.target.value); localStorage.setItem('tasks_projectFilter', e.target.value) }}
            style={{
              background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '5px 10px', color: 'var(--text)',
              fontSize: 13, width: 130, outline: 'none',
            }}
          />
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, color: categoryFilter ? 'var(--text1)' : 'var(--text2)', background: 'var(--surface1)', cursor: 'pointer' }}
          >
            <option value=''>Category</option>
            <option value='primary'>Primary</option>
            <option value='secondary'>Secondary</option>
            <option value='accounting'>Accounting</option>
            <option value='overhead'>Overhead</option>
            <option value='charity'>Charity</option>
            <option value='personal'>Personal</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button style={execBtnStyle('All')}           onClick={handleAll}>All</button>
          <button style={execBtnStyle('RandomProject')} onClick={handleRandomProject}>Random Project Tasks</button>
          <button style={execBtnStyle('RandomHot')}     onClick={handleRandomHot}>Random Hot Task</button>
          <button style={execBtnStyle('Hot')}           onClick={handleHot}>Hot</button>
          <div style={{ display: 'flex', gap: 0, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
            <button
              onClick={() => setShowMode('show')}
              style={{
                padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
                background: showMode === 'show' ? '#6b7280' : 'transparent',
                color:      showMode === 'show' ? '#fff'    : 'var(--text2)',
                borderRight: '1px solid var(--border)',
              }}
            >Show</button>
            <button
              onClick={() => setShowMode('hide')}
              style={{
                padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
                background: showMode === 'hide' ? '#6b7280' : 'transparent',
                color:      showMode === 'hide' ? '#fff'    : 'var(--text2)',
              }}
            >Hide</button>
          </div>
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
                  <th style={{ width: 36, background: '#9dc691', color: '#fff', fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase' }}>Cycle</th>
                  <th style={{ background: '#9dc691', color: '#fff' }}>Alias</th>
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
                    <td colSpan={10} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text3)' }}>
                      Loading…
                    </td>
                  </tr>
                ) : filtered.length === 0 && newRows.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text3)' }}>
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
                        onToggleVisible={toggleTaskVisible}
                        onAddBelow={() => addNewRow(task.project_id)}
                        onDelete={deleteTask}
                        isDragging={dragIdx === idx}
                        isDragTarget={dragOver.current === idx && dragIdx !== null && dragIdx !== idx}
                        onDragStart={() => handleDragStart(idx)}
                        onDragOver={e => handleDragOver(e, idx)}
                        onDrop={handleDrop}
                        highlighted={activeBtn === 'RandomHot' && task.id === hotHighlightId}
                        onCycleToggle={toggleCycleDate}
                        onContext={handleContext}
                        isContext={contextTaskId === task.id}
                        onStartEdit={() => setEditingTaskId(task.id)}
                        onEndEdit={() => setEditingTaskId(null)}
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
