import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import logoSrc from '../assets/resource_media_logo.svg'

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


export default function InvoicePrint() {
  useEffect(() => { document.title = 'Invoice' }, [])
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
    padding: '2px 10px',
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
          .invoice-footer {
            position: fixed;
            bottom: 20px;
            left: 0;
            right: 0;
            text-align: center;
          }
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
            <img src={logoSrc} alt="Resource Media" style={{ height: 74 }} />
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 30, fontWeight: 800, color: '#1a1a1a', lineHeight: 1, letterSpacing: '-0.5px' }}>
                Invoice
              </div>
              <div style={{ fontSize: 20, color: '#666', marginTop: 2 }}>
                {invoice.invoice_number || ''}
              </div>
            </div>
          </div>

          {/* Bill-to block */}
          <div style={{ marginBottom: 32, fontSize: 14, lineHeight: 1.4, color: '#222' }}>
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
              <tr style={{ borderTop: '1px solid #bbb', borderBottom: '2px solid #bbb' }}>
                {[
                  { label: 'No.',         align: 'left'  },
                  { label: 'Project',     align: 'left'  },
                  { label: 'Description', align: 'left'  },
                  { label: 'Date Range',  align: 'left'  },
                  { label: 'Amount',      align: 'right' },
                ].map((col, i) => (
                  <th key={col.label} style={{
                    padding: '8px 10px',
                    textAlign: col.align,
                    fontWeight: 'bold',
                    fontSize: 13,
                    color: '#222',
                    background: 'white',
                    textTransform: 'none',
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
                  <td style={cell({ height: 24 })}> </td>
                  <td style={cell()}> </td>
                  <td style={cell()}> </td>
                  <td style={cell()}> </td>
                  <td style={cell({ borderRight: 'none' })}> </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid #bbb', borderBottom: '2px solid #bbb' }}>
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

        {/* Footer */}
        <div className="invoice-footer" style={{
          position: 'fixed', bottom: 24, left: 0, right: 0,
          textAlign: 'center', fontSize: 13, color: '#222', letterSpacing: '0.01em',
        }}>
          Resource Media &nbsp;|&nbsp; 41 Machell Avenue, Dallas, PA 18612 &nbsp;|&nbsp; 570.706.6649 &nbsp;|&nbsp; www.ResourceMedia.net
        </div>

      </div>
    </>
  )
}
