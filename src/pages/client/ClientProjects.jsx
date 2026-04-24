import { useState, useEffect, useRef, Fragment } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { EmptyState, initials } from '../../components/ui'
import { PROOF_STATUSES } from '../../lib/demo-data'
import iconTodo   from '../../assets/icon_todo.svg'
import iconItem   from '../../assets/icon_item.svg'
import iconProofs from '../../assets/icon_proofs.svg'
import iconView   from '../../assets/icon_view.svg'

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

function PlusIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
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

function CheckIcon({ done }) {
  return done
    ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
    : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
}

function LinkIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
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
function DrawerTaskRow({ task, profiles, onSave, onAdd, onDelete }) {
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
    <tr className="task-row" style={{ background: '#f7fff5' }}>
      <td style={{ padding: '7px 4px 7px 12px', width: 25, borderBottom: '1px solid #9dc691', borderRight: '1px solid #9dc691' }} />
      <td style={{ width: 65, borderBottom: '1px solid #9dc691', borderRight: '1px solid #9dc691' }} />

      <td className="td-main" style={{ borderBottom: '1px solid #9dc691', borderRight: '1px solid #9dc691' }}>
        {editField === 'note' ? (
          <textarea
            autoFocus
            ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }}
            value={noteVal}
            onChange={e => { setNoteVal(e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
            onBlur={commitNote}
            onKeyDown={e => { if (e.key === 'Escape') { setNoteVal(task.note || ''); setEditField(null) } }}
            style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--accent)', borderRadius: 6, padding: '3px 7px', color: 'var(--text)', fontSize: 13, resize: 'none', lineHeight: '1.4', boxSizing: 'border-box', overflow: 'hidden', minHeight: '28px' }}
          />
        ) : (
          <span onClick={() => { setNoteVal(task.note || ''); setEditField('note') }} style={{ cursor: 'text', display: 'block', minHeight: 20, whiteSpace: 'pre-wrap' }}>
            {task.note || <span style={{ color: 'var(--text3)' }}>Click to add…</span>}
          </span>
        )}
      </td>

      <td style={{ padding: '7px 12px', fontSize: 13, color: 'var(--text3)', borderBottom: '1px solid #9dc691', borderRight: '1px solid #9dc691' }}>
        {editField === 'status_note' ? (
          <textarea
            autoFocus
            ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }}
            value={snoteVal}
            onChange={e => { setSnoteVal(e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
            onBlur={commitStatusNote}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitStatusNote() } if (e.key === 'Escape') { setSnoteVal(task.status_note || ''); setEditField(null) } }}
            style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--accent)', borderRadius: 6, padding: '3px 7px', color: 'var(--text)', fontSize: 13, resize: 'none', lineHeight: '1.4', boxSizing: 'border-box', overflow: 'hidden', minHeight: '28px' }}
          />
        ) : (
          <span onClick={() => { setSnoteVal(task.status_note || ''); setEditField('status_note') }} style={{ cursor: 'text', display: 'block', minHeight: 20, color: task.status_note ? 'var(--text2)' : 'var(--text3)', fontSize: 13, whiteSpace: 'pre-wrap' }}>
            {task.status_note || 'Add note…'}
          </span>
        )}
      </td>

      <td style={{ position: 'relative', padding: '7px 12px', fontSize: 12, color: 'var(--text3)', borderBottom: '1px solid #9dc691', borderRight: '1px solid #9dc691' }} ref={assignRef}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {assignee
            ? <Avatar name={assignee.name} size={24} />
            : <div style={{ width: 24, height: 24, borderRadius: '50%', border: '1.5px dashed var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 13 }}>?</div>
          }
        </div>
      </td>

      <td style={{ padding: '7px 12px', fontFamily: 'DM Mono, monospace', fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap', borderBottom: '1px solid #9dc691', borderRight: '1px solid #9dc691' }}>
        {fmtUpdated(task.updated_at, task.updater?.name)}
      </td>

      <td style={{ padding: '7px 10px 7px 4px', whiteSpace: 'nowrap', borderBottom: '1px solid #9dc691' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={e => { e.stopPropagation(); onAdd() }}
            title="Add task below"
            style={{ color: 'var(--text3)', border: '1px solid #333' }}
          ><PlusIcon /></button>
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={e => { e.stopPropagation(); onSave(task.id, { status: task.status === 'Done' ? 'Open' : 'Done' }) }}
            title={task.status === 'Done' ? 'Mark Open' : 'Mark Done'}
            style={{ color: task.status === 'Done' ? 'var(--green)' : 'var(--text3)', border: '1px solid #333' }}
          ><CheckIcon done={task.status === 'Done'} /></button>
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={e => { e.stopPropagation(); onDelete(task.id) }}
            title="Delete task"
            style={{ color: 'var(--text3)', border: '1px solid #333' }}
          ><TrashIcon /></button>
        </div>
      </td>
    </tr>
  )
}

// ── TASK DRAWER ──────────────────────────────────────────────────────────
function TaskDrawer({ projectId, tasks, profiles, onSaveTask, onAddTask, onDeleteTask, onReorder }) {
  const [addingRow, setAddingRow] = useState(null)
  const addInputRef = useRef(null)

  useEffect(() => {
    if (addingRow !== null) addInputRef.current?.focus()
  }, [addingRow])

  async function commitAdd() {
    const note = addingRow?.note?.trim()
    if (!note) { setAddingRow(null); return }
    await onAddTask(projectId, { note, status_note: addingRow.status_note?.trim() || null, assigned_to: null })
    setAddingRow(null)
  }

  return (
    <div style={{ background: '#f7fff5' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ width: 25, padding: '6px 4px 6px 12px', background: '#9dc691', borderTop: 'none', borderBottom: 'none' }} />
            <th style={{ width: 65, background: '#9dc691', borderTop: 'none', borderBottom: 'none' }} />
            <th style={{ width: 200, padding: '6px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#fff', background: '#9dc691', borderTop: 'none', borderBottom: 'none' }}>Task</th>
            <th style={{ padding: '6px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#fff', background: '#9dc691', borderTop: 'none', borderBottom: 'none' }}>Note</th>
            <th style={{ width: 75, padding: '6px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#fff', background: '#9dc691', borderTop: 'none', borderBottom: 'none' }}>Assigned</th>
            <th style={{ padding: '6px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#fff', background: '#9dc691', borderTop: 'none', borderBottom: 'none' }}>Updated</th>
            <th style={{ width: 225, background: '#9dc691', borderTop: 'none', borderBottom: 'none' }} />
          </tr>
        </thead>
        <tbody>
          {tasks.length === 0 && addingRow === null && (
            <tr><td colSpan={7} style={{ padding: '12px 16px', color: 'var(--text3)', fontSize: 13 }}>No tasks yet.</td></tr>
          )}
          {tasks.map(task => (
            <DrawerTaskRow
              key={task.id}
              task={task}
              profiles={profiles}
              onSave={(taskId, updates) => onSaveTask(projectId, taskId, updates)}
              onAdd={() => setAddingRow({ note: '', status_note: '' })}
              onDelete={taskId => onDeleteTask(projectId, taskId)}
            />
          ))}

          {addingRow !== null && (
            <tr style={{ background: 'var(--accent-glow)' }}>
              <td style={{ padding: '7px 4px 7px 12px', width: 25 }} />
              <td style={{ width: 65 }} />
              <td className="td-main">
                <textarea
                  ref={addInputRef}
                  value={addingRow.note}
                  onChange={e => { setAddingRow(r => ({ ...r, note: e.target.value })); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
                  placeholder="Task description…"
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitAdd() } if (e.key === 'Escape') setAddingRow(null) }}
                  style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 7px', color: 'var(--text)', fontSize: 13, resize: 'none', lineHeight: '1.4', boxSizing: 'border-box', overflow: 'hidden', minHeight: '28px' }}
                />
              </td>
              <td>
                <textarea
                  value={addingRow.status_note}
                  onChange={e => { setAddingRow(r => ({ ...r, status_note: e.target.value })); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
                  placeholder="Note…"
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitAdd() } if (e.key === 'Escape') setAddingRow(null) }}
                  style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 7px', color: 'var(--text)', fontSize: 13, resize: 'none', lineHeight: '1.4', boxSizing: 'border-box', overflow: 'hidden', minHeight: '28px' }}
                />
              </td>
              <td /><td />
              <td style={{ padding: '7px 10px 7px 4px', whiteSpace: 'nowrap' }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn btn-primary btn-sm" onClick={commitAdd}>Save</button>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setAddingRow(null)} style={{ color: 'var(--text3)' }}>✕</button>
                </div>
              </td>
            </tr>
          )}

          <tr style={{ background: '#f7fff5' }}>
            <td colSpan={7} style={{ padding: '8px 12px 8px 40px', borderTop: '1px solid var(--border)' }}>
              <button className="btn btn-sm" onClick={() => setAddingRow({ note: '', status_note: '' })} style={{ background: 'none', color: '#9dc691', fontSize: 12, fontWeight: 600, border: '1px solid #9dc691' }}>+</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ── ITEM DRAWER ──────────────────────────────────────────────────────────
function ItemDrawer({ projectId, items, onAddItem, onUpdateItem, onDeleteItem, onReorder, expandedProofRows, itemProofs, onToggleProofExpand, onAddProof, onDeleteProof, onUpdateProof }) {
  const [addingRow,      setAddingRow]      = useState(null)
  const [editField,      setEditField]      = useState(null)
  const [editVal,        setEditVal]        = useState('')
  const [linkPopup,      setLinkPopup]      = useState(null)
  const [proofEditField, setProofEditField] = useState(null)
  const [proofEditVal,   setProofEditVal]   = useState('')
  const addInputRef = useRef(null)

  useEffect(() => {
    if (addingRow !== null) addInputRef.current?.focus()
  }, [addingRow])

  function startProofEdit(proofId, itemId, field, val) {
    setProofEditField({ proofId, itemId, field })
    setProofEditVal(val || '')
  }

  function commitProofEdit() {
    if (!proofEditField) return
    const { proofId, itemId, field } = proofEditField
    setProofEditField(null)
    onUpdateProof(itemId, proofId, { [field]: proofEditVal.trim() || null })
  }

  function openLinkPopup(e, proofId, itemId, currentUrl) {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    setLinkPopup({ proofId, itemId, url: currentUrl || '', top: rect.bottom + 4, right: window.innerWidth - rect.right })
  }

  function saveLinkUrl() {
    if (!linkPopup) return
    onUpdateProof(linkPopup.itemId, linkPopup.proofId, { url: linkPopup.url.trim() || null })
    setLinkPopup(null)
  }

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
    await onUpdateItem(projectId, item.id, { [field]: field === 'scheduled_date' ? (editVal || null) : editVal })
  }

  async function commitAdd() {
    const name = addingRow?.name?.trim()
    if (!name) { setAddingRow(null); return }
    await onAddItem(projectId, { name, scheduled_date: addingRow.scheduled_date || null })
    setAddingRow(null)
  }

  const thStyle = { padding: '6px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text3)' }
  const proofThStyle = { padding: '6px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#fff', background: '#d5b6dd', borderTop: 'none', borderBottom: 'none' }

  return (
    <div style={{ background: 'var(--bg3)', borderTop: '2px solid var(--border2)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ width: 25, padding: '6px 4px 6px 12px', background: '#89bac9', borderTop: 'none', borderBottom: 'none' }} />
            <th style={{ width: 75, background: '#89bac9', borderTop: 'none', borderBottom: 'none' }} />
            <th style={{ ...thStyle, width: 200, background: '#89bac9', color: '#fff', borderTop: 'none', borderBottom: 'none' }}>Item</th>
            <th style={{ ...thStyle, width: 75, background: '#89bac9', color: '#fff', borderTop: 'none', borderBottom: 'none' }}>Order</th>
            <th style={{ ...thStyle, background: '#89bac9', color: '#fff', borderTop: 'none', borderBottom: 'none' }}>Scheduled</th>
            <th style={{ width: 225, background: '#89bac9', borderTop: 'none', borderBottom: 'none' }} />
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && addingRow === null && (
            <tr><td colSpan={6} style={{ padding: '12px 16px', color: 'var(--text3)', fontSize: 13 }}>No items yet.</td></tr>
          )}
          {items.map(item => {
            const isOverdue = item.scheduled_date && item.scheduled_date < new Date().toISOString().slice(0, 10)
            const proofOpen = expandedProofRows?.[item.id]
            return (
              <Fragment key={item.id}>
                <tr className="item-row" style={{ background: '#e6f8fc', cursor: 'default' }}>
                  <td style={{ padding: '7px 4px 7px 12px', width: 25, borderBottom: '1px solid #89bac9', borderRight: '1px solid #89bac9' }} />
                  <td style={{ padding: '4px 0', borderBottom: '1px solid #89bac9', borderRight: '1px solid #89bac9', textAlign: 'center' }}>
                    <button
                      className="btn btn-ghost btn-icon"
                      onClick={e => { e.stopPropagation(); onToggleProofExpand(item.id) }}
                      title="Toggle Proofs"
                      style={{ padding: 0, border: 'none', background: 'none', opacity: proofOpen ? 1 : 0.45, transition: 'opacity 0.15s' }}
                    >
                      <img src={iconProofs} width={25} height={25} alt="Proofs" style={{ display: 'block' }} />
                    </button>
                  </td>
                  <td style={{ padding: '4px 12px', fontSize: 13, fontWeight: 600, color: 'var(--text)', borderBottom: '1px solid #89bac9', borderRight: '1px solid #89bac9' }}>
                    {editField?.itemId === item.id && editField.field === 'name' ? (
                      <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value)} onBlur={() => commitEdit(item)}
                        onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditField(null) }}
                        style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--accent)', borderRadius: 6, padding: '3px 7px', color: 'var(--text)', fontSize: 13, fontWeight: 600 }} />
                    ) : (
                      <span style={{ cursor: 'text', display: 'block' }} onClick={() => startEdit(item, 'name')}>{item.name}</span>
                    )}
                  </td>
                  <td style={{ padding: '7px 12px', fontSize: 12, color: 'var(--text3)', fontFamily: 'DM Mono, monospace', borderBottom: '1px solid #89bac9', borderRight: '1px solid #89bac9', textAlign: 'center' }}>{item.item_number || '—'}</td>
                  <td style={{ padding: '4px 12px', fontSize: 12, fontFamily: 'DM Mono, monospace', color: isOverdue ? 'var(--red)' : 'var(--text3)', fontWeight: isOverdue ? 600 : 400, borderBottom: '1px solid #89bac9', borderRight: '1px solid #89bac9' }}>
                    {editField?.itemId === item.id && editField.field === 'scheduled_date' ? (
                      <input autoFocus type="date" value={editVal} onChange={e => setEditVal(e.target.value)} onBlur={() => commitEdit(item)}
                        onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditField(null) }}
                        style={{ background: 'var(--bg3)', border: '1px solid var(--accent)', borderRadius: 6, padding: '3px 7px', color: 'var(--text)', fontSize: 12 }} />
                    ) : (
                      <span style={{ cursor: 'text', display: 'block' }} onClick={() => startEdit(item, 'scheduled_date')}>
                        {item.scheduled_date ? (() => { const [y,m,d] = item.scheduled_date.split('-'); return `${m}/${d}/${y.slice(2)}` })() : '—'}
                      </span>
                    )}
                  </td>
                  <td style={{ borderBottom: '1px solid #89bac9', padding: '7px 10px 7px 4px', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={e => { e.stopPropagation(); onDeleteItem(projectId, item.id) }} title="Delete item" style={{ color: 'var(--text3)', border: '1px solid #333' }}><TrashIcon /></button>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={e => { e.stopPropagation(); setAddingRow({ name: '', scheduled_date: '' }) }} title="Add item" style={{ border: '1px solid #333' }}><PlusIcon /></button>
                    </div>
                  </td>
                </tr>

                {proofOpen && (
                  <tr>
                    <td colSpan={6} style={{ padding: 0 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            <th style={{ width: 25, background: '#d5b6dd', borderTop: 'none', borderBottom: 'none' }} />
                            <th style={{ width: 65, background: '#d5b6dd', borderTop: 'none', borderBottom: 'none' }} />
                            <th style={{ ...proofThStyle, width: 200 }}>Item</th>
                            <th style={{ ...proofThStyle, width: 75 }}>Proof</th>
                            <th style={{ ...proofThStyle }}>Status</th>
                            <th style={{ ...proofThStyle }}>Comments / Changes</th>
                            <th style={{ width: 225, background: '#d5b6dd', borderTop: 'none', borderBottom: 'none' }} />
                          </tr>
                        </thead>
                        <tbody>
                          {(itemProofs?.[item.id] || []).map(proof => (
                            <tr key={proof.id} className="proof-row" style={{ background: '#f2eaf4' }}>
                              <td style={{ width: 25, borderBottom: '1px solid #d5b6dd', borderRight: '1px solid #d5b6dd' }} />
                              <td style={{ padding: '5px 8px', borderBottom: '1px solid #d5b6dd', borderRight: '1px solid #d5b6dd' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <a href={proof.url || '#'} target="_blank" rel="noopener noreferrer"
                                    onClick={e => { e.stopPropagation(); if (!proof.url) e.preventDefault() }}
                                    style={{ opacity: proof.url ? 1 : 0.35, cursor: proof.url ? 'pointer' : 'default', display: 'flex' }}>
                                    <img src={iconView} width={25} height={25} alt="View" />
                                  </a>
                                </div>
                              </td>
                              <td style={{ padding: '5px 12px', fontSize: 13, borderBottom: '1px solid #d5b6dd', borderRight: '1px solid #d5b6dd' }}>{item.name}</td>
                              <td style={{ padding: '5px 12px', fontFamily: 'DM Mono, monospace', fontSize: 12, borderBottom: '1px solid #d5b6dd', borderRight: '1px solid #d5b6dd', textAlign: 'center' }}>{item.item_number}{String.fromCharCode(64 + proof.version)}</td>
                              <td style={{ padding: '3px 8px', fontSize: 13, borderBottom: '1px solid #d5b6dd', borderRight: '1px solid #d5b6dd' }}>
                                {proofEditField?.proofId === proof.id && proofEditField.field === 'status' ? (
                                  <select autoFocus value={proofEditVal} onChange={e => setProofEditVal(e.target.value)} onBlur={commitProofEdit}
                                    onKeyDown={e => { if (e.key === 'Escape') setProofEditField(null) }}
                                    style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--accent)', borderRadius: 6, padding: '3px 6px', color: 'var(--text)', fontSize: 13 }}>
                                    {PROOF_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                  </select>
                                ) : (
                                  <span onClick={() => startProofEdit(proof.id, item.id, 'status', proof.status)} style={{ cursor: 'text', display: 'block', minHeight: 20 }}>
                                    {proof.status || <span style={{ color: 'var(--text3)' }}>—</span>}
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '3px 8px', fontSize: 13, borderBottom: '1px solid #d5b6dd', borderRight: '1px solid #d5b6dd' }}>
                                {proofEditField?.proofId === proof.id && proofEditField.field === 'comments' ? (
                                  <input autoFocus value={proofEditVal} onChange={e => setProofEditVal(e.target.value)} onBlur={commitProofEdit}
                                    onKeyDown={e => { if (e.key === 'Enter') commitProofEdit(); if (e.key === 'Escape') setProofEditField(null) }}
                                    style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--accent)', borderRadius: 6, padding: '3px 7px', color: 'var(--text)', fontSize: 13 }} />
                                ) : (
                                  <span onClick={() => startProofEdit(proof.id, item.id, 'comments', proof.comments)} style={{ cursor: 'text', display: 'block', minHeight: 20 }}>
                                    {proof.comments || <span style={{ color: 'var(--text3)' }}>—</span>}
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '5px 8px', whiteSpace: 'nowrap', borderBottom: '1px solid #d5b6dd' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                                  <button className="btn btn-ghost btn-icon btn-sm" onClick={e => openLinkPopup(e, proof.id, item.id, proof.url)} title="Add/edit link" style={{ border: '1px solid #333' }}><LinkIcon /></button>
                                  <button className="btn btn-ghost btn-icon btn-sm" onClick={e => { e.stopPropagation(); onDeleteProof(item.id, proof.id) }} title="Delete proof" style={{ border: '1px solid #333' }}><TrashIcon /></button>
                                  <button className="btn btn-ghost btn-icon btn-sm" onClick={e => { e.stopPropagation(); onAddProof(item.id, item.item_number) }} title="Add proof version" style={{ border: '1px solid #333' }}><PlusIcon /></button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          <tr style={{ background: '#f2eaf4' }}>
                            <td colSpan={7} style={{ padding: '8px 12px 8px 40px', borderTop: '1px solid #d5b6dd' }}>
                              <button className="btn btn-sm" onClick={e => { e.stopPropagation(); onAddProof(item.id, item.item_number) }}
                                style={{ background: 'none', color: '#d5b6dd', fontSize: 12, fontWeight: 600, border: '1px solid #d5b6dd' }}>+</button>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}

          {addingRow !== null && (
            <tr style={{ background: 'var(--accent-glow)', borderTop: '1px solid var(--border)' }}>
              <td style={{ padding: '7px 4px 7px 12px', width: 25 }} /><td />
              <td style={{ padding: '7px 12px' }}>
                <input ref={addInputRef} value={addingRow.name} onChange={e => setAddingRow(r => ({ ...r, name: e.target.value }))} placeholder="Item name…"
                  onKeyDown={e => { if (e.key === 'Enter') commitAdd(); if (e.key === 'Escape') setAddingRow(null) }}
                  style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 7px', color: 'var(--text)', fontSize: 13 }} />
              </td>
              <td />
              <td style={{ padding: '7px 12px' }}>
                <input type="date" value={addingRow.scheduled_date} onChange={e => setAddingRow(r => ({ ...r, scheduled_date: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') commitAdd(); if (e.key === 'Escape') setAddingRow(null) }}
                  style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 7px', color: 'var(--text)', fontSize: 13 }} />
              </td>
              <td style={{ padding: '7px 10px 7px 4px', whiteSpace: 'nowrap' }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn btn-primary btn-sm" onClick={commitAdd}>Save</button>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setAddingRow(null)} style={{ color: 'var(--text3)' }}>✕</button>
                </div>
              </td>
            </tr>
          )}

          <tr style={{ background: '#e6f8fc' }}>
            <td colSpan={6} style={{ padding: '8px 12px 8px 40px', borderTop: '1px solid var(--border)' }}>
              <button className="btn btn-sm" onClick={() => setAddingRow({ name: '', scheduled_date: '' })}
                style={{ background: 'none', color: '#89bac9', fontSize: 12, fontWeight: 600, border: '1px solid #89bac9' }}>+</button>
            </td>
          </tr>
        </tbody>
      </table>

      {linkPopup && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onClick={() => setLinkPopup(null)} />
          <div style={{ position: 'fixed', top: linkPopup.top, right: linkPopup.right, zIndex: 1000, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', boxShadow: '0 4px 16px rgba(0,0,0,0.18)', display: 'flex', gap: 6, alignItems: 'center', minWidth: 320 }}>
            <input autoFocus value={linkPopup.url} onChange={e => setLinkPopup(p => ({ ...p, url: e.target.value }))} placeholder="https://…"
              onKeyDown={e => { if (e.key === 'Enter') saveLinkUrl(); if (e.key === 'Escape') setLinkPopup(null) }}
              style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', color: 'var(--text)', fontSize: 13 }} />
            <button className="btn btn-primary btn-sm" onClick={saveLinkUrl} style={{ fontSize: 12 }}>Save</button>
          </div>
        </>
      )}
    </div>
  )
}

// ── PROJECT ROW ──────────────────────────────────────────────────────────
function ProjectRow({
  p, isExpanded, expandedItemRows,
  tasks, profiles, projectItems, expandedProofRows, itemProofs,
  onToggleExpand, onToggleItemExpand,
  onSaveTask, onAddTask, onDeleteTask, onReorderTasks,
  onAddItem, onUpdateItem, onDeleteItem, onReorderItems,
  onToggleProofExpand, onAddProof, onDeleteProof, onUpdateProof,
}) {
  return (
    <Fragment>
      <tr style={{ cursor: 'default' }}>
        <td style={{ color: 'var(--text3)', fontSize: 15, userSelect: 'none', padding: '12px 4px 12px 4px', width: 25, borderRight: '1px solid var(--border)' }} />
        <td onClick={e => e.stopPropagation()} style={{ borderRight: '1px solid var(--border)', width: 65, padding: '8px 8px 8px 12px', whiteSpace: 'nowrap' }}>
          <button className="btn btn-ghost btn-icon" onClick={() => onToggleExpand(p.id)} title="Toggle Tasks"
            style={{ padding: 0, border: 'none', background: 'none', marginRight: 4, opacity: isExpanded ? 1 : 0.45, transition: 'opacity 0.15s' }}>
            <img src={iconTodo} width={25} height={25} alt="Tasks" style={{ display: 'block' }} />
          </button>
          <button className="btn btn-ghost btn-icon" onClick={() => onToggleItemExpand(p.id)} title="Toggle Items"
            style={{ padding: 0, border: 'none', background: 'none', opacity: expandedItemRows[p.id] ? 1 : 0.45, transition: 'opacity 0.15s' }}>
            <img src={iconItem} width={25} height={25} alt="Items" style={{ display: 'block' }} />
          </button>
        </td>
        <td className="td-main" style={{ borderRight: '1px solid var(--border)', width: 200, padding: '8px 12px' }}>{p.name}</td>
        <td style={{ borderRight: '1px solid var(--border)', width: 75, color: 'var(--text2)', fontSize: 12, padding: '8px 12px', textAlign: 'center' }}>{p.project_number}</td>
        <td style={{ borderRight: '1px solid var(--border)', color: 'var(--text2)', fontSize: 13, whiteSpace: 'nowrap', padding: '4px 12px' }}>
          {p.product ? `${p.product.type}${p.product.name ? ` | ${p.product.name}` : ''}` : p.product_type || '—'}
        </td>
        <td style={{ width: 225 }} />
      </tr>

      {isExpanded && (
        <tr className="drawer-row">
          <td colSpan={6} style={{ padding: 0 }}>
            <TaskDrawer projectId={p.id} tasks={tasks} profiles={profiles} onSaveTask={onSaveTask} onAddTask={onAddTask} onDeleteTask={onDeleteTask} onReorder={onReorderTasks} />
          </td>
        </tr>
      )}

      {expandedItemRows[p.id] && (
        <tr>
          <td colSpan={6} style={{ padding: 0 }}>
            <ItemDrawer projectId={p.id} items={projectItems[p.id] || []} onAddItem={onAddItem} onUpdateItem={onUpdateItem} onDeleteItem={onDeleteItem} onReorder={onReorderItems}
              expandedProofRows={expandedProofRows} itemProofs={itemProofs} onToggleProofExpand={onToggleProofExpand} onAddProof={onAddProof} onDeleteProof={onDeleteProof} onUpdateProof={onUpdateProof} />
          </td>
        </tr>
      )}
    </Fragment>
  )
}

function groupByClient(projects) {
  const map = {}
  for (const p of projects) {
    const key  = p.client_id || '__none__'
    const name = p.client?.company || p.client?.alias || 'No client'
    if (!map[key]) map[key] = { clientId: key, name, projects: [] }
    map[key].projects.push(p)
  }
  return Object.values(map).sort((a, b) => a.name.localeCompare(b.name))
}

// ── MAIN PAGE ────────────────────────────────────────────────────────────
export default function ClientProjects() {
  const { profile } = useAuth()
  const clientId = profile?.client_id

  const [projects,       setProjects]       = useState([])
  const [profiles,       setProfiles]       = useState([])
  const [loading,        setLoading]        = useState(true)
  const [search,         setSearch]         = useState('')
  const [expandedRows,        setExpandedRows]        = useState({})
  const [expandedItemRows,    setExpandedItemRows]    = useState({})
  const [projectTasks,        setProjectTasks]        = useState({})
  const [projectItems,        setProjectItems]        = useState({})
  const [loadedProjects,      setLoadedProjects]      = useState(new Set())
  const [loadedItemProjects,  setLoadedItemProjects]  = useState(new Set())
  const [expandedProofRows,   setExpandedProofRows]   = useState({})
  const [itemProofs,          setItemProofs]          = useState({})
  const [loadedProofItems,    setLoadedProofItems]    = useState(new Set())

  useEffect(() => { if (clientId) load() }, [clientId])

  async function load() {
    setLoading(true)
    const [{ data: p }, { data: profs }] = await Promise.all([
      supabase.from('projects').select('*, client:clients(company,alias), product:products(id,type,name)')
        .eq('client_id', clientId)
        .neq('archived', true)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('project_number', { ascending: false }),
      supabase.from('profiles').select('id, name').order('name'),
    ])
    setProjects(p || [])
    setProfiles(profs || [])
    setLoading(false)
  }

  async function toggleExpand(projectId) {
    const isOpen = expandedRows[projectId]
    setExpandedRows(prev => ({ ...prev, [projectId]: !isOpen }))
    if (!isOpen && !loadedProjects.has(projectId)) {
      const { data } = await supabase.from('tasks')
        .select('*, updater:profiles!tasks_updated_by_fkey(name)')
        .eq('project_id', projectId).order('sort_order').order('created_at')
      setProjectTasks(prev => ({ ...prev, [projectId]: data || [] }))
      setLoadedProjects(prev => new Set([...prev, projectId]))
    }
  }

  async function toggleItemExpand(projectId) {
    const isOpen = expandedItemRows[projectId]
    setExpandedItemRows(prev => ({ ...prev, [projectId]: !isOpen }))
    if (!isOpen && !loadedItemProjects.has(projectId)) {
      const { data } = await supabase.from('project_items')
        .select('id, item_number, name, scheduled_date, status, sort_order')
        .eq('project_id', projectId).order('sort_order', { ascending: true, nullsFirst: false }).order('item_number')
      setProjectItems(prev => ({ ...prev, [projectId]: data || [] }))
      setLoadedItemProjects(prev => new Set([...prev, projectId]))
    }
  }

  async function addProjectItem(projectId, payload) {
    const existing = projectItems[projectId] || []
    const nextNumber = String(existing.length + 1).padStart(2, '0')
    const { data } = await supabase.from('project_items')
      .insert({ ...payload, project_id: projectId, item_number: nextNumber })
      .select('id, item_number, name, scheduled_date, status, sort_order').single()
    if (data) setProjectItems(prev => ({ ...prev, [projectId]: [...(prev[projectId] || []), data] }))
  }

  async function updateProjectItem(projectId, itemId, updates) {
    const { data } = await supabase.from('project_items').update(updates).eq('id', itemId)
      .select('id, item_number, name, scheduled_date, status, sort_order').single()
    if (data) setProjectItems(prev => ({ ...prev, [projectId]: (prev[projectId] || []).map(i => i.id === itemId ? data : i) }))
  }

  async function deleteProjectItem(projectId, itemId) {
    await supabase.from('project_items').delete().eq('id', itemId)
    setProjectItems(prev => ({ ...prev, [projectId]: (prev[projectId] || []).filter(i => i.id !== itemId) }))
  }

  function reorderProjectItems(projectId, reordered) {
    setProjectItems(prev => ({ ...prev, [projectId]: reordered }))
    reordered.forEach((item, i) => { supabase.from('project_items').update({ sort_order: i }).eq('id', item.id).then(() => {}) })
  }

  async function saveProjectTask(projectId, taskId, updates) {
    const { data } = await supabase.from('tasks')
      .update({ ...updates, updated_at: new Date().toISOString() }).eq('id', taskId)
      .select('*, updater:profiles!tasks_updated_by_fkey(name)').single()
    if (data) setProjectTasks(prev => ({ ...prev, [projectId]: (prev[projectId] || []).map(t => t.id === taskId ? data : t) }))
  }

  async function addProjectTask(projectId, payload) {
    const tasks = projectTasks[projectId] || []
    const maxOrder = tasks.reduce((m, t) => Math.max(m, t.sort_order || 0), 0)
    const { data } = await supabase.from('tasks')
      .insert({ ...payload, project_id: projectId, status: 'Open', sort_order: maxOrder + 1 })
      .select('*, updater:profiles!tasks_updated_by_fkey(name)').single()
    if (data) setProjectTasks(prev => ({ ...prev, [projectId]: [...(prev[projectId] || []), data] }))
  }

  async function deleteProjectTask(projectId, taskId) {
    await supabase.from('tasks').delete().eq('id', taskId)
    setProjectTasks(prev => ({ ...prev, [projectId]: (prev[projectId] || []).filter(t => t.id !== taskId) }))
  }

  function reorderProjectTasks(projectId, reordered) {
    setProjectTasks(prev => ({ ...prev, [projectId]: reordered }))
    reordered.forEach((t, i) => { supabase.from('tasks').update({ sort_order: i }).eq('id', t.id).then(() => {}) })
  }

  async function toggleProofExpand(itemId) {
    const isOpen = expandedProofRows[itemId]
    setExpandedProofRows(prev => ({ ...prev, [itemId]: !isOpen }))
    if (!isOpen && !loadedProofItems.has(itemId)) {
      const { data } = await supabase.from('proofs').select('*').eq('item_id', itemId).order('version', { ascending: true })
      setItemProofs(prev => ({ ...prev, [itemId]: data || [] }))
      setLoadedProofItems(prev => new Set([...prev, itemId]))
    }
  }

  async function addProof(itemId, itemNumber) {
    const proofs = itemProofs[itemId] || []
    const { data } = await supabase.from('proofs').insert({ item_id: itemId, version: proofs.length + 1 }).select('*').single()
    if (data) setItemProofs(prev => ({ ...prev, [itemId]: [...(prev[itemId] || []), data] }))
  }

  async function deleteProof(itemId, proofId) {
    await supabase.from('proofs').delete().eq('id', proofId)
    setItemProofs(prev => ({ ...prev, [itemId]: (prev[itemId] || []).filter(p => p.id !== proofId) }))
  }

  async function updateProof(itemId, proofId, updates) {
    const { error } = await supabase.from('proofs').update(updates).eq('id', proofId)
    if (error) { console.error('updateProof failed:', error.message); return }
    setItemProofs(prev => ({ ...prev, [itemId]: (prev[itemId] || []).map(p => p.id === proofId ? { ...p, ...updates } : p) }))
  }

  const filtered = projects.filter(p => {
    const q = search.toLowerCase()
    return !q || p.name.toLowerCase().includes(q) || (p.project_number || '').includes(q)
  })

  const groups = groupByClient(filtered)

  return (
    <div className="fade-in">
      <div className="topbar">
        <div className="breadcrumb">
          <span className="breadcrumb-current" style={{ fontSize: 20, fontWeight: 700 }}>Projects</span>
        </div>
        <input
          type="text"
          placeholder="Search projects…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: 200 }}
        />
      </div>

      <div className="page-content">
        {loading ? (
          <div className="card"><div className="empty-state text-dim">Loading…</div></div>
        ) : filtered.length === 0 ? (
          <div className="card"><EmptyState icon="📁" title="No projects found" /></div>
        ) : (
          <div className="card">
            <div className="table-wrap">
              <table>
                {groups.map(group => (
                  <tbody key={`group-${group.name}`}>
                    <tr style={{ background: '#595958', pointerEvents: 'none' }}>
                      <td colSpan={6} style={{ padding: '7px 16px', fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#fff' }}>
                        {group.name}
                      </td>
                    </tr>
                    {group.projects.map(p => (
                      <ProjectRow
                        key={p.id}
                        p={p}
                        isExpanded={expandedRows[p.id]}
                        expandedItemRows={expandedItemRows}
                        tasks={projectTasks[p.id] || []}
                        profiles={profiles}
                        projectItems={projectItems}
                        expandedProofRows={expandedProofRows}
                        itemProofs={itemProofs}
                        onToggleExpand={toggleExpand}
                        onToggleItemExpand={toggleItemExpand}
                        onSaveTask={saveProjectTask}
                        onAddTask={addProjectTask}
                        onDeleteTask={deleteProjectTask}
                        onReorderTasks={reorderProjectTasks}
                        onAddItem={addProjectItem}
                        onUpdateItem={updateProjectItem}
                        onDeleteItem={deleteProjectItem}
                        onReorderItems={reorderProjectItems}
                        onToggleProofExpand={toggleProofExpand}
                        onAddProof={addProof}
                        onDeleteProof={deleteProof}
                        onUpdateProof={updateProof}
                      />
                    ))}
                  </tbody>
                ))}
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
