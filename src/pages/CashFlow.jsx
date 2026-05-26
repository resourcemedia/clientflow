import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { GripVertical } from 'lucide-react'

const CATEGORIES = ['Bank', 'Income', 'Expense']

const CAT_COLORS = {
  Bank:    '#64c97a',
  Income:  '#b9dd67',
  Expense: '#ffb8b8',
}

function fmt$(n) {
  return Number(n || 0).toFixed(2)
}

// ── ICONS ─────────────────────────────────────────────────────────────────────

function EditLinkIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  )
}

function ExternalLinkIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
      <polyline points="15 3 21 3 21 9"/>
      <line x1="10" y1="14" x2="21" y2="3"/>
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6M14 11v6"/>
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
    </svg>
  )
}

// ── STYLES ────────────────────────────────────────────────────────────────────

const TH = {
  padding: '7px 10px', fontSize: 11, fontWeight: 600, color: 'var(--text3)',
  letterSpacing: '0.06em', textTransform: 'uppercase',
  borderBottom: '2px solid var(--border2)', whiteSpace: 'nowrap', textAlign: 'left',
}

const TD = {
  padding: '6px 10px', fontSize: 13, verticalAlign: 'middle',
  borderBottom: '1px solid var(--border)',
}

const ICON_BTN = {
  border: '1px solid var(--border)', borderRadius: 4, padding: '2px 5px',
  cursor: 'pointer', background: 'var(--bg3)', color: 'var(--text2)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  lineHeight: 1,
}

// ── INLINE TEXT CELL ──────────────────────────────────────────────────────────

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

// ── AMOUNT CELL ───────────────────────────────────────────────────────────────

function AmountCell({ amount, isExpenseField, onSave }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState('')

  const displayed = isExpenseField
    ? (amount < 0 ? fmt$(Math.abs(amount)) : null)
    : (amount > 0 ? fmt$(amount) : null)

  function commit(raw) {
    setEditing(false)
    const n = parseFloat(raw)
    if (!isNaN(n) && n > 0) onSave(isExpenseField ? -n : n)
  }

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        min="0"
        step="0.01"
        defaultValue={displayed || ''}
        onBlur={e => commit(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') e.target.blur()
          if (e.key === 'Escape') setEditing(false)
        }}
        style={{
          width: 80, background: 'var(--bg3)', border: '1px solid var(--accent)',
          borderRadius: 4, padding: '2px 6px', fontSize: 13, textAlign: 'right',
          fontFamily: 'DM Mono, monospace', outline: 'none',
        }}
      />
    )
  }

  return (
    <span
      onClick={() => setEditing(true)}
      style={{
        cursor: 'text', display: 'inline-block', minWidth: 40, textAlign: 'right',
        fontFamily: 'DM Mono, monospace', fontSize: 13,
        color: displayed ? 'var(--text)' : 'var(--text3)',
      }}
    >
      {displayed ?? '—'}
    </span>
  )
}

// ── ROW ───────────────────────────────────────────────────────────────────────

function CashFlowRow({ row, contribution, balance, onSave, onToggleActive, onToggleVisible, onAddAfter, onDelete, isDragging, isDragTarget, onDragStart, onDragOver, onDrop, onDragEnd }) {
  const [urlOpen, setUrlOpen] = useState(false)
  const [urlDraft, setUrlDraft] = useState('')
  const [editingAccount, setEditingAccount] = useState(null)
  const urlInputRef = useRef(null)
  const urlPopoverRef = useRef(null)

  useEffect(() => {
    if (!urlOpen) return
    setUrlDraft(row.url || '')
    setTimeout(() => urlInputRef.current?.focus(), 0)
    function handleClick(e) {
      if (urlPopoverRef.current && !urlPopoverRef.current.contains(e.target)) setUrlOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [urlOpen])

  async function commitUrl() {
    const trimmed = urlDraft.trim()
    await onSave(row.id, { url: trimmed || null })
    setUrlOpen(false)
  }

  return (
    <tr
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      style={{
        borderBottom: '1px solid var(--border)',
        opacity: isDragging ? 0.4 : 1,
        outline: isDragTarget ? '2px solid var(--accent)' : undefined,
        cursor: 'default',
      }}
    >

      {/* Drag handle */}
      <td style={{ ...TD, width: 28, cursor: 'grab', color: 'var(--text3)', paddingLeft: 8, paddingRight: 4 }}>
        <GripVertical size={14} />
      </td>

      {/* Day */}
      <td style={{ ...TD, width: 52 }}>
        <EditableCell
          value={row.day != null ? String(row.day) : ''}
          onSave={v => { const n = parseInt(v, 10); if (!isNaN(n) && n >= 0 && n <= 31) onSave(row.id, { day: n }) }}
          placeholder="0" width={36} mono type="number" min={0} max={31}
        />
      </td>

      {/* Who */}
      <td style={{ ...TD, minWidth: 90 }}>
        <EditableCell value={row.who || ''} onSave={v => onSave(row.id, { who: v })} placeholder="—" />
      </td>

      {/* Category */}
      <td style={{ ...TD, width: 100 }}>
        <select
          value={row.category || 'Expense'}
          onChange={e => onSave(row.id, { category: e.target.value })}
          style={{
            fontSize: 12, border: 'none', borderRadius: 4,
            padding: '2px 6px', cursor: 'pointer',
            background: CAT_COLORS[row.category] || CAT_COLORS.Expense,
            color: '#1a1a1a',
          }}
        >
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </td>

      {/* Tag */}
      <td style={{ ...TD, width: 110 }}>
        <EditableCell value={row.tag || ''} onSave={v => onSave(row.id, { tag: v })} placeholder="—" />
      </td>

      {/* Note */}
      <td style={TD}>
        <EditableCell value={row.note || ''} onSave={v => onSave(row.id, { note: v })} placeholder="—" />
      </td>

      {/* Account */}
      <td onMouseDown={(e) => { e.preventDefault(); setEditingAccount(row.id) }} style={{ ...TD, width: 100, cursor: 'pointer' }}>
        {editingAccount === row.id ? (
          <select
            autoFocus
            value={row.account || ''}
            onChange={async (e) => {
              const val = e.target.value || null
              await onSave(row.id, { account: val })
              setEditingAccount(null)
            }}
            onBlur={() => setEditingAccount(null)}
          >
            <option value="">—</option>
            <option value="CBNA">CBNA</option>
            <option value="PayPal">PayPal</option>
            <option value="Apple Credit">Apple Credit</option>
            <option value="Check">Check</option>
          </select>
        ) : (
          <span>{row.account || ''}</span>
        )}
      </td>

      {/* Income */}
      <td style={{ ...TD, textAlign: 'right', width: 100 }}>
        <AmountCell amount={row.amount || 0} isExpenseField={false} onSave={amt => onSave(row.id, { amount: amt })} />
      </td>

      {/* Expense */}
      <td style={{ ...TD, textAlign: 'right', width: 100 }}>
        <AmountCell amount={row.amount || 0} isExpenseField={true} onSave={amt => onSave(row.id, { amount: amt })} />
      </td>

      {/* Active + Visible dot toggles */}
      <td style={{ ...TD, width: 60, textAlign: 'center' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <button
            onClick={() => onToggleActive(row)}
            title={row.active ? 'Active — click to deactivate' : 'Inactive — click to activate'}
            style={{
              width: 13, height: 13, borderRadius: '50%', border: 'none', padding: 0,
              cursor: 'pointer', display: 'inline-block', flexShrink: 0,
              background: row.active ? '#64c97a' : '#ffb8b8',
            }}
          />
          <button
            onClick={() => onToggleVisible(row)}
            title={row.visible === false ? 'Hidden — click to show' : 'Visible — click to hide'}
            style={{
              width: 13, height: 13, borderRadius: '50%', border: 'none', padding: 0, flexShrink: 0,
              cursor: 'pointer', display: 'inline-block',
              background: row.visible === false ? '#d1d5db' : '#6b7280',
            }}
          />
        </span>
      </td>

      {/* Row contribution */}
      <td style={{ ...TD, textAlign: 'right', width: 90, fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
        {fmt$(contribution)}
      </td>

      {/* Running balance */}
      <td style={{
        ...TD, textAlign: 'right', width: 90, fontFamily: 'DM Mono, monospace', fontSize: 12,
        color: (balance ?? 0) < 0 ? '#ef4444' : 'var(--text)',
      }}>
        {fmt$(balance)}
      </td>

      {/* Edit URL — inline popover */}
      <td style={{ ...TD, width: 36, textAlign: 'center', position: 'relative' }} ref={urlPopoverRef}>
        <button style={ICON_BTN} onClick={() => setUrlOpen(v => !v)} title="Edit URL">
          <EditLinkIcon />
        </button>
        {urlOpen && (
          <div style={{
            position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 300,
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: 8, boxShadow: '0 4px 18px rgba(0,0,0,0.18)',
            padding: 8, minWidth: 280, display: 'flex', gap: 6, alignItems: 'center',
          }}>
            <input
              ref={urlInputRef}
              value={urlDraft}
              onChange={e => setUrlDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commitUrl(); if (e.key === 'Escape') setUrlOpen(false) }}
              placeholder="https://…"
              style={{ flex: 1, fontSize: 12, padding: '3px 7px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg)', color: 'var(--text)', outline: 'none' }}
            />
            <button className="btn btn-primary btn-sm" onClick={commitUrl}>Save</button>
          </div>
        )}
      </td>

      {/* Open URL */}
      <td style={{ ...TD, width: 36, textAlign: 'center' }}>
        <a
          href={row.url || undefined}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => { if (!row.url) e.preventDefault() }}
          title={row.url || 'No URL set'}
          style={{
            ...ICON_BTN, textDecoration: 'none',
            opacity: row.url ? 1 : 0.35,
            pointerEvents: row.url ? 'auto' : 'none',
          }}
        >
          <ExternalLinkIcon />
        </a>
      </td>

      {/* Add row below */}
      <td style={{ ...TD, width: 36, textAlign: 'center' }}>
        <button style={ICON_BTN} onClick={() => onAddAfter(row)} title="Add row below">
          <PlusIcon />
        </button>
      </td>

      {/* Delete */}
      <td style={{ ...TD, width: 36, textAlign: 'center' }}>
        <button
          style={{ ...ICON_BTN, color: 'var(--text3)' }}
          onClick={() => onDelete(row.id)}
          title="Delete row"
        >
          <TrashIcon />
        </button>
      </td>

    </tr>
  )
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────

export default function CashFlowPage() {
  useEffect(() => { document.title = 'Cash Flow | ClientFlow' }, [])
  const [rows, setRows]               = useState([])
  const [loading, setLoading]         = useState(true)
  const [dayStart, setDayStart]       = useState('')
  const [dayEnd, setDayEnd]           = useState('')
  const [filterWho, setFilterWho]     = useState('')
  const [filterCat, setFilterCat]     = useState('')
  const [filterTag, setFilterTag]     = useState('')
  const [dragIdx, setDragIdx]         = useState(null)
  const [dragOverIdx, setDragOverIdx] = useState(null)
  const [showInactive, setShowInactive] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('cashflow_entries')
      .select('*')
      .order('day', { ascending: true })
      .order('amount', { ascending: false })
      .order('sort_order', { ascending: true })
    setRows(data || [])
    setLoading(false)
  }

  const displayRows = useMemo(() => rows.filter(row => {
    const ds = parseInt(dayStart, 10)
    const de = parseInt(dayEnd, 10)
    if (!isNaN(ds) && row.day < ds) return false
    if (!isNaN(de) && row.day > de) return false
    if (filterWho && !(row.who || '').toLowerCase().includes(filterWho.toLowerCase())) return false
    if (filterCat && row.category !== filterCat) return false
    if (filterTag && !(row.tag || '').toLowerCase().includes(filterTag.toLowerCase())) return false
    if (!showInactive && row.visible === false) return false
    return true
  }), [rows, dayStart, dayEnd, filterWho, filterCat, filterTag, showInactive])

  const { filteredIncome, filteredExpense, filteredBalance } = useMemo(() => {
    let filteredIncome = 0
    let filteredExpense = 0
    let filteredBalance = 0
    displayRows.forEach(row => {
      const amt = row.amount || 0
      if (amt > 0) filteredIncome += amt
      if (amt < 0) filteredExpense += Math.abs(amt)
      if (row.active) filteredBalance += amt
    })
    return { filteredIncome, filteredExpense, filteredBalance }
  }, [displayRows])

  const { rowContributions, rowBalances } = useMemo(() => {
    let running = 0
    const rowContributions = {}
    const rowBalances = {}
    displayRows.forEach(row => {
      const contribution = row.active ? (row.amount || 0) : 0
      running += contribution
      rowContributions[row.id] = contribution
      rowBalances[row.id] = running
    })
    return { rowContributions, rowBalances }
  }, [displayRows])

  async function saveField(id, updates) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r))
    await supabase.from('cashflow_entries').update(updates).eq('id', id)
  }

  async function toggleActive(row) {
    await saveField(row.id, { active: !row.active })
  }

  async function toggleVisible(row) {
    await saveField(row.id, { visible: row.visible === false ? true : false })
  }

  const allActive  = displayRows.length > 0 && displayRows.every(r => r.active)
  const allVisible = displayRows.length > 0 && displayRows.every(r => r.visible !== false)

  async function toggleAllActive() {
    const newVal = !allActive
    const ids = displayRows.map(r => r.id)
    setRows(prev => prev.map(r => ids.includes(r.id) ? { ...r, active: newVal } : r))
    await Promise.all(ids.map(id => supabase.from('cashflow_entries').update({ active: newVal }).eq('id', id)))
  }

  async function toggleAllVisible() {
    const newVal = !allVisible
    const ids = displayRows.map(r => r.id)
    setRows(prev => prev.map(r => ids.includes(r.id) ? { ...r, visible: newVal } : r))
    await Promise.all(ids.map(id => supabase.from('cashflow_entries').update({ visible: newVal }).eq('id', id)))
  }

  async function insertRow(fields, insertAfterRow = null) {
    const { data, error } = await supabase.from('cashflow_entries').insert({
      ...fields,
}).select().single()
    if (error) { console.error('[CashFlow] insert error:', error); return }
    if (data) {
      setRows(prev => {
        if (insertAfterRow) {
          const idx = prev.findIndex(r => r.id === insertAfterRow.id)
          const next = [...prev]
          next.splice(idx + 1, 0, data)
          return next
        }
        return [...prev, data]
      })
    } else {
      // RLS blocked the select-after-insert; reload to pick up the new row
      await load()
    }
  }

  function addRowAfter(afterRow) {
    return insertRow({
      day:        afterRow.day,
      who:        '',
      category:   'Expense',
      note:       '',
      amount:     0,
      active:     true,
      visible:    true,
      sort_order: (afterRow.sort_order || 0) + 1,
      tag:        null,
      url:        null,
    }, afterRow)
  }

  function addFirstRow() {
    return insertRow({
      day: 0, who: '', category: 'Bank', note: '', tag: null, amount: 0, active: true, visible: true, sort_order: 0, url: null,
    })
  }

  async function deleteRow(id) {
    if (!window.confirm('Delete this row?')) return
    await supabase.from('cashflow_entries').delete().eq('id', id)
    setRows(prev => prev.filter(r => r.id !== id))
  }

  function handleDragStart(e, idx) {
    e.dataTransfer.effectAllowed = 'move'
    setDragIdx(idx)
  }

  function handleDragOver(e, idx) {
    e.preventDefault()
    setDragOverIdx(idx)
  }

  async function handleDrop(toIdx) {
    if (dragIdx === null || dragIdx === toIdx) { setDragIdx(null); setDragOverIdx(null); return }
    const reordered = [...displayRows]
    const [moved] = reordered.splice(dragIdx, 1)
    reordered.splice(toIdx, 0, moved)
    const newOrders = reordered.map((row, i) => ({ id: row.id, sort_order: i * 10 }))
    const orderMap = Object.fromEntries(newOrders.map(({ id, sort_order }) => [id, sort_order]))
    setRows(prev => {
      const displayIds = new Set(reordered.map(r => r.id))
      const nonDisplayed = prev.filter(r => !displayIds.has(r.id))
      const reorderedUpdated = reordered.map(r => ({ ...r, sort_order: orderMap[r.id] }))
      return [...reorderedUpdated, ...nonDisplayed]
    })
    setDragIdx(null)
    setDragOverIdx(null)
    await Promise.all(
      newOrders.map(({ id, sort_order }) =>
        supabase.from('cashflow_entries').update({ sort_order }).eq('id', id)
      )
    )
  }

  async function sortByDay(dir) {
    const sorted = [...rows].sort((a, b) => {
      const diff = (a.day ?? 0) - (b.day ?? 0)
      return dir === 'asc' ? diff : -diff
    })
    const newOrders = sorted.map((row, i) => ({ id: row.id, sort_order: i * 10 }))
    const orderMap = Object.fromEntries(newOrders.map(({ id, sort_order }) => [id, sort_order]))
    setRows(sorted.map(r => ({ ...r, sort_order: orderMap[r.id] })))
    await Promise.all(
      newOrders.map(({ id, sort_order }) =>
        supabase.from('cashflow_entries').update({ sort_order }).eq('id', id)
      )
    )
  }

  const inputStyle = {
    fontSize: 13, padding: '4px 8px',
    border: '1px solid var(--border)', borderRadius: 5,
    background: 'var(--bg)', color: 'var(--text)',
  }

  return (
    <div className="fade-in">
      <div className="topbar">
        <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>Cashflow Planner</span>
        <div style={{ marginLeft: 'auto', display: 'flex', border: '1px solid var(--border2)', borderRadius: 6, overflow: 'hidden' }}>
          <button
            onClick={() => setShowInactive(true)}
            style={{ padding: '4px 12px', fontSize: 12, fontWeight: 600, border: 'none', borderRight: '1px solid var(--border2)', cursor: 'pointer', background: showInactive ? 'var(--bg3)' : 'transparent', color: showInactive ? 'var(--text)' : 'var(--text3)' }}
          >Show</button>
          <button
            onClick={() => setShowInactive(false)}
            style={{ padding: '4px 12px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: !showInactive ? 'var(--bg3)' : 'transparent', color: !showInactive ? 'var(--text)' : 'var(--text3)' }}
          >Hide</button>
        </div>
      </div>

      <div className="page-content">

        {/* ── filter bar ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <input
            type="number" min={0} max={31} placeholder="Start"
            value={dayStart} onChange={e => setDayStart(e.target.value)}
            style={{ ...inputStyle, width: 72 }}
          />
          <input
            type="number" min={0} max={31} placeholder="End"
            value={dayEnd} onChange={e => setDayEnd(e.target.value)}
            style={{ ...inputStyle, width: 72 }}
          />
          <input
            placeholder="Vendor"
            value={filterWho} onChange={e => setFilterWho(e.target.value)}
            style={{ ...inputStyle, width: 130 }}
          />
          <select
            value={filterCat} onChange={e => setFilterCat(e.target.value)}
            style={{ ...inputStyle, width: 130 }}
          >
            <option value="">Category</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input
            placeholder="Tag"
            value={filterTag} onChange={e => setFilterTag(e.target.value)}
            style={{ ...inputStyle, width: 130 }}
          />
        </div>

        {loading ? (
          <div style={{ color: 'var(--text3)', fontSize: 13 }}>Loading…</div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 170px)' }}>
            {/* shared colgroup — identical in all three tables to keep columns aligned */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowX: 'auto' }}>

              {/* ── pinned header ── */}
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 1070, flexShrink: 0 }}>
                <colgroup>
                  <col style={{ width: 28 }} /><col style={{ width: 52 }} /><col style={{ width: 110 }} />
                  <col style={{ width: 100 }} /><col style={{ width: 110 }} /><col /><col style={{ width: 100 }} /><col style={{ width: 100 }} />
                  <col style={{ width: 100 }} /><col style={{ width: 60 }} /><col style={{ width: 90 }} />
                  <col style={{ width: 90 }} /><col style={{ width: 36 }} /><col style={{ width: 36 }} />
                  <col style={{ width: 36 }} /><col style={{ width: 36 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={{ ...TH, width: 28 }}></th>
                    <th style={{ ...TH, width: 52 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        Day
                        <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 0, lineHeight: 1 }}>
                          <span
                            onClick={() => sortByDay('asc')}
                            title="Sort by day ascending"
                            style={{ cursor: 'pointer', fontSize: 8, color: 'var(--text3)', lineHeight: 1.2, display: 'block' }}
                          >▲</span>
                          <span
                            onClick={() => sortByDay('desc')}
                            title="Sort by day descending"
                            style={{ cursor: 'pointer', fontSize: 8, color: 'var(--text3)', lineHeight: 1.2, display: 'block' }}
                          >▼</span>
                        </span>
                      </span>
                    </th>
                    <th style={TH}>Who</th>
                    <th style={{ ...TH, width: 100 }}>Category</th>
                    <th style={{ ...TH, width: 110 }}>Tag</th>
                    <th style={TH}>Note</th>
                    <th style={TH}>Account</th>
                    <th style={{ ...TH, textAlign: 'right', width: 100 }}>Income</th>
                    <th style={{ ...TH, textAlign: 'right', width: 100 }}>Expense</th>
                    <th style={{ ...TH, width: 60, textAlign: 'center' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <button
                          onClick={toggleAllActive}
                          title={allActive ? 'Set all to inactive' : 'Set all to active'}
                          style={{ width: 11, height: 11, borderRadius: '50%', border: 'none', padding: 0, cursor: 'pointer', background: allActive ? '#64c97a' : '#ffb8b8', flexShrink: 0 }}
                        />
                        <button
                          onClick={toggleAllVisible}
                          title={allVisible ? 'Hide all filtered rows' : 'Show all filtered rows'}
                          style={{ width: 11, height: 11, borderRadius: '50%', border: 'none', padding: 0, cursor: 'pointer', background: allVisible ? '#6b7280' : '#d1d5db', flexShrink: 0 }}
                        />
                      </span>
                    </th>
                    <th style={{ ...TH, textAlign: 'right', width: 90 }}></th>
                    <th style={{ ...TH, textAlign: 'right', width: 90 }}></th>
                    <th style={{ ...TH, width: 36 }}></th>
                    <th style={{ ...TH, width: 36 }}></th>
                    <th style={{ ...TH, width: 36 }}></th>
                    <th style={{ ...TH, width: 36 }}></th>
                  </tr>
                </thead>
              </table>

              {/* ── scrollable body ── */}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 1070 }}>
                  <colgroup>
                    <col style={{ width: 28 }} /><col style={{ width: 52 }} /><col style={{ width: 110 }} />
                    <col style={{ width: 100 }} /><col style={{ width: 110 }} /><col /><col style={{ width: 100 }} /><col style={{ width: 100 }} />
                    <col style={{ width: 100 }} /><col style={{ width: 60 }} /><col style={{ width: 90 }} />
                    <col style={{ width: 90 }} /><col style={{ width: 36 }} /><col style={{ width: 36 }} />
                    <col style={{ width: 36 }} /><col style={{ width: 36 }} />
                  </colgroup>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={16} style={{ ...TD, textAlign: 'center', color: 'var(--text3)', padding: 32 }}>
                          No entries yet.{' '}
                          <button className="btn btn-ghost btn-sm" onClick={addFirstRow}>Add first row</button>
                        </td>
                      </tr>
                    ) : displayRows.map((row, idx) => (
                      <CashFlowRow
                        key={row.id}
                        row={row}
                        contribution={rowContributions[row.id] ?? 0}
                        balance={rowBalances[row.id] ?? 0}
                        onSave={saveField}
                        onToggleActive={toggleActive}
                        onToggleVisible={toggleVisible}
                        onAddAfter={addRowAfter}
                        onDelete={deleteRow}
                        isDragging={dragIdx === idx}
                        isDragTarget={dragOverIdx === idx && dragIdx !== null && dragIdx !== idx}
                        onDragStart={e => handleDragStart(e, idx)}
                        onDragOver={e => handleDragOver(e, idx)}
                        onDrop={() => handleDrop(idx)}
                        onDragEnd={() => { setDragIdx(null); setDragOverIdx(null) }}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ── pinned footer ── */}
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 1070, flexShrink: 0, borderTop: '2px solid var(--border2)' }}>
                <colgroup>
                  <col style={{ width: 28 }} /><col style={{ width: 52 }} /><col style={{ width: 110 }} />
                  <col style={{ width: 100 }} /><col style={{ width: 110 }} /><col /><col style={{ width: 100 }} /><col style={{ width: 100 }} />
                  <col style={{ width: 100 }} /><col style={{ width: 60 }} /><col style={{ width: 90 }} />
                  <col style={{ width: 90 }} /><col style={{ width: 36 }} /><col style={{ width: 36 }} />
                  <col style={{ width: 36 }} /><col style={{ width: 36 }} />
                </colgroup>
                <tbody>
                  <tr style={{ background: 'var(--bg3)' }}>
                    <td style={TD} />
                    <td colSpan={5} style={{ ...TD, textAlign: 'right', fontWeight: 700, fontSize: 13, color: 'var(--text2)' }}>Total</td>
                    <td style={TD} />
                    <td style={{ ...TD, textAlign: 'right', fontFamily: 'DM Mono, monospace', fontWeight: 700, fontSize: 13 }}>{fmt$(filteredIncome)}</td>
                    <td style={{ ...TD, textAlign: 'right', fontFamily: 'DM Mono, monospace', fontWeight: 700, fontSize: 13 }}>{fmt$(filteredExpense)}</td>
                    <td style={TD} />
                    <td style={{ ...TD, textAlign: 'right', fontWeight: 700, fontSize: 13, color: 'var(--text2)' }}>Balance</td>
                    <td style={{
                      ...TD, textAlign: 'right', fontFamily: 'DM Mono, monospace', fontWeight: 700, fontSize: 13,
                      color: filteredBalance < 0 ? '#ef4444' : 'var(--text)',
                    }}>
                      {fmt$(filteredBalance)}
                    </td>
                    <td colSpan={4} style={TD} />
                  </tr>
                </tbody>
              </table>

            </div>
          </div>
        )}
      </div>
    </div>
  )
}
