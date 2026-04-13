import { useState, useEffect, useRef, Fragment } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { DEMO_PROJECTS, DEMO_CLIENTS, PRIORITIES, PROOF_STATUSES, INV_STATUSES, COLLECT_STATUSES } from '../lib/demo-data'
import { StatusBadge, Modal, EmptyState, PillNav, FormGroup, fmt$, initials } from '../components/ui'

const isDemo = !import.meta.env.VITE_SUPABASE_URL
const PRODUCT_TYPES = ['ST', 'CO', 'DS', 'OH']

// ── SHARED HELPERS ───────────────────────────────────────────────────────
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

function DragDots() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" style={{ color: '#333', cursor: 'grab' }}>
      <circle cx="3.5" cy="2.5" r="1.1"/><circle cx="8.5" cy="2.5" r="1.1"/>
      <circle cx="3.5" cy="6"   r="1.1"/><circle cx="8.5" cy="6"   r="1.1"/>
      <circle cx="3.5" cy="9.5" r="1.1"/><circle cx="8.5" cy="9.5" r="1.1"/>
    </svg>
  )
}

function CheckIcon({ done }) {
  return done
    ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
    : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
}

function PlusIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
}

function ArchiveIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="21 8 21 21 3 21 3 8"/>
    <rect x="1" y="3" width="22" height="5"/>
    <line x1="10" y1="12" x2="14" y2="12"/>
  </svg>
}

function RestoreIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="1 4 1 10 7 10"/>
    <path d="M3.51 15a9 9 0 1 0 .49-3.3"/>
  </svg>
}

function TrashIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
}

function fmtUpdated(updatedAt, updaterName) {
  if (!updatedAt) return ''
  const d  = new Date(updatedAt)
  const mo = d.getMonth() + 1
  const dy = d.getDate()
  const yr = String(d.getFullYear()).slice(2)
  const by = updaterName ? ` by ${initials(updaterName)}` : ''
  return `${mo}/${dy}/${yr}${by}`
}

// ── DRAWER TASK ROW ──────────────────────────────────────────────────────
function DrawerTaskRow({ task, profiles, onSave, onAdd, onDelete, onDragStart, onDragOver, onDrop, isDragging, isDragTarget }) {
  const [editField, setEditField] = useState(null)
  const [noteVal,   setNoteVal]   = useState(task.note || '')
  const [snoteVal,  setSnoteVal]  = useState(task.status_note || '')
  const [assignOpen, setAssignOpen] = useState(false)
  const assignRef = useRef(null)

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
    if (noteVal.trim() !== (task.note || '').trim()) onSave(task.id, { note: noteVal.trim() })
  }

  function commitStatusNote() {
    setEditField(null)
    if (snoteVal.trim() !== (task.status_note || '').trim()) onSave(task.id, { status_note: snoteVal.trim() })
  }

  const assignee = profiles.find(p => p.id === task.assigned_to)

  return (
    <tr
      className="task-row"
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{
        opacity: isDragging ? 0.4 : 1,
        background: isDragTarget ? 'var(--accent-glow)' : '#f7fff5',
        transition: 'background 0.1s',
        '--border': '#9dc691',
      }}
    >
      {/* drag handle */}
      <td style={{ padding: '7px 4px 7px 12px', width: 24, cursor: 'grab' }}>
        <DragDots />
      </td>

      {/* task text */}
      <td className="td-main" style={{ minWidth: 140 }}>
        {editField === 'note' ? (
          <textarea
            autoFocus
            ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }}
            value={noteVal}
            onChange={e => {
              setNoteVal(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = e.target.scrollHeight + 'px'
            }}
            onBlur={commitNote}
            onKeyDown={e => { if (e.key === 'Escape') { setNoteVal(task.note || ''); setEditField(null) } }}
            style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--accent)', borderRadius: 6, padding: '3px 7px', color: 'var(--text)', fontSize: 13, resize: 'none', lineHeight: '1.4', boxSizing: 'border-box', overflow: 'hidden', minHeight: '28px' }}
          />
        ) : (
          <span
            onClick={() => { setNoteVal(task.note || ''); setEditField('note') }}
            style={{ cursor: 'text', display: 'block', minHeight: 20, whiteSpace: 'pre-wrap' }}
          >
            {task.note || <span style={{ color: 'var(--text3)' }}>Click to add…</span>}
          </span>
        )}
      </td>

      {/* status note */}
      <td style={{ minWidth: 120 }}>
        {editField === 'status_note' ? (
          <input
            autoFocus
            value={snoteVal}
            onChange={e => setSnoteVal(e.target.value)}
            onBlur={commitStatusNote}
            onKeyDown={e => { if (e.key === 'Enter') commitStatusNote(); if (e.key === 'Escape') { setSnoteVal(task.status_note || ''); setEditField(null) } }}
            style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--accent)', borderRadius: 6, padding: '3px 7px', color: 'var(--text)', fontSize: 13 }}
          />
        ) : (
          <span
            onClick={() => { setSnoteVal(task.status_note || ''); setEditField('status_note') }}
            style={{ cursor: 'text', display: 'block', minHeight: 20, color: task.status_note ? 'var(--text2)' : 'var(--text3)', fontSize: 13 }}
          >
            {task.status_note || 'Add note…'}
          </span>
        )}
      </td>

      {/* assigned */}
      <td style={{ position: 'relative' }} ref={assignRef}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {assignee
            ? <Avatar name={assignee.name} size={24} />
            : <div style={{ width: 24, height: 24, borderRadius: '50%', border: '1.5px dashed var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 13 }}>?</div>
          }
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={e => { e.stopPropagation(); setAssignOpen(v => !v) }}
            style={{ padding: '1px 3px', fontSize: 13, lineHeight: 1, color: 'var(--text3)' }}
          >+</button>
        </div>
        {assignOpen && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, zIndex: 200,
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: 8, boxShadow: 'var(--shadow-lg)',
            minWidth: 150, padding: '4px 0',
          }}>
            <div
              onClick={() => { onSave(task.id, { assigned_to: null }); setAssignOpen(false) }}
              style={{ padding: '7px 12px', cursor: 'pointer', fontSize: 13, color: 'var(--text3)' }}
            >— Unassigned</div>
            {profiles.map(p => (
              <div
                key={p.id}
                onClick={() => { onSave(task.id, { assigned_to: p.id }); setAssignOpen(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 12px', cursor: 'pointer', fontSize: 13,
                  background: p.id === task.assigned_to ? 'var(--accent-glow)' : undefined,
                  color: p.id === task.assigned_to ? 'var(--accent2)' : 'var(--text2)',
                }}
              >
                <Avatar name={p.name} size={20} />
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

      {/* actions: add / done / delete */}
      <td style={{ padding: '7px 10px 7px 4px', whiteSpace: 'nowrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            className="btn btn-ghost btn-icon btn-sm"
            title="Add task below"
            onClick={e => { e.stopPropagation(); onAdd() }}
            style={{ color: 'var(--text3)', border: '1px solid #333' }}
          ><PlusIcon /></button>
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={e => { e.stopPropagation(); onSave(task.id, { status: task.status === 'Done' ? 'Open' : 'Done' }) }}
            title={task.status === 'Done' ? 'Mark Open' : 'Mark Done'}
            style={{ color: task.status === 'Done' ? 'var(--green)' : 'var(--text3)', border: '1px solid #333' }}
          >
            <CheckIcon done={task.status === 'Done'} />
          </button>
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={e => { e.stopPropagation(); onDelete(task.id) }}
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

// ── TASK DRAWER ──────────────────────────────────────────────────────────
// ── ITEM DRAWER ──────────────────────────────────────────────────────────────
function ItemDrawer({ projectId, items, onAddItem, onUpdateItem, onDeleteItem, onReorder }) {
  const [addingRow,   setAddingRow]   = useState(null) // null | { name, scheduled_date }
  const [dragIdx,     setDragIdx]     = useState(null)
  const [dragOverIdx, setDragOverIdx] = useState(null)
  const [editField,   setEditField]   = useState(null) // null | { itemId, field }
  const [editVal,     setEditVal]     = useState('')
  const addInputRef = useRef(null)

  function startEdit(item, field) {
    setEditField({ itemId: item.id, field })
    setEditVal(field === 'scheduled_date' ? (item.scheduled_date || '') : item.name)
  }

  async function commitEdit(item) {
    if (!editField) return
    const { field } = editField
    const original = field === 'scheduled_date' ? (item.scheduled_date || '') : item.name
    setEditField(null)
    if (editVal === original) return
    const updates = { [field]: field === 'scheduled_date' ? (editVal || null) : editVal }
    await onUpdateItem(projectId, item.id, updates)
  }

  useEffect(() => {
    if (addingRow !== null) addInputRef.current?.focus()
  }, [addingRow])

  function handleDragStart(e, idx) {
    e.dataTransfer.effectAllowed = 'move'
    setDragIdx(idx)
  }

  function handleDragOver(e, idx) {
    e.preventDefault()
    setDragOverIdx(idx)
  }

  function handleDrop(toIdx) {
    if (dragIdx === null || dragIdx === toIdx) { setDragIdx(null); setDragOverIdx(null); return }
    const reordered = [...items]
    const [moved] = reordered.splice(dragIdx, 1)
    reordered.splice(toIdx, 0, moved)
    onReorder(projectId, reordered)
    setDragIdx(null)
    setDragOverIdx(null)
  }

  function startAdd() {
    setAddingRow({ name: '', scheduled_date: '' })
  }

  async function commitAdd() {
    const name = addingRow?.name?.trim()
    if (!name) { setAddingRow(null); return }
    await onAddItem(projectId, {
      name,
      scheduled_date: addingRow.scheduled_date || null,
    })
    setAddingRow(null)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter')  commitAdd()
    if (e.key === 'Escape') setAddingRow(null)
  }

  const thStyle = { padding: '6px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text3)' }

  return (
    <div style={{ background: 'var(--bg3)', borderTop: '2px solid var(--border2)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ width: 24, padding: '6px 4px 6px 12px', background: '#89bac9', borderTop: 'none', borderBottom: 'none' }} />
            <th style={{ ...thStyle, width: 180, background: '#89bac9', color: '#fff', borderTop: 'none', borderBottom: 'none' }}>Item</th>
            <th style={{ ...thStyle, width: 80, background: '#89bac9', color: '#fff', borderTop: 'none', borderBottom: 'none' }}>Order</th>
            <th style={{ ...thStyle, width: 120, background: '#89bac9', color: '#fff', borderTop: 'none', borderBottom: 'none' }}>Scheduled</th>
            <th style={{ width: 40, background: '#89bac9', borderTop: 'none', borderBottom: 'none' }} />
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && addingRow === null && (
            <tr>
              <td colSpan={5} style={{ padding: '12px 16px', color: 'var(--text3)', fontSize: 13 }}>
                No items yet.
              </td>
            </tr>
          )}
          {items.map((item, idx) => {
            const isOverdue = item.scheduled_date && item.scheduled_date < new Date().toISOString().slice(0, 10)
            return (
              <tr
                key={item.id}
                draggable
                onDragStart={e => handleDragStart(e, idx)}
                onDragOver={e => handleDragOver(e, idx)}
                onDrop={() => handleDrop(idx)}
                onDragEnd={() => { setDragIdx(null); setDragOverIdx(null) }}
                style={{
                  background: '#e6f8fc',
                  opacity: dragIdx === idx ? 0.4 : 1,
                  outline: dragOverIdx === idx && dragIdx !== idx ? '2px solid var(--accent)' : undefined,
                  cursor: 'default',
                }}
              >
                <td style={{ padding: '7px 4px 7px 12px', width: 24, cursor: 'grab', color: 'var(--text3)', fontSize: 14, userSelect: 'none', borderBottom: '1px solid #89bac9' }}>⠿</td>
                <td style={{ padding: '4px 12px', fontSize: 13, fontWeight: 600, color: 'var(--text)', borderBottom: '1px solid #89bac9' }}>
                  {editField?.itemId === item.id && editField.field === 'name' ? (
                    <input
                      autoFocus
                      value={editVal}
                      onChange={e => setEditVal(e.target.value)}
                      onBlur={() => commitEdit(item)}
                      onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') { setEditField(null) } }}
                      style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--accent)', borderRadius: 6, padding: '3px 7px', color: 'var(--text)', fontSize: 13, fontWeight: 600 }}
                    />
                  ) : (
                    <span style={{ cursor: 'text', display: 'block' }} onClick={() => startEdit(item, 'name')}>{item.name}</span>
                  )}
                </td>
                <td style={{ padding: '7px 12px', fontSize: 12, color: 'var(--text3)', fontFamily: 'DM Mono, monospace', borderBottom: '1px solid #89bac9' }}>{item.item_number || '—'}</td>
                <td style={{ padding: '4px 12px', fontSize: 12, fontFamily: 'DM Mono, monospace', color: isOverdue ? 'var(--red)' : 'var(--text3)', fontWeight: isOverdue ? 600 : 400, borderBottom: '1px solid #89bac9' }}>
                  {editField?.itemId === item.id && editField.field === 'scheduled_date' ? (
                    <input
                      autoFocus
                      type="date"
                      value={editVal}
                      onChange={e => setEditVal(e.target.value)}
                      onBlur={() => commitEdit(item)}
                      onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') { setEditField(null) } }}
                      style={{ background: 'var(--bg3)', border: '1px solid var(--accent)', borderRadius: 6, padding: '3px 7px', color: 'var(--text)', fontSize: 12 }}
                    />
                  ) : (
                    <span style={{ cursor: 'text', display: 'block' }} onClick={() => startEdit(item, 'scheduled_date')}>
                      {item.scheduled_date
                        ? (() => { const [y,m,d] = item.scheduled_date.split('-'); return `${m}/${d}/${y.slice(2)}` })()
                        : '—'}
                    </span>
                  )}
                </td>
                <td style={{ borderBottom: '1px solid #89bac9', padding: '7px 10px 7px 4px', whiteSpace: 'nowrap' }}>
                  <button
                    className="btn btn-ghost btn-icon btn-sm"
                    onClick={e => { e.stopPropagation(); onDeleteItem(projectId, item.id) }}
                    title="Delete item"
                    style={{ color: 'var(--text3)', border: '1px solid #333' }}
                  >
                    <TrashIcon />
                  </button>
                </td>
              </tr>
            )
          })}

          {/* inline add row */}
          {addingRow !== null && (
            <tr style={{ background: 'var(--accent-glow)', borderTop: '1px solid var(--border)' }}>
              <td style={{ padding: '7px 4px 7px 12px', width: 24 }} />
              <td style={{ padding: '7px 12px' }}>
                <input
                  ref={addInputRef}
                  value={addingRow.name}
                  onChange={e => setAddingRow(r => ({ ...r, name: e.target.value }))}
                  placeholder="Item name…"
                  onKeyDown={handleKeyDown}
                  style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 7px', color: 'var(--text)', fontSize: 13 }}
                />
              </td>
              <td />
              <td style={{ padding: '7px 12px' }}>
                <input
                  type="date"
                  value={addingRow.scheduled_date}
                  onChange={e => setAddingRow(r => ({ ...r, scheduled_date: e.target.value }))}
                  onKeyDown={handleKeyDown}
                  style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 7px', color: 'var(--text)', fontSize: 13 }}
                />
              </td>
              <td style={{ padding: '7px 10px 7px 4px', whiteSpace: 'nowrap' }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn btn-primary btn-sm" onClick={commitAdd}>Save</button>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setAddingRow(null)} style={{ color: 'var(--text3)' }}>✕</button>
                </div>
              </td>
            </tr>
          )}

          {/* add item button */}
          <tr style={{ background: '#e6f8fc' }}>
            <td colSpan={5} style={{ padding: '8px 12px', borderTop: '1px solid var(--border)' }}>
              <button className="btn btn-ghost btn-sm" onClick={startAdd} style={{ color: 'var(--text3)', fontSize: 12 }}>
                + Add item
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function TaskDrawer({ projectId, tasks, profiles, onSaveTask, onAddTask, onDeleteTask, onReorder }) {
  const [dragIdx,    setDragIdx]    = useState(null)
  const [dragOverIdx, setDragOverIdx] = useState(null)
  const [addingRow,  setAddingRow]  = useState(null) // null | { note, status_note, assigned_to }
  const addInputRef = useRef(null)

  useEffect(() => {
    if (addingRow !== null) addInputRef.current?.focus()
  }, [addingRow])

  function startAdd() {
    setAddingRow({ note: '', status_note: '', assigned_to: null })
  }

  async function commitAdd() {
    const note = addingRow?.note?.trim()
    if (!note) { setAddingRow(null); return }
    await onAddTask(projectId, {
      note,
      status_note: addingRow.status_note?.trim() || null,
      assigned_to: addingRow.assigned_to || null,
    })
    setAddingRow(null)
  }

  function handleDragStart(e, idx) {
    e.dataTransfer.effectAllowed = 'move'
    setDragIdx(idx)
  }

  function handleDragOver(e, idx) {
    e.preventDefault()
    setDragOverIdx(idx)
  }

  function handleDrop(toIdx) {
    if (dragIdx === null || dragIdx === toIdx) { setDragIdx(null); setDragOverIdx(null); return }
    const reordered = [...tasks]
    const [moved] = reordered.splice(dragIdx, 1)
    reordered.splice(toIdx, 0, moved)
    onReorder(projectId, reordered)
    setDragIdx(null)
    setDragOverIdx(null)
  }

  const [assignOpen, setAssignOpen] = useState(false)
  const addAssignRef = useRef(null)
  const addAssignee  = profiles.find(p => p.id === addingRow?.assigned_to)

  useEffect(() => {
    if (!assignOpen) return
    function handleClick(e) {
      if (addAssignRef.current && !addAssignRef.current.contains(e.target)) setAssignOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [assignOpen])

  return (
    <div style={{
      background: '#f7fff5',
      '--text': '#333',
      '--text2': '#333',
      '--text3': '#333',
      '--border': '#333',
      '--border2': '#333',
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ width: 24, padding: '6px 4px 6px 12px', background: '#9dc691', borderTop: 'none', borderBottom: 'none' }} />
            <th style={{ padding: '6px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#fff', background: '#9dc691', borderTop: 'none', borderBottom: 'none' }}>Task</th>
            <th style={{ padding: '6px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#fff', background: '#9dc691', borderTop: 'none', borderBottom: 'none' }}>Note</th>
            <th style={{ padding: '6px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#fff', background: '#9dc691', borderTop: 'none', borderBottom: 'none' }}>Assigned</th>
            <th style={{ padding: '6px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#fff', background: '#9dc691', borderTop: 'none', borderBottom: 'none' }}>Updated</th>
            <th style={{ width: 100, background: '#9dc691', borderTop: 'none', borderBottom: 'none' }} />
          </tr>
        </thead>
        <tbody>
          {tasks.length === 0 && addingRow === null && (
            <tr>
              <td colSpan={8} style={{ padding: '12px 16px', color: 'var(--text3)', fontSize: 13 }}>
                No tasks yet.
              </td>
            </tr>
          )}
          {tasks.map((task, idx) => (
            <DrawerTaskRow
              key={task.id}
              task={task}
              profiles={profiles}
              onSave={(taskId, updates) => onSaveTask(projectId, taskId, updates)}
              onAdd={() => setAddingRow({ note: '', status_note: '', assigned_to: null })}
              onDelete={taskId => onDeleteTask(projectId, taskId)}
              isDragging={dragIdx === idx}
              isDragTarget={dragOverIdx === idx && dragIdx !== null && dragIdx !== idx}
              onDragStart={e => handleDragStart(e, idx)}
              onDragOver={e => handleDragOver(e, idx)}
              onDrop={() => handleDrop(idx)}
            />
          ))}

          {/* inline add row */}
          {addingRow !== null && (
            <tr style={{ background: 'var(--accent-glow)' }}>
              <td style={{ padding: '7px 4px 7px 12px', width: 24 }} />
              <td className="td-main">
                <input
                  ref={addInputRef}
                  value={addingRow.note}
                  onChange={e => setAddingRow(r => ({ ...r, note: e.target.value }))}
                  placeholder="Task description…"
                  onKeyDown={e => { if (e.key === 'Enter') commitAdd(); if (e.key === 'Escape') setAddingRow(null) }}
                  style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 7px', color: 'var(--text)', fontSize: 13 }}
                />
              </td>
              <td>
                <input
                  value={addingRow.status_note}
                  onChange={e => setAddingRow(r => ({ ...r, status_note: e.target.value }))}
                  placeholder="Note…"
                  onKeyDown={e => { if (e.key === 'Enter') commitAdd(); if (e.key === 'Escape') setAddingRow(null) }}
                  style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 7px', color: 'var(--text)', fontSize: 13 }}
                />
              </td>
              <td style={{ position: 'relative' }} ref={addAssignRef}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  {addAssignee
                    ? <Avatar name={addAssignee.name} size={24} />
                    : <div style={{ width: 24, height: 24, borderRadius: '50%', border: '1.5px dashed var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 13 }}>?</div>
                  }
                  <button
                    className="btn btn-ghost btn-icon btn-sm"
                    onClick={() => setAssignOpen(v => !v)}
                    style={{ padding: '1px 3px', fontSize: 13, lineHeight: 1, color: 'var(--text3)' }}
                  >+</button>
                </div>
                {assignOpen && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, zIndex: 200,
                    background: 'var(--bg2)', border: '1px solid var(--border)',
                    borderRadius: 8, boxShadow: 'var(--shadow-lg)',
                    minWidth: 150, padding: '4px 0',
                  }}>
                    {profiles.map(p => (
                      <div
                        key={p.id}
                        onClick={() => { setAddingRow(r => ({ ...r, assigned_to: p.id })); setAssignOpen(false) }}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13, color: 'var(--text2)' }}
                      >
                        <Avatar name={p.name} size={20} />
                        {p.name}
                      </div>
                    ))}
                  </div>
                )}
              </td>
              <td style={{ padding: '7px 10px 7px 4px', whiteSpace: 'nowrap' }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn btn-primary btn-sm" onClick={commitAdd}>Save</button>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setAddingRow(null)} style={{ color: 'var(--text3)' }}>✕</button>
                </div>
              </td>
            </tr>
          )}

          {/* add task button */}
          <tr style={{ background: '#f7fff5' }}>
            <td colSpan={8} style={{ padding: '8px 12px 8px 40px', borderTop: '1px solid var(--border)' }}>
              <button
                className="btn btn-sm"
                onClick={startAdd}
                style={{ background: '#9dc691', color: '#fff', fontSize: 12, fontWeight: 600, border: 'none' }}
              >+ Add Task</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export default function ProjectsPage() {
  const [projects, setProjects]           = useState([])
  const [clients, setClients]             = useState([])
  const [productMap, setProductMap]       = useState({}) // { type: name }
  const [products, setProducts]           = useState([]) // [{ type, name }]
  const [profiles, setProfiles]           = useState([])
  const [loading, setLoading]             = useState(true)
  const [tab, setTab]                     = useState('work')
  const [editProject, setEditProject]     = useState(null)
  const [search, setSearch]               = useState('')
  const [showArchived, setShowArchived]   = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [searchParams]                    = useSearchParams()
  const [clientFilter, setClientFilter]   = useState(searchParams.get('client') || '')
  const [addingRow, setAddingRow]         = useState(null) // null | { client_id, name, product_type }
  const [expandedRows, setExpandedRows]         = useState({}) // { [projectId]: true }
  const [expandedItemRows, setExpandedItemRows] = useState({}) // { [projectId]: true }
  const [projectTasks, setProjectTasks]         = useState({}) // { [projectId]: Task[] }
  const [projectItems, setProjectItems]         = useState({}) // { [projectId]: Item[] }
  const [loadedProjects, setLoadedProjects]     = useState(new Set())
  const [loadedItemProjects, setLoadedItemProjects] = useState(new Set())
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
      const [{ data: p }, { data: c }, { data: prods }, { data: profs }] = await Promise.all([
        supabase.from('projects').select('*, client:clients(company,alias), product:products(id,type,name)').order('sort_order', { ascending: true, nullsFirst: false }).order('project_number', { ascending: false }),
        supabase.from('clients').select('id, company, alias').eq('status','active').order('company'),
        supabase.from('products').select('id, type, name').order('order_num', { nullsFirst: false }),
        supabase.from('profiles').select('id, name').order('name'),
      ])
      setProjects(p || [])
      setClients(c || [])
      setProfiles(profs || [])
      const map = {}
      ;(prods || []).forEach(prod => { if (prod.type) map[prod.type] = prod.name })
      setProductMap(map)
      setProducts(prods || [])
    }
    setLoading(false)
  }

  async function toggleExpand(projectId) {
    const isOpen = expandedRows[projectId]
    setExpandedRows(prev => ({ ...prev, [projectId]: !isOpen }))
    if (!isOpen && !loadedProjects.has(projectId) && !isDemo) {
      const { data } = await supabase
        .from('tasks')
        .select('*, updater:profiles!tasks_updated_by_fkey(name)')
        .eq('project_id', projectId)
        .order('sort_order')
        .order('created_at')
      setProjectTasks(prev => ({ ...prev, [projectId]: data || [] }))
      setLoadedProjects(prev => new Set([...prev, projectId]))
    }
  }

  async function toggleItemExpand(projectId) {
    const isOpen = expandedItemRows[projectId]
    setExpandedItemRows(prev => ({ ...prev, [projectId]: !isOpen }))
    if (!isOpen && !loadedItemProjects.has(projectId) && !isDemo) {
      const { data } = await supabase
        .from('project_items')
        .select('id, item_number, name, scheduled_date, status, sort_order')
        .eq('project_id', projectId)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('item_number')
      setProjectItems(prev => ({ ...prev, [projectId]: data || [] }))
      setLoadedItemProjects(prev => new Set([...prev, projectId]))
    }
  }

  async function addProjectItem(projectId, payload) {
    const existing = projectItems[projectId] || []
    const nextNumber = String(existing.length + 1).padStart(2, '0')
    const { data } = await supabase
      .from('project_items')
      .insert({ ...payload, project_id: projectId, item_number: nextNumber })
      .select('id, item_number, name, scheduled_date, status, sort_order')
      .single()
    if (data) setProjectItems(prev => ({ ...prev, [projectId]: [...(prev[projectId] || []), data] }))
  }

  async function updateProjectItem(projectId, itemId, updates) {
    const { data } = await supabase
      .from('project_items')
      .update(updates)
      .eq('id', itemId)
      .select('id, item_number, name, scheduled_date, status, sort_order')
      .single()
    if (data) setProjectItems(prev => ({
      ...prev,
      [projectId]: (prev[projectId] || []).map(i => i.id === itemId ? data : i),
    }))
  }

  async function deleteProjectItem(projectId, itemId) {
    await supabase.from('project_items').delete().eq('id', itemId)
    setProjectItems(prev => ({
      ...prev,
      [projectId]: (prev[projectId] || []).filter(i => i.id !== itemId),
    }))
  }

  async function saveProjectTask(projectId, taskId, updates) {
    if (isDemo) return
    const { data } = await supabase
      .from('tasks')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', taskId)
      .select('*, updater:profiles!tasks_updated_by_fkey(name)')
      .single()
    if (data) setProjectTasks(prev => ({
      ...prev,
      [projectId]: (prev[projectId] || []).map(t => t.id === taskId ? data : t),
    }))
  }

  async function addProjectTask(projectId, payload) {
    if (isDemo) return
    const tasks = projectTasks[projectId] || []
    const maxOrder = tasks.reduce((m, t) => Math.max(m, t.sort_order || 0), 0)
    const { data } = await supabase
      .from('tasks')
      .insert({ ...payload, project_id: projectId, status: 'Open', sort_order: maxOrder + 1 })
      .select('*, updater:profiles!tasks_updated_by_fkey(name)')
      .single()
    if (data) setProjectTasks(prev => ({
      ...prev,
      [projectId]: [...(prev[projectId] || []), data],
    }))
  }

  async function deleteProjectTask(projectId, taskId) {
    await supabase.from('tasks').delete().eq('id', taskId)
    setProjectTasks(prev => ({
      ...prev,
      [projectId]: (prev[projectId] || []).filter(t => t.id !== taskId),
    }))
  }

  function reorderProjectTasks(projectId, reordered) {
    setProjectTasks(prev => ({ ...prev, [projectId]: reordered }))
    reordered.forEach((t, i) => {
      supabase.from('tasks').update({ sort_order: i }).eq('id', t.id).then(() => {})
    })
  }

  function reorderProjectItems(projectId, reordered) {
    setProjectItems(prev => ({ ...prev, [projectId]: reordered }))
    reordered.forEach((item, i) => {
      supabase.from('project_items').update({ sort_order: i }).eq('id', item.id).then(() => {})
    })
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


  return (
    <div className="fade-in">
      <div className="topbar">
        <div className="breadcrumb">
          <span className="breadcrumb-current" style={{ fontSize: 20, fontWeight: 700 }}>Projects</span>
        </div>
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
      </div>

      <div className="page-content">
{tab === 'work' ? (
          <WorkView
            projects={filtered}
            clients={clients}
            productMap={productMap}
            profiles={profiles}
            loading={loading}
            showArchived={showArchived}
            confirmDelete={confirmDelete}
            addingRow={addingRow}
            setAddingRow={setAddingRow}
            addInputRef={addInputRef}
            clientFilter={clientFilter}
            expandedRows={expandedRows}
            expandedItemRows={expandedItemRows}
            projectTasks={projectTasks}
            projectItems={projectItems}
            onToggleExpand={toggleExpand}
            onToggleItemExpand={toggleItemExpand}
            onAddItem={addProjectItem}
            onUpdateItem={updateProjectItem}
            onDeleteItem={deleteProjectItem}
            onReorderItems={reorderProjectItems}
            onSaveTask={saveProjectTask}
            onAddTask={addProjectTask}
            onDeleteTask={deleteProjectTask}
            onReorderTasks={reorderProjectTasks}
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
          products={products}
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
  projects, clients, productMap, profiles, loading, showArchived, confirmDelete,
  addingRow, setAddingRow, addInputRef, clientFilter,
  expandedRows, expandedItemRows, projectTasks, projectItems, onToggleExpand, onToggleItemExpand, onSaveTask, onAddTask, onDeleteTask, onReorderTasks, onAddItem, onUpdateItem, onDeleteItem, onReorderItems,
  onEdit, onArchive, onDeleteRequest, onDeleteCancel, onDeleteConfirm,
  onView, onReorder, onStartAdd, onAddSave, onAddKeyDown,
}) {
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
      <div className="table-wrap">
        <table>
          {groups.map(group => (
              <tbody key={`group-${group.name}`}>
                {/* Client group header */}
                <tr style={{ background: '#595958', pointerEvents: 'none' }}>
                  <td colSpan={7} style={{
                    padding: '7px 16px',
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.07em',
                    textTransform: 'uppercase',
                    color: '#fff',
                  }}>
                    {group.name}
                  </td>
                </tr>

                {/* Project rows */}
                {group.projects.map((p) => {
                  const globalIdx  = projects.indexOf(p)
                  const isExpanded = expandedRows[p.id]
                  const tasks      = projectTasks[p.id] || []

                  return confirmDelete === p.id ? (
                    <Fragment key={p.id}>
                      <tr style={{ background: 'var(--red-bg)' }}>
                        <td></td>
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
                    </Fragment>
                  ) : (
                    <Fragment key={p.id}>
                      <tr
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
                        {/* drag handle */}
                        <td style={{
                          cursor: 'grab', color: 'var(--text3)',
                          fontSize: 15, userSelect: 'none', paddingRight: 0,
                        }}>
                          ⠿
                        </td>

                        {/* expand toggles */}
                        <td
                          onClick={e => e.stopPropagation()}
                          style={{ padding: '8px 4px 8px 10px', whiteSpace: 'nowrap' }}
                        >
                          <button
                            className="btn btn-sm"
                            onClick={() => onToggleExpand(p.id)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 4, background: '#9dc691', color: '#fff', border: 'none' }}
                          >
                            <svg
                              width="9" height="9" viewBox="0 0 10 10" fill="currentColor"
                              style={{
                                transition: 'transform 0.15s',
                                transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                flexShrink: 0,
                              }}
                            >
                              <path d="M3 1.5l4 3.5-4 3.5V1.5z"/>
                            </svg>
                            Tasks
                          </button>
                          <button
                            className="btn btn-sm"
                            onClick={() => onToggleItemExpand(p.id)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#89bac9', color: '#fff', border: 'none' }}
                          >
                            <svg
                              width="9" height="9" viewBox="0 0 10 10" fill="currentColor"
                              style={{
                                transition: 'transform 0.15s',
                                transform: expandedItemRows[p.id] ? 'rotate(90deg)' : 'rotate(0deg)',
                                flexShrink: 0,
                              }}
                            >
                              <path d="M3 1.5l4 3.5-4 3.5V1.5z"/>
                            </svg>
                            Items
                          </button>
                        </td>
                        <td className="text-mono text-dim">{p.project_number}</td>
                        <td style={{ color: 'var(--text2)', fontSize: 13 }}>{p.client?.company || '—'}</td>
                        <td style={{ color: 'var(--text2)', fontSize: 13, whiteSpace: 'nowrap' }}>
                          {p.product
                            ? `${p.product.type}${p.product.name ? ` | ${p.product.name}` : ''}`
                            : p.product_type || '—'}
                        </td>
                        <td className="td-main">{p.name}</td>
                        <td onClick={e => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <button className="btn btn-ghost btn-sm" style={{ border: '1px solid #333' }} onClick={() => onView(p.id)}>
                              Items
                            </button>
                            {!showArchived && (
                              <button className="btn btn-ghost btn-sm" style={{ border: '1px solid #333' }} title="Edit project" onClick={() => onEdit(p)}>
                                ✏️
                              </button>
                            )}
                            <button className="btn btn-ghost btn-sm" style={{ border: '1px solid #333' }} title={p.archived ? 'Restore' : 'Archive'} onClick={() => onArchive(p)}>
                              {p.archived ? <RestoreIcon /> : <ArchiveIcon />}
                            </button>
                            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)', border: '1px solid #333' }} title="Delete project" onClick={() => onDeleteRequest(p.id)}>
                              🗑️
                            </button>
                            <button className="btn btn-ghost btn-sm" style={{ border: '1px solid #333' }} title="Add new project" onClick={onStartAdd}>
                              +
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* task drawer row */}
                      {isExpanded && (
                        <tr key={`drawer-${p.id}`} className="drawer-row">
                          <td colSpan={7} style={{ padding: 0 }}>
                            <TaskDrawer
                              projectId={p.id}
                              tasks={tasks}
                              profiles={profiles}
                              onSaveTask={onSaveTask}
                              onAddTask={onAddTask}
                              onDeleteTask={onDeleteTask}
                              onReorder={onReorderTasks}
                            />
                          </td>
                        </tr>
                      )}

                      {/* items drawer row */}
                      {expandedItemRows[p.id] && (
                        <tr key={`items-drawer-${p.id}`}>
                          <td colSpan={7} style={{ padding: 0 }}>
                            <ItemDrawer
                              projectId={p.id}
                              items={projectItems[p.id] || []}
                              onAddItem={onAddItem}
                              onUpdateItem={onUpdateItem}
                              onDeleteItem={onDeleteItem}
                              onReorder={onReorderItems}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            ))}

          <tbody>
            {/* Inline add row */}
            {addingRow !== null && (
              <tr style={{ background: 'var(--accent-glow)' }}>
                <td></td>
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
                <td colSpan={7} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text3)' }}>
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
function ProjectModal({ project, clients, projects, products, onClose, onSaved }) {
  const [form, setForm] = useState({
    project_number: project?.project_number ?? '',
    name:           project?.name           || '',
    client_id:      project?.client_id      || (clients[0]?.id || ''),
    product_id:     project?.product_id      || '',
    product_type:   project?.product_type   || '',
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
    if (!payload.product_id) payload.product_id = null
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
        <FormGroup label="Product">
          <select value={form.product_id} onChange={set('product_id')}>
            <option value="">— Select product —</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>
                {p.type}{p.name ? ` | ${p.name}` : ''}
              </option>
            ))}
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
