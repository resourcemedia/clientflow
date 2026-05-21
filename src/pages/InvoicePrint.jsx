import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const MIN_ROWS = 10

function fmtLongDate(d) {
  if (!d) return ''
  const [y, m, day] = d.split('-').map(Number)
  const months = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
  ]
  return `${months[m - 1]} ${day}, ${y}`
}

function fmtAmt(n) {
  if (n == null || n === '') return ''
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function ResourceMediaLogo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {/* Stylized leaf/sprout — approximates Resource Media brand mark */}
      <svg width="42" height="52" viewBox="0 0 42 52" fill="none">
        <path d="M21 48 C9 36 5 26 5 18 C5 9 12 3 21 3 C30 3 37 9 37 18 C37 26 33 36 21 48Z" fill="#5a9e38"/>
        <path d="M21 42 C13 32 10 24 10 18 C10 12 15 7 21 7 C27 7 32 12 32 18 C32 24 29 32 21 42Z" fill="#7ec044"/>
        <rect x="19" y="47" width="4" height="5" rx="2" fill="#7a5c28"/>
      </svg>
      <div style={{ lineHeight: 1 }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: '#2a2a2a', letterSpacing: '-0.2px', fontFamily: 'system-ui, sans-serif' }}>resource</span>
        <span style={{ fontSize: 22, fontWeight: 300, color: '#999', fontFamily: 'system-ui, sans-serif' }}>media</span>
      </div>
    </div>
  )
}

export default function InvoicePrint() {
  const { id } = useParams()
  const [invoice, setInvoice]  = useState(null)
  const [items, setItems]       = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: inv }, { data: it }] = await Promise.all([
        supabase.from('invoices')
          .select('*, client:clients(company)')
          .eq('id', id).single(),
        supabase.from('invoice_items')
          .select('*, project:projects(id, project_number, name)')
          .eq('invoice_id', id)
          .order('id'),
      ])
      setInvoice(inv)
      setItems(it || [])
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return <div style={{ padding: 40, color: '#999', fontFamily: 'system-ui' }}>Loading…</div>
  if (!invoice)  return <div style={{ padding: 40, fontFamily: 'system-ui' }}>Invoice not found.</div>

  const total     = items.reduce((s, i) => s + (i.amount || 0), 0)
  const blankRows = Math.max(0, MIN_ROWS - items.length)

  const cityLine = [
    [invoice.billing_city, invoice.billing_state].filter(Boolean).join(', '),
    invoice.billing_zip,
  ].filter(Boolean).join(' ')

  const attn = [invoice.billing_first_name, invoice.billing_last_name].filter(Boolean).join(' ')

  const cell = (extra = {}) => ({
    padding: '7px 10px',
    borderRight: '1px solid #d8d8d8',
    borderBottom: '1px solid #d8d8d8',
    fontSize: 13,
    color: '#222',
    verticalAlign: 'top',
    ...extra,
  })

  return (
    <>
      <style>{`
        @media print {
          .sidebar, .print-hide { display: none !important; }
          .app-layout { display: block !important; }
          .main-content {
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            background: white !important;
          }
          body { background: white !important; }
          .invoice-print-wrap { padding: 0 !important; }
        }
      `}</style>

      <div className="invoice-print-wrap" style={{ padding: '28px 48px', background: 'white', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

        {/* Print / PDF button */}
        <div className="print-hide" style={{ marginBottom: 28 }}>
          <button
            onClick={() => window.print()}
            style={{
              padding: '6px 18px', borderRadius: 6, border: '1px solid #ccc',
              background: 'white', fontSize: 13, cursor: 'pointer', color: '#333',
            }}
          >
            Print / PDF
          </button>
        </div>

        <div style={{ maxWidth: 740, margin: '0 auto' }}>

          {/* Logo + Invoice title */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 36 }}>
            <ResourceMediaLogo />
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 38, fontWeight: 800, color: '#1a1a1a', lineHeight: 1, letterSpacing: '-1px' }}>
                Invoice
              </div>
              <div style={{ fontSize: 16, color: '#666', marginTop: 6 }}>
                {invoice.invoice_number || ''}
              </div>
            </div>
          </div>

          {/* Bill-to block */}
          <div style={{ marginBottom: 32, fontSize: 14, lineHeight: 1.75, color: '#222' }}>
            <div>{fmtLongDate(invoice.issued_date)}</div>
            {invoice.client?.company && (
              <div style={{ fontWeight: 700, fontSize: 15 }}>{invoice.client.company}</div>
            )}
            {invoice.billing_address1 && <div>{invoice.billing_address1}</div>}
            {invoice.billing_address2 && <div>{invoice.billing_address2}</div>}
            {cityLine && <div>{cityLine}</div>}
            {attn && <div>Attention: {attn}</div>}
          </div>

          {/* Line items table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 72 }} />
              <col style={{ width: 160 }} />
              <col />
              <col style={{ width: 110 }} />
              <col style={{ width: 88 }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '2px solid #bbb' }}>
                {[
                  { label: 'No.',           align: 'left'  },
                  { label: 'Category',      align: 'left'  },
                  { label: 'Description',   align: 'left'  },
                  { label: 'Project Dates', align: 'left'  },
                  { label: 'Amount',        align: 'right' },
                ].map((col, i) => (
                  <th key={col.label} style={{
                    padding: '8px 10px',
                    textAlign: col.align,
                    fontWeight: 700,
                    fontSize: 13,
                    color: '#222',
                    borderRight: i < 4 ? '1px solid #d8d8d8' : 'none',
                    borderBottom: '2px solid #bbb',
                  }}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td style={cell()}>{item.project?.project_number || ''}</td>
                  <td style={cell()}>{item.project?.name || ''}</td>
                  <td style={cell()}>{item.description || ''}</td>
                  <td style={cell()}>{item.date_range || ''}</td>
                  <td style={cell({ textAlign: 'right', borderRight: 'none' })}>
                    {item.amount != null ? fmtAmt(item.amount) : ''}
                  </td>
                </tr>
              ))}
              {Array.from({ length: blankRows }, (_, i) => (
                <tr key={`blank_${i}`}>
                  <td style={cell({ height: 32 })}> </td>
                  <td style={cell()}> </td>
                  <td style={cell()}> </td>
                  <td style={cell()}> </td>
                  <td style={cell({ borderRight: 'none' })}> </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid #bbb' }}>
                <td colSpan={3} style={{ padding: '10px 10px' }} />
                <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, fontSize: 14, borderRight: '1px solid #d8d8d8' }}>
                  Total
                </td>
                <td style={{ padding: '10px 10px', textAlign: 'right', fontSize: 14 }}>
                  {fmtAmt(total)}
                </td>
              </tr>
            </tfoot>
          </table>

        </div>
      </div>
    </>
  )
}
