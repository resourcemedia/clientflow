import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function fmtDate(d) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${parseInt(m, 10)}/${parseInt(day, 10)}/${y.slice(2)}`
}

function fmt$(n) {
  if (n == null || isNaN(n)) return '—'
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function WrenchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6"/><path d="M14 11v6"/>
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
    </svg>
  )
}

const inputStyle = {
  padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)',
  background: 'var(--bg2)', color: 'var(--text)', fontSize: 12,
  outline: 'none', height: 28,
}

const ICON_BTN = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)',
  background: 'transparent', color: 'var(--text2)', cursor: 'pointer',
  transition: 'all 0.15s',
}

const STATUS_COLORS = {
  Open:    { bg: '#e8e8f8', color: '#4a4a9c' },
  Send:    { bg: '#e8e8f8', color: '#4a4a9c' },
  Collect: { bg: '#fde8e8', color: '#9c2a2a' },
  Paid:    { bg: '#e6f4e6', color: '#2a6b2a' },
  Overdue: { bg: '#fde8e8', color: '#9c2a2a' },
}

function EditableCell({ value, onSave, placeholder, width, mono, type = 'text', min, max }) {
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

export default function BillingPage() {
  useEffect(() => { document.title = 'Invoices' }, [])
  const navigate = useNavigate()
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading]   = useState(true)

  const [fDateStart, setFDateStart] = useState('')
  const [fDateEnd,   setFDateEnd]   = useState('')
  const [fClient,    setFClient]    = useState('')
  const [fNumber,    setFNumber]    = useState('')
  const [fAmt,       setFAmt]       = useState('')
  const [fStatus,    setFStatus]    = useState('')
  const [scope, setScope] = useState(() => localStorage.getItem('invoiceScope') || 'open')

  const [editingSentId, setEditingSentId] = useState(null)

  useEffect(() => { load() }, [])
  useEffect(() => { localStorage.setItem('invoiceScope', scope) }, [scope])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('invoices')
      .select('*, client:clients(company)')
      .order('issued_date', { ascending: false })
    setInvoices(data || [])
    setLoading(false)
  }

  const displayed = useMemo(() => {
    return invoices.filter(inv => {
      if (fDateStart && inv.issued_date && inv.issued_date < fDateStart) return false
      if (fDateEnd   && inv.issued_date && inv.issued_date > fDateEnd)   return false
      if (fClient && !(inv.client?.company || '').toLowerCase().includes(fClient.toLowerCase())) return false
      if (fNumber && !(inv.invoice_number || '').toLowerCase().includes(fNumber.toLowerCase())) return false
      if (fAmt) {
        const needle = fAmt.replace(/[$,]/g, '').trim()
        if (needle && !String(inv.amount || '').includes(needle)) return false
      }
      if (fStatus && inv.status !== fStatus) return false
      if (scope === 'open' && inv.status === 'Paid') return false
      return true
    })
  }, [invoices, fDateStart, fDateEnd, fClient, fNumber, fAmt, fStatus, scope])

  const total = displayed.reduce((s, i) => s + (i.amount || 0), 0)
  const unpaidTotal = invoices.reduce((s, i) => (i.status !== 'Paid' ? s + (i.amount || 0) : s), 0)

  async function handleDuplicate(inv) {
    const { data: items } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', inv.id)

    const { id, created_at, updated_at, client, ...fields } = inv
    const newInv = {
      ...fields,
      status: 'Open',
      sent_date: null,
      paid_date: null,
      issued_date: new Date().toISOString().slice(0, 10),
    }

    const { data: inserted } = await supabase
      .from('invoices')
      .insert(newInv)
      .select()
      .single()

    if (inserted && items?.length) {
      const newItems = items.map(({ id: _id, created_at: _ca, invoice_id: _inv, ...rest }) => ({
        ...rest,
        invoice_id: inserted.id,
      }))
      await supabase.from('invoice_items').insert(newItems)
    }

    if (inserted) navigate(`/invoices/${inserted.id}`)
  }

  async function handleStatusChange(id, status) {
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, status } : i))
    await supabase.from('invoices').update({ status }).eq('id', id)
  }

  async function handleSentDateChange(inv, newDate) {
    const prev = inv.sent_date
    setInvoices(ts => ts.map(i => i.id === inv.id ? { ...i, sent_date: newDate || null } : i))
    setEditingSentId(null)
    const { error } = await supabase.from('invoices').update({ sent_date: newDate || null }).eq('id', inv.id)
    if (error) setInvoices(ts => ts.map(i => i.id === inv.id ? { ...i, sent_date: prev } : i))
  }

  async function handleCreate() {
    const { data, error } = await supabase
      .from('invoices')
      .insert({ issued_date: new Date().toISOString().split('T')[0], status: 'Send' })
      .select('id')
      .single()
    console.log('INSERT ERROR:', JSON.stringify(error))
    if (!error && data) navigate(`/invoices/${data.id}`)
  }

  async function handleDelete(inv) {
    if (!window.confirm(`Delete invoice ${inv.invoice_number}? This cannot be undone.`)) return
    await supabase.from('invoice_items').delete().eq('invoice_id', inv.id)
    await supabase.from('invoices').delete().eq('id', inv.id)
    setInvoices(prev => prev.filter(i => i.id !== inv.id))
  }

  async function saveInvoiceField(id, updates) {
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i))
    await supabase.from('invoices').update(updates).eq('id', id)
  }

  return (
    <div className="fade-in">
      <div className="topbar">
        <div className="topbar-title">Invoices</div>
        <button className="btn btn-primary" onClick={handleCreate}>+Invoice</button>
      </div>

      <div className="page-content">
        {/* Filter bar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            style={{ ...inputStyle, width: 120 }}
            type="date"
            value={fDateStart}
            onChange={e => setFDateStart(e.target.value)}
            title="Date start"
          />
          <input
            style={{ ...inputStyle, width: 120 }}
            type="date"
            value={fDateEnd}
            onChange={e => setFDateEnd(e.target.value)}
            title="Date end"
          />
          <input
            style={{ ...inputStyle, width: 140 }}
            placeholder="Client"
            value={fClient}
            onChange={e => setFClient(e.target.value)}
          />
          <input
            style={{ ...inputStyle, width: 110 }}
            placeholder="Invoice #"
            value={fNumber}
            onChange={e => setFNumber(e.target.value)}
          />
          <input
            style={{ ...inputStyle, width: 90 }}
            placeholder="Amount"
            value={fAmt}
            onChange={e => setFAmt(e.target.value)}
          />
          <select
            style={{ ...inputStyle, width: 120 }}
            value={fStatus}
            onChange={e => setFStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="Open">Open</option>
            <option value="Send">Send</option>
            <option value="Paid">Paid</option>
            <option value="Overdue">Overdue</option>
          </select>
          {(fDateStart || fDateEnd || fClient || fNumber || fAmt || fStatus) && (
            <button
              style={{ ...inputStyle, cursor: 'pointer', color: 'var(--text3)' }}
              onClick={() => { setFDateStart(''); setFDateEnd(''); setFClient(''); setFNumber(''); setFAmt(''); setFStatus('') }}
            >
              Clear
            </button>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', height: 28 }}>
              {['open', 'all'].map(s => (
                <button
                  key={s}
                  onClick={() => setScope(s)}
                  title={s === 'open' ? 'Show unpaid invoices only' : 'Show all invoices'}
                  style={{
                    padding: '0 12px', height: 28, fontSize: 12, fontWeight: 600,
                    border: 'none', cursor: 'pointer',
                    background: scope === s ? 'var(--text2)' : 'transparent',
                    color: scope === s ? 'var(--bg)' : 'var(--text2)',
                  }}
                >
                  {s === 'open' ? 'Open' : 'All'}
                </button>
              ))}
            </div>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>
              Unpaid <span style={{ fontWeight: 700, color: 'var(--text)' }}>{fmt$(unpaidTotal)}</span>
            </span>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>
              {displayed.length} invoice{displayed.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        <div className="card">
          <div className="table-wrap" style={{ overflow: 'visible' }}>
            {loading ? (
              <div className="empty-state text-dim">Loading…</div>
            ) : (
              <table style={{ tableLayout: 'fixed', width: '100%', overflow: 'visible' }}>
                <colgroup>
                  <col style={{ width: 80 }} />
                  <col style={{ width: 160 }} />
                  <col style={{ width: 110 }} />
                  <col style={{ width: 100 }} />
                  <col style={{ width: 80 }} />
                  <col style={{ width: 80 }} />
                  <col style={{ width: 60 }} />
                  <col />
                  <col style={{ width: 96 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Client</th>
                    <th>Number</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    <th>Status</th>
                    <th>Sent</th>
                    <th style={{ textAlign: 'center' }}>Chk</th>
                    <th>Note</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.length === 0 ? (
                    <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32, color: 'var(--text3)' }}>No invoices found</td></tr>
                  ) : displayed.map(inv => {
                    const sc = STATUS_COLORS[inv.status] || {}
                    return (
                      <tr key={inv.id}>
                        <td className="text-mono text-dim">{fmtDate(inv.issued_date)}</td>
                        <td className="td-main">{inv.client?.company || '—'}</td>
                        <td className="text-mono text-accent">{inv.invoice_number || '—'}</td>
                        <td className="text-mono" style={{ textAlign: 'right' }}>{fmt$(inv.amount)}</td>
                        <td>
                          <select
                            value={inv.status || ''}
                            onChange={e => handleStatusChange(inv.id, e.target.value)}
                            style={{
                              fontSize: 12, fontWeight: 500, padding: '3px 12px', borderRadius: 999,
                              border: 'none',
                              background: sc.bg || 'var(--bg2)',
                              color: sc.color || 'var(--text2)',
                              cursor: 'pointer', outline: 'none', appearance: 'none',
                            }}
                          >
                            <option value="Send">Send</option>
                            <option value="Collect">Collect</option>
                            <option value="Paid">Paid</option>
                          </select>
                        </td>
                        <td
                          className="text-mono text-dim"
                          style={{ cursor: 'pointer', position: 'relative', zIndex: 10, overflow: 'visible' }}
                          onClick={() => setEditingSentId(inv.id)}
                        >
                          {editingSentId === inv.id ? (
                            <input
                              type="date"
                              autoFocus
                              defaultValue={inv.sent_date || ''}
                              onChange={e => handleSentDateChange(inv, e.target.value)}
                              onBlur={() => setEditingSentId(null)}
                              style={{
                                fontSize: 12, color: 'var(--text2)',
                                background: 'transparent', border: '1px solid var(--border)',
                                borderRadius: 4, padding: '2px 4px', outline: 'none', width: 110,
                                position: 'relative', zIndex: 20,
                              }}
                            />
                          ) : (
                            fmtDate(inv.sent_date)
                          )}
                        </td>
                        <td
                          style={{ textAlign: 'center', cursor: 'pointer' }}
                          onClick={(e) => saveInvoiceField(inv.id, { checked_at: e.shiftKey ? null : new Date().toISOString() })}
                          title="Click to check · Shift-click to clear"
                        >
                          {(() => {
                            if (!inv.checked_at) return <span style={{ color: 'var(--text3)' }}>—</span>
                            const d = new Date(inv.checked_at)
                            const label = `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`
                            const startOfDay = (x) => { const t = new Date(x); t.setHours(0, 0, 0, 0); return t.getTime() }
                            const ageDays = Math.floor((startOfDay(new Date()) - startOfDay(d)) / 86400000)
                            const bg = ageDays <= 0 ? '#22c55e' : ageDays < 30 ? '#3b82f6' : '#ef4444'
                            return (
                              <span style={{
                                background: bg,
                                color: '#fff', borderRadius: 4,
                                padding: '1px 5px', fontSize: 11, display: 'inline-block',
                              }}>{label}</span>
                            )
                          })()}
                        </td>
                        <td>
                          <EditableCell
                            value={inv.notes || ''}
                            onSave={v => saveInvoiceField(inv.id, { notes: v })}
                            placeholder="Add note…"
                          />
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button
                              style={ICON_BTN}
                              title="Edit invoice"
                              onClick={() => navigate(`/invoices/${inv.id}`)}
                            >
                              <WrenchIcon />
                            </button>
                            <button
                              style={ICON_BTN}
                              title="Duplicate invoice"
                              onClick={() => handleDuplicate(inv)}
                            >
                              <PlusIcon />
                            </button>
                            <button
                              style={{ ...ICON_BTN, color: 'var(--red)' }}
                              title="Delete invoice"
                              onClick={() => handleDelete(inv)}
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--border2)' }}>
                    <td colSpan={3} style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text3)', fontWeight: 500 }}>
                      Total ({displayed.length})
                    </td>
                    <td className="text-mono" style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text)', fontSize: 13 }}>
                      {fmt$(total)}
                    </td>
                    <td colSpan={5}></td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
