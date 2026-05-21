import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function BackArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6"/><path d="M14 11v6"/>
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  )
}

const inp = {
  padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)',
  background: 'var(--bg2)', color: 'var(--text)', fontSize: 13,
  width: '100%', outline: 'none', height: 32, boxSizing: 'border-box',
}

const inpSm = {
  ...inp, fontSize: 12, height: 28, padding: '4px 8px',
}

const LBL = {
  display: 'block', fontSize: 11, fontWeight: 600,
  color: 'var(--text3)', textTransform: 'uppercase',
  letterSpacing: '0.05em', marginBottom: 4,
}

const ICON_BTN = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)',
  background: 'transparent', color: 'var(--text2)', cursor: 'pointer',
}

function Field({ label, children, style }) {
  return (
    <div style={style}>
      <label style={LBL}>{label}</label>
      {children}
    </div>
  )
}

function fmt$(n) {
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function InvoiceWorksheet() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [clients, setClients]   = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)

  const [form, setForm] = useState({
    issued_date:        '',
    invoice_number:     '',
    client_id:          '',
    billing_address1:   '',
    billing_address2:   '',
    billing_city:       '',
    billing_state:      '',
    billing_zip:        '',
    billing_first_name: '',
    billing_last_name:  '',
    sent_date:          '',
  })

  const [items, setItems] = useState([])

  useEffect(() => { load() }, [id])

  async function load() {
    setLoading(true)
    const [{ data: inv }, { data: cl }, { data: pr }, { data: it }] = await Promise.all([
      supabase.from('invoices')
        .select('id,issued_date,invoice_number,client_id,billing_address1,billing_address2,billing_city,billing_state,billing_zip,billing_first_name,billing_last_name,sent_date')
        .eq('id', id).single(),
      supabase.from('clients')
        .select('id,company,billing_address1,billing_address2,billing_city,billing_state,billing_zip,billing_first_name,billing_last_name')
        .order('company'),
      supabase.from('projects').select('id,job_number,name').order('name'),
      supabase.from('invoice_items').select('*').eq('invoice_id', id).order('id'),
    ])
    if (inv) {
      setForm({
        issued_date:        inv.issued_date        || '',
        invoice_number:     inv.invoice_number     || '',
        client_id:          inv.client_id != null ? String(inv.client_id) : '',
        billing_address1:   inv.billing_address1   || '',
        billing_address2:   inv.billing_address2   || '',
        billing_city:       inv.billing_city       || '',
        billing_state:      inv.billing_state      || '',
        billing_zip:        inv.billing_zip        || '',
        billing_first_name: inv.billing_first_name || '',
        billing_last_name:  inv.billing_last_name  || '',
        sent_date:          inv.sent_date          || '',
      })
    }
    setClients(cl || [])
    setProjects(pr || [])
    setItems((it || []).map(item => ({ ...item, _key: String(item.id) })))
    setLoading(false)
  }

  function sf(f) { return e => setForm(p => ({ ...p, [f]: e.target.value })) }

  function handleClientChange(e) {
    const val = e.target.value
    const client = clients.find(c => String(c.id) === val)
    if (client) {
      setForm(p => ({
        ...p,
        client_id:          val,
        billing_address1:   client.billing_address1   || '',
        billing_address2:   client.billing_address2   || '',
        billing_city:       client.billing_city       || '',
        billing_state:      client.billing_state      || '',
        billing_zip:        client.billing_zip        || '',
        billing_first_name: client.billing_first_name || '',
        billing_last_name:  client.billing_last_name  || '',
      }))
    } else {
      setForm(p => ({ ...p, client_id: val }))
    }
  }

  function addItem() {
    setItems(prev => [...prev, {
      _key: `new_${Date.now()}`,
      project_id: '',
      description: '',
      date_range: '',
      amount: '',
    }])
  }

  function removeItem(key) {
    setItems(prev => prev.filter(i => i._key !== key))
  }

  function updateItem(key, field, value) {
    setItems(prev => prev.map(i => i._key === key ? { ...i, [field]: value } : i))
  }

  const total = items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)

  async function save() {
    setSaving(true)
    await supabase.from('invoices').update({
      issued_date:        form.issued_date        || null,
      invoice_number:     form.invoice_number,
      client_id:          form.client_id          || null,
      billing_address1:   form.billing_address1,
      billing_address2:   form.billing_address2,
      billing_city:       form.billing_city,
      billing_state:      form.billing_state,
      billing_zip:        form.billing_zip,
      billing_first_name: form.billing_first_name,
      billing_last_name:  form.billing_last_name,
      sent_date:          form.sent_date          || null,
    }).eq('id', id)

    await supabase.from('invoice_items').delete().eq('invoice_id', id)
    if (items.length > 0) {
      await supabase.from('invoice_items').insert(
        items.map(item => ({
          invoice_id:  id,
          project_id:  item.project_id  || null,
          description: item.description || '',
          date_range:  item.date_range  || '',
          amount:      parseFloat(item.amount) || 0,
        }))
      )
    }
    setSaving(false)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ color: 'var(--text3)', fontSize: 14 }}>Loading…</div>
    </div>
  )

  return (
    <div className="fade-in">
      <div className="topbar">
        <button
          className="btn btn-ghost"
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={() => navigate('/billing')}
        >
          <BackArrowIcon /> Invoices
        </button>
        <div className="topbar-title">Invoice Worksheet</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => navigate(`/invoices/${id}/print`)}>View</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="page-content">
        {/* Header fields */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ padding: '20px 24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <Field label="Date">
                <input style={inp} type="date" value={form.issued_date} onChange={sf('issued_date')} />
              </Field>
              <Field label="Invoice Number">
                <input style={inp} value={form.invoice_number} onChange={sf('invoice_number')} placeholder="e.g. #1049" />
              </Field>
            </div>

            <div style={{ marginBottom: 16 }}>
              <Field label="Client">
                <select style={inp} value={form.client_id} onChange={handleClientChange}>
                  <option value="">— Select client —</option>
                  {clients.map(c => (
                    <option key={c.id} value={String(c.id)}>{c.company}</option>
                  ))}
                </select>
              </Field>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <Field label="Address 1">
                <input style={inp} value={form.billing_address1} onChange={sf('billing_address1')} />
              </Field>
              <Field label="Address 2">
                <input style={inp} value={form.billing_address2} onChange={sf('billing_address2')} />
              </Field>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
              <Field label="City">
                <input style={inp} value={form.billing_city} onChange={sf('billing_city')} />
              </Field>
              <Field label="State">
                <input style={inp} value={form.billing_state} onChange={sf('billing_state')} />
              </Field>
              <Field label="Zip">
                <input style={inp} value={form.billing_zip} onChange={sf('billing_zip')} />
              </Field>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 }}>
              <Field label="First Name">
                <input style={inp} value={form.billing_first_name} onChange={sf('billing_first_name')} />
              </Field>
              <Field label="Last Name">
                <input style={inp} value={form.billing_last_name} onChange={sf('billing_last_name')} />
              </Field>
              <Field label="Sent Date">
                <input style={inp} type="date" value={form.sent_date} onChange={sf('sent_date')} />
              </Field>
              <div />
            </div>
          </div>
        </div>

        {/* Line items */}
        <div className="card">
          <div className="table-wrap">
            <table style={{ tableLayout: 'fixed', width: '100%' }}>
              <colgroup>
                <col style={{ width: 210 }} />
                <col />
                <col style={{ width: 140 }} />
                <col style={{ width: 110 }} />
                <col style={{ width: 40 }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Description</th>
                  <th>Date Range</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th style={{ textAlign: 'center' }}>
                    <button style={ICON_BTN} title="Add line item" onClick={addItem}>
                      <PlusIcon />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: 28, color: 'var(--text3)', fontSize: 13 }}>
                      No line items — click + to add
                    </td>
                  </tr>
                ) : items.map(item => (
                  <tr key={item._key}>
                    <td>
                      <select
                        style={{ ...inpSm, width: '100%' }}
                        value={item.project_id ? String(item.project_id) : ''}
                        onChange={e => updateItem(item._key, 'project_id', e.target.value || null)}
                      >
                        <option value="">— None —</option>
                        {projects.map(p => (
                          <option key={p.id} value={String(p.id)}>
                            {[p.job_number, p.name].filter(Boolean).join(' ')}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        style={{ ...inpSm, width: '100%' }}
                        value={item.description}
                        onChange={e => updateItem(item._key, 'description', e.target.value)}
                        placeholder="Description"
                      />
                    </td>
                    <td>
                      <input
                        style={{ ...inpSm, width: '100%' }}
                        value={item.date_range}
                        onChange={e => updateItem(item._key, 'date_range', e.target.value)}
                        placeholder="e.g. Jan 1–31"
                      />
                    </td>
                    <td>
                      <input
                        style={{ ...inpSm, width: '100%', textAlign: 'right' }}
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.amount}
                        onChange={e => updateItem(item._key, 'amount', e.target.value)}
                        placeholder="0.00"
                      />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        style={{ ...ICON_BTN, color: 'var(--red)' }}
                        title="Remove line item"
                        onClick={() => removeItem(item._key)}
                      >
                        <TrashIcon />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border2)' }}>
                  <td colSpan={3} style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text3)', fontWeight: 500, textAlign: 'right' }}>
                    Total
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--text)', fontSize: 13, fontFamily: 'DM Mono, monospace' }}>
                    {fmt$(total)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
