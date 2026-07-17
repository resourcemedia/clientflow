import { useState, useEffect } from 'react'

// ── BADGE ──────────────────────────────────────────────────────────────
export function Badge({ children, variant = 'gray' }) {
  return <span className={`badge badge-${variant}`}>{children}</span>
}

// Map common status strings → badge variants
export function StatusBadge({ status }) {
  const map = {
    active: ['green', 'Active'],
    inactive: ['gray', 'Inactive'],
    'In Progress': ['amber', 'In Progress'],
    Open: ['blue', 'Open'],
    Approved: ['green', 'Approved'],
    Complete: ['green', 'Complete'],
    Review: ['blue', 'Review'],
    Revise: ['amber', 'Revise'],
    'No Go': ['red', 'No Go'],
    Sent: ['amber', 'Sent'],
    Paid: ['green', 'Paid'],
    Now: ['red', 'Now'],
    'Hot All': ['amber', 'Hot All'],
    'Hot Area': ['coral', 'Hot Area'],
    Normal: ['gray', 'Normal'],
    CO: ['accent', 'Content'],
    ST: ['gray', 'Setup'],
    DS: ['coral', 'Design'],
    OH: ['blue', 'Overhead'],
  }
  const [variant, label] = map[status] || ['gray', status]
  return <Badge variant={variant}>{label}</Badge>
}

// ── MODAL ──────────────────────────────────────────────────────────────
export function Modal({ title, onClose, children, footer }) {
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal fade-in">
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        {children}
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

// ── CONFIRM DIALOG ─────────────────────────────────────────────────────
export function ConfirmModal({ message, onConfirm, onCancel, danger = true }) {
  return (
    <Modal title="Confirm" onClose={onCancel} footer={
      <>
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>Confirm</button>
      </>
    }>
      <div style={{ padding: '20px 24px', color: 'var(--text2)', fontSize: '14px' }}>{message}</div>
    </Modal>
  )
}

// ── EMPTY STATE ────────────────────────────────────────────────────────
export function EmptyState({ icon = '📂', title, sub, action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <div className="empty-text">{title}</div>
      {sub && <div className="empty-sub text-dim">{sub}</div>}
      {action}
    </div>
  )
}

// ── PILL NAV ──────────────────────────────────────────────────────────
export function PillNav({ tabs, active, onChange }) {
  return (
    <div className="pill-nav">
      {tabs.map(tab => (
        <div
          key={tab.id}
          className={`pill ${active === tab.id ? 'active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </div>
      ))}
    </div>
  )
}

// ── FORM ROW ──────────────────────────────────────────────────────────
export function FormGroup({ label, full, children }) {
  return (
    <div className={`form-group${full ? ' full' : ''}`}>
      {label && <label>{label}</label>}
      {children}
    </div>
  )
}

// ── STAT CARD ─────────────────────────────────────────────────────────
export function StatCard({ label, value, delta, color = 'accent', deltaDown }) {
  return (
    <div className={`stat-card ${color}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {delta && <div className={`stat-delta${deltaDown ? ' down' : ''}`}>{delta}</div>}
    </div>
  )
}

// ── BREADCRUMB ─────────────────────────────────────────────────────────
// segments: [{ label, onClick? }]  — last segment is current (no onClick)
export function Breadcrumb({ segments }) {
  return (
    <div className="breadcrumb">
      {segments.map((seg, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {i > 0 && <span className="breadcrumb-sep">|</span>}
          {seg.onClick
            ? <button className="breadcrumb-link" onClick={seg.onClick}>{seg.label}</button>
            : <span className="breadcrumb-current">{seg.label}</span>
          }
        </span>
      ))}
    </div>
  )
}

// ── FORMAT HELPERS ─────────────────────────────────────────────────────
export function fmt$( n ) {
  if (n == null) return '—'
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0 })
}

export function initials(str) {
  if (!str) return '??'
  return str.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

// ── INLINE MULTI-LINE NOTE CELL ────────────────────────────────────────
// Textarea sibling of EditableCell (CashFlow). Click to edit, blur to save.
// Module-level so it keeps stable identity and doesn't lose focus on re-render.
// Used by Calendar (List view) and Projects (Item drawer).
// ── EDITABLE CELL ──────────────────────────────────────────────────────
// Promoted from CashFlow.jsx (verbatim). Click to edit; Enter/blur saves,
// Escape reverts. CashFlow still uses its local copy for now.
export function EditableCell({ value, onSave, placeholder, width, mono, type = 'text', min, max }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value ?? '')

  useEffect(() => { if (!editing) setVal(value ?? '') }, [value, editing])

  if (editing) {
    return (
      <input
        autoFocus
        type={type}
        min={min}
        max={max}
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={() => {
          setEditing(false)
          const trimmed = type === 'text' ? val.trim() : val
          if (trimmed !== (value ?? '')) onSave(trimmed)
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') e.target.blur()
          if (e.key === 'Escape') { setVal(value ?? ''); setEditing(false) }
        }}
        style={{
          width: width || '100%', background: 'var(--bg3)', border: '1px solid var(--accent)',
          borderRadius: 4, padding: '2px 6px', fontSize: 13, outline: 'none',
          fontFamily: mono ? 'DM Mono, monospace' : 'inherit',
        }}
      />
    )
  }

  return (
    <span
      onClick={() => { setVal(value ?? ''); setEditing(true) }}
      style={{
        cursor: 'text', display: 'inline-block', minWidth: 32, minHeight: 20,
        fontFamily: mono ? 'DM Mono, monospace' : 'inherit',
      }}
    >
      {value != null && value !== '' ? value : <span style={{ color: 'var(--text3)', fontSize: 12 }}>{placeholder || '—'}</span>}
    </span>
  )
}

export function NoteCell({ value, onSave, placeholder = 'Add note…', textColor = 'var(--text2)' }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value ?? '')
  useEffect(() => { setVal(value ?? '') }, [value])

  if (!editing) {
    return (
      <div onClick={() => setEditing(true)}
        style={{ cursor: 'text', minHeight: 20, whiteSpace: 'pre-wrap',
                 color: value ? textColor : 'var(--text3)' }}>
        {value || placeholder}
      </div>
    )
  }
  return (
    <textarea
      autoFocus
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={() => { setEditing(false); if ((val ?? '') !== (value ?? '')) onSave(val) }}
      rows={2}
      style={{
        width: '100%', minWidth: 160, fontSize: 13, fontFamily: 'inherit',
        padding: '4px 6px', borderRadius: 6, border: '1px solid var(--accent)',
        background: 'var(--bg2)', color: 'var(--text)', resize: 'vertical',
      }}
    />
  )
}
