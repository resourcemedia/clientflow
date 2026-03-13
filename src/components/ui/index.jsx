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

// ── FORMAT HELPERS ─────────────────────────────────────────────────────
export function fmt$( n ) {
  if (n == null) return '—'
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0 })
}

export function initials(str) {
  if (!str) return '??'
  return str.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}
