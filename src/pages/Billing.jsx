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
  Open:    { bg: 'var(--blue-bg)',  color: 'var(--blue)'  },
  Send:    { bg: 'var(--amber-bg)', color: 'var(--amber)' },
  Collect: { bg: 'var(--amber-bg)', color: 'var(--amber)' },
  Paid:    { bg: 'var(--green-bg)', color: 'var(--green)' },
  Overdue: { bg: 'var(--red-bg)',   color: 'var(--red)'   },
}

export default function BillingPage() {
  const navigate = useNavigate()
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading]   = useState(true)

  const [fDateStart, setFDateStart] = useState('')
  const [fDateEnd,   setFDateEnd]   = useState('')
  const [fClient,    setFClient]    = useState('')
  const [fNumber,    setFNumber]    = useState('')
  const [fAmt,       setFAmt]       = useState('')
  const [fStatus,    setFStatus]    = useState('')

  useEffect(() => { load() }, [])

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
      return true
    })
  }, [invoices, fDateStart, fDateEnd, fClient, fNumber, fAmt, fStatus])

  const total = displayed.reduce((s, i) => s + (i.amount || 0), 0)

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
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text3)' }}>
            {displayed.length} invoice{displayed.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="card">
          <div className="table-wrap">
            {loading ? (
              <div className="empty-state text-dim">Loading…</div>
            ) : (
              <table style={{ tableLayout: 'fixed', width: '100%' }}>
                <colgroup>
                  <col style={{ width: 80 }} />
                  <col style={{ width: 160 }} />
                  <col style={{ width: 110 }} />
                  <col style={{ width: 100 }} />
                  <col style={{ width: 80 }} />
                  <col style={{ width: 80 }} />
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
                    <th>Note</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--text3)' }}>No invoices found</td></tr>
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
                              fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20,
                              border: `1px solid ${sc.color || 'var(--border)'}`,
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
                        <td className="text-mono text-dim">{fmtDate(inv.sent_date)}</td>
                        <td>
                          <input
                            defaultValue={inv.notes || ''}
                            placeholder="Add note..."
                            onBlur={e => {
                              const val = e.target.value
                              if (val !== (inv.notes || '')) {
                                setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, notes: val } : i))
                                supabase.from('invoices').update({ notes: val }).eq('id', inv.id)
                              }
                            }}
                            style={{
                              width: '100%', fontSize: 12, color: 'var(--text2)',
                              background: 'transparent', border: '1px solid transparent',
                              borderRadius: 4, padding: '3px 6px', outline: 'none',
                              transition: 'border-color 0.15s',
                            }}
                            onFocus={e => { e.target.style.borderColor = 'var(--border)' }}
                            onBlurCapture={e => { e.target.style.borderColor = 'transparent' }}
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
                    <td colSpan={4}></td>
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
