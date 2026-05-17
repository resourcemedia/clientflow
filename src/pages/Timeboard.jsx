import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

const isDemo = !import.meta.env.VITE_SUPABASE_URL

const CATEGORY_COLORS = {
  primary:    '#ffb8b8',
  secondary:  '#4fd1b8',
  accounting: '#63ca7a',
  overhead:   '#b9dd67',
  charity:    '#c6c7fe',
  personal:   '#ebb8e5',
}

// 288 five-minute time slots 00:00–23:55
const TIME_SLOTS = Array.from({ length: 288 }, (_, i) => {
  const h = Math.floor(i / 12)
  const m = (i % 12) * 5
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayISO() { return new Date().toISOString().slice(0, 10) }

function calcHoursFromTimes(start, end) {
  if (!start || !end) return 0
  const toMins = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
  return Math.max(0, (toMins(end) - toMins(start)) / 60)
}

// Format for expanded view: no zero-pad on minutes ("9:5 am")
function fmtSlotTime(slot) {
  const [h, m] = slot.split(':').map(Number)
  const ampm = h < 12 ? 'am' : 'pm'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${m} ${ampm}`
}

// Format for collapsed view: zero-pad minutes ("9:00 am")
function fmtTime(timeStr) {
  if (!timeStr) return '—'
  const [h, m] = timeStr.split(':').map(Number)
  if (h === 24) return '12:00 am'
  const ampm = h < 12 ? 'am' : 'pm'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

function fmtDate(isoDate) {
  if (!isoDate) return ''
  const [, mm, dd] = isoDate.split('-')
  return `${parseInt(mm, 10)}/${parseInt(dd, 10)}`
}

function darken(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgb(${Math.round(r * 0.42)},${Math.round(g * 0.42)},${Math.round(b * 0.42)})`
}

function projectLabel(entry) {
  const alias = (entry.project?.client?.alias || '').slice(0, 4).toLowerCase()
  const jn = entry.project?.project_number || ''
  return alias ? `${alias} | ${jn}` : jn
}

function fmt$(n) {
  return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtHours(n) {
  return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Enrich entries with computed outTime, hours, billableAmt, invoiceAmt
// outTime = start_time of next entry; for past dates, last entry uses "24:00".
// For today's last entry (the "active" entry), outTime = null → hours = 0 so
// it contributes nothing to summary tiles until a subsequent entry closes it.
function enrichEntries(entries) {
  const today = todayISO()
  const byDate = {}
  entries.forEach(e => { if (!byDate[e.date]) byDate[e.date] = []; byDate[e.date].push(e) })
  const result = []
  Object.values(byDate).forEach(day => {
    const sorted = [...day].sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
    sorted.forEach((entry, i) => {
      const isLast   = i === sorted.length - 1
      const isActive = isLast && entry.date === today
      const outTime  = isActive ? null : (sorted[i + 1]?.start_time || '24:00')
      const hours    = calcHoursFromTimes(entry.start_time, outTime)
      const isPrimary   = entry.project?.category === 'primary'
      const isBillable  = entry.is_billable === true || (entry.is_billable === null && isPrimary)
      const billableAmt = isBillable ? hours * (entry.hourly_rate || 0) : 0
      const invoiceAmt  = (isBillable && !entry.invoice_number) ? hours * (entry.hourly_rate || 0) : 0
      if (result.length === 0) console.log('[DEBUG enrichEntries] first entry:', { id: entry.id, is_billable: entry.is_billable, is_billable_type: typeof entry.is_billable, hourly_rate: entry.hourly_rate, hours, billableAmt, invoiceAmt, isActive })
      result.push({ ...entry, outTime, hours, billableAmt, invoiceAmt, isActive })
    })
  })
  return result
}

// ── Summary Tiles ──────────────────────────────────────────────────────────────

function Tile({ label, value, color }) {
  const text = darken(color)
  return (
    <div style={{ background: color, borderRadius: 8, padding: '8px 14px', minWidth: 90, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: text }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.1, color: text, fontFamily: 'DM Mono, monospace' }}>{value}</div>
    </div>
  )
}

function SummaryTiles({ entries }) {
  console.log('[DEBUG SummaryTiles] entry count:', entries.length, '| sample:', entries[0] ? { id: entries[0].id, hours: entries[0].hours, hourly_rate: entries[0].hourly_rate, is_billable: entries[0].is_billable, billableAmt: entries[0].billableAmt, invoiceAmt: entries[0].invoiceAmt } : 'none')
  const by = cat => entries.filter(e => e.project?.category === cat)

  const primaryHours  = by('primary').reduce((s, e) => s + (e.hours || 0), 0)
  const billableAmt   = entries.reduce((s, e) => s + (e.billableAmt || 0), 0)
  const toInvoiceAmt  = entries.reduce((s, e) => s + (e.invoiceAmt  || 0), 0)
  const totalHours    = entries.reduce((s, e) => s + (e.hours || 0), 0)

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
      <Tile label="Primary"    value={fmtHours(primaryHours)}                       color={CATEGORY_COLORS.primary}    />
      <Tile label="Billable"   value={fmtHours(billableAmt)}                        color={CATEGORY_COLORS.primary}    />
      <Tile label="To Invoice" value={fmtHours(toInvoiceAmt)}                       color={CATEGORY_COLORS.primary}    />
      <Tile label="Secondary"  value={fmtHours(by('secondary').reduce((s,e)=>s+(e.hours||0),0))}  color={CATEGORY_COLORS.secondary}  />
      <Tile label="Accounting" value={fmtHours(by('accounting').reduce((s,e)=>s+(e.hours||0),0))} color={CATEGORY_COLORS.accounting} />
      <Tile label="Overhead"   value={fmtHours(by('overhead').reduce((s,e)=>s+(e.hours||0),0))}   color={CATEGORY_COLORS.overhead}   />
      <Tile label="Charity"    value={fmtHours(by('charity').reduce((s,e)=>s+(e.hours||0),0))}    color={CATEGORY_COLORS.charity}    />
      <Tile label="Personal"   value={fmtHours(by('personal').reduce((s,e)=>s+(e.hours||0),0))}   color={CATEGORY_COLORS.personal}   />
      <Tile label="Total"      value={fmtHours(totalHours)}                         color="#d1d5db"                    />
    </div>
  )
}

// ── Shared Input Components ────────────────────────────────────────────────────

// Project search autocomplete
function ProjectInput({ existingEntry, projects, onSelect, onCancel, onClear }) {
  const [text, setText] = useState(existingEntry ? projectLabel(existingEntry) : '')
  const [matches, setMatches] = useState([])
  const [dropdownPos, setDropdownPos] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  function sortProjects(list) {
    return [...list].sort((a, b) => {
      const clientCompare = (a.client?.alias || '').localeCompare(b.client?.alias || '')
      if (clientCompare !== 0) return clientCompare
      const jobA = parseInt(a.project_number, 10) || 0
      const jobB = parseInt(b.project_number, 10) || 0
      if (jobA !== jobB) return jobA - jobB
      return (a.name || '').localeCompare(b.name || '')
    })
  }

  function filterProjects(q) {
    if (!q) return sortProjects(projects).slice(0, 20)
    return sortProjects(projects.filter(p =>
      (p.client?.alias    || '').toLowerCase().includes(q) ||
      (p.project_number   || '').toLowerCase().includes(q) ||
      (p.name             || '').toLowerCase().includes(q)
    )).slice(0, 12)
  }

  function measure() {
    const rect = inputRef.current?.getBoundingClientRect()
    if (rect && (rect.width > 0 || rect.height > 0)) {
      setDropdownPos({ top: rect.bottom + 2, left: rect.left })
    }
  }

  function handleChange(e) {
    const v = e.target.value
    setText(v)
    measure()
    setMatches(filterProjects(v.toLowerCase()))
  }

  function handleFocus() {
    measure()
    setMatches(filterProjects(''))
  }

  const showDropdown = (existingEntry || matches.length > 0) && dropdownPos

  return (
    <>
      <input ref={inputRef} value={text} onChange={handleChange}
        onFocus={handleFocus}
        onKeyDown={e => { if (e.key === 'Escape') onCancel() }}
        onBlur={() => { if (text.trim() === '' && existingEntry) onClear?.(); else onCancel() }}
        style={{ width: 130, fontSize: 12, fontFamily: 'DM Mono, monospace', background: 'rgba(255,255,255,0.88)', border: '1px solid var(--accent)', borderRadius: 5, padding: '2px 6px', outline: 'none' }}
      />
      {showDropdown && (
        <div style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, zIndex: 9999, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, boxShadow: '0 4px 18px rgba(0,0,0,0.18)', minWidth: 280, maxHeight: 240, overflowY: 'auto' }}>
          {existingEntry && (
            <div
              onMouseDown={e => e.preventDefault()}
              onClick={onClear}
              style={{ padding: '6px 10px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--border)', fontStyle: 'italic', color: 'var(--text3)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              None
            </div>
          )}
          {matches.map(p => {
            const alias = (p.client?.alias || '').slice(0, 4).toLowerCase()
            const label = [alias, p.project_number, p.name].filter(Boolean).join(' | ')
            return (
              <div key={p.id}
                onMouseDown={e => e.preventDefault()}
                onClick={() => onSelect(p)}
                style={{ padding: '6px 10px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--border)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: CATEGORY_COLORS[p.category] || '#ccc', flexShrink: 0 }} />
                <span style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

// Description field that saves on blur / Enter
function DescInput({ entry, onSave }) {
  const [val, setVal] = useState(entry.description || '')
  useEffect(() => { setVal(entry.description || '') }, [entry.id])
  return (
    <input value={val} onChange={e => setVal(e.target.value)}
      onBlur={() => { if (val.trim() !== (entry.description || '').trim()) onSave(val.trim()) }}
      onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
      placeholder="Description…"
      style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text)', padding: '2px 4px' }}
    />
  )
}

// Generic inline editable field
function InlineInput({ value, onSave, placeholder, width, align }) {
  const [val, setVal] = useState(value || '')
  useEffect(() => { setVal(value || '') }, [value])
  return (
    <input value={val} onChange={e => setVal(e.target.value)}
      onBlur={() => { if (val.trim() !== (value || '')) onSave(val.trim()) }}
      onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
      placeholder={placeholder || '—'}
      style={{ width: width || 70, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 5px', fontSize: 12, textAlign: align || 'left', outline: 'none' }}
    />
  )
}

function RateCell({ rate, onSave }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal]         = useState('')
  const valRef = useRef('')

  function start() {
    const s = rate != null ? String(rate) : ''
    setVal(s); valRef.current = s; setEditing(true)
  }

  function commit() {
    setEditing(false)
    const num = parseFloat(valRef.current)
    const newRate = isNaN(num) ? 0 : num
    if (newRate !== (rate ?? 0)) onSave(newRate)
  }

  if (editing) {
    return (
      <input autoFocus type="number" min="0" step="1" value={val}
        onChange={e => { setVal(e.target.value); valRef.current = e.target.value }}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditing(false) }}
        style={{ width: 60, textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: 12, border: '1px solid var(--accent)', borderRadius: 4, padding: '2px 5px', outline: 'none', background: 'rgba(255,255,255,0.88)' }}
      />
    )
  }

  return (
    <span onClick={start} style={{ cursor: 'text', fontFamily: 'DM Mono, monospace', fontSize: 12, color: rate ? 'var(--text2)' : 'var(--text3)' }}>
      {rate != null ? rate : '—'}
    </span>
  )
}

// Two-dot billable toggle
function BillableToggle({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'center' }}>
      <button onClick={() => onChange(value === false ? null : false)} title="Not Billable"
        style={{ width: 13, height: 13, borderRadius: '50%', border: 'none', padding: 0, cursor: 'pointer', background: value === false ? '#f87171' : '#cccccc' }}
      />
      <button onClick={() => onChange(value === true ? null : true)} title="Billable"
        style={{ width: 13, height: 13, borderRadius: '50%', border: 'none', padding: 0, cursor: 'pointer', background: value === true ? '#4ade80' : '#cccccc' }}
      />
    </div>
  )
}

// ── Expanded View ──────────────────────────────────────────────────────────────

const EXP_ROW = { borderBottom: '1px solid rgba(0,0,0,0.07)', verticalAlign: 'middle' }
const EXP_PAD = { padding: '1px 8px' }

function ExpandedView({ entries, projects, expandedDate, onEntryChange, onEntryDelete, user }) {
  const [editingSlot, setEditingSlot] = useState(null)
  const scrollRef = useRef(null)

  const dayEntries = useMemo(() => entries.filter(e => e.date === expandedDate), [entries, expandedDate])

  const entryMap = useMemo(() => {
    const m = new Map()
    dayEntries.forEach(e => { if (e.start_time) m.set(e.start_time.slice(0, 5), e) })
    return m
  }, [dayEntries])

  // Filter out any entries with missing start_time before sorting —
  // a null start_time produces "" which compares <= every slot time and
  // would incorrectly paint the entire day with that entry's color.
  const sortedEntries = useMemo(
    () => [...dayEntries]
      .filter(e => e.start_time)
      .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [dayEntries]
  )

  // The active entry is today's last entry — it only colors its own single slot.
  const activeEntrySlot = useMemo(() => {
    if (expandedDate !== todayISO() || sortedEntries.length === 0) return null
    return sortedEntries[sortedEntries.length - 1].start_time?.slice(0, 5) || null
  }, [sortedEntries, expandedDate])

  const activePerSlot = useMemo(() => {
    const result = new Array(288).fill(null)
    if (sortedEntries.length === 0) return result
    let ei = 0
    for (let i = 0; i < 288; i++) {
      while (
        ei < sortedEntries.length &&
        (sortedEntries[ei].start_time || '').slice(0, 5) <= TIME_SLOTS[i]
      ) ei++
      const candidate = ei > 0 ? sortedEntries[ei - 1] : null
      // Active entry only paints its own row; all slots after it stay white.
      if (candidate && activeEntrySlot && candidate.start_time?.slice(0, 5) === activeEntrySlot && TIME_SLOTS[i] !== activeEntrySlot) {
        result[i] = null
      } else {
        result[i] = candidate
      }
    }
    return result
  }, [sortedEntries, activeEntrySlot])

  const firstEmptySlot = useMemo(() => {
    if (sortedEntries.length === 0) {
      if (expandedDate === todayISO()) {
        const now = new Date()
        const h = now.getHours(), m = Math.floor(now.getMinutes() / 5) * 5
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      }
      return '09:00'
    }
    const lastTime = sortedEntries[sortedEntries.length - 1].start_time
    const lastSlot = (lastTime || '').slice(0, 5)
    const idx = TIME_SLOTS.indexOf(lastSlot)
    return idx >= 0 && idx < 287 ? TIME_SLOTS[idx + 1] : null
  }, [sortedEntries, expandedDate])

  useEffect(() => {
    if (!scrollRef.current) return
    let target
    if (expandedDate === todayISO()) {
      const now = new Date()
      target = `${String(now.getHours()).padStart(2, '0')}:${String(Math.floor(now.getMinutes() / 5) * 5).padStart(2, '0')}`
    } else {
      target = sortedEntries[0]?.start_time.slice(0, 5) || '09:00'
    }
    scrollRef.current.querySelector(`[data-slot="${target}"]`)?.scrollIntoView({ block: 'center', behavior: 'instant' })
  }, [expandedDate]) // eslint-disable-line react-hooks/exhaustive-deps

  async function selectProject(project) {
    if (!editingSlot) return
    const slot = editingSlot
    const existing = entryMap.get(slot)
    const sel = '*, project:projects(id, name, project_number, category, client:clients(id, company, alias))'
    let saved
    if (existing) {
      const { data } = await supabase.from('time_entries')
        .update({ project_id: project.id, hourly_rate: project.client?.hourly_rate || 0 })
        .eq('id', existing.id).select(sel).single()
      saved = data
    } else {
      const { data } = await supabase.from('time_entries')
        .insert({ date: expandedDate, start_time: slot + ':00', project_id: project.id, hourly_rate: project.client?.hourly_rate || 0, user_id: user?.id })
        .select(sel).single()
      saved = data
    }
    if (saved) onEntryChange(saved)
    setEditingSlot(null)
  }

  async function deleteEntry(slot) {
    const existing = entryMap.get(slot)
    if (!existing) { setEditingSlot(null); return }
    await supabase.from('time_entries').delete().eq('id', existing.id)
    onEntryDelete(existing.id)
    setEditingSlot(null)
  }

  async function saveDescription(slotTime, desc) {
    const existing = entryMap.get(slotTime)
    if (!existing) return
    await supabase.from('time_entries').update({ description: desc }).eq('id', existing.id)
    onEntryChange({ ...existing, description: desc })
  }

  const dateLabel = fmtDate(expandedDate)

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div ref={scrollRef} style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 300px)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 48 }} /><col style={{ width: 78 }} />
            <col style={{ width: 150 }} /><col />
          </colgroup>
          <tbody>
            {TIME_SLOTS.map((slot, i) => {
              const active    = activePerSlot[i]
              const thisEntry = entryMap.get(slot)
              const bg        = active ? (CATEGORY_COLORS[active.project?.category] || undefined) : undefined
              const isEditing = editingSlot === slot
              const isFirst   = slot === firstEmptySlot
              return (
                <tr key={slot} data-slot={slot} style={{ ...EXP_ROW, background: bg }}>
                  <td style={{ ...EXP_PAD, color: 'var(--text3)', fontSize: 11, whiteSpace: 'nowrap' }}>{dateLabel}</td>
                  <td style={{ ...EXP_PAD, color: 'var(--text2)', fontSize: 12, fontFamily: 'DM Mono, monospace', whiteSpace: 'nowrap' }}>{fmtSlotTime(slot)}</td>
                  <td style={{ padding: '2px 6px' }}>
                    {isEditing ? (
                      <ProjectInput existingEntry={thisEntry} projects={projects} onSelect={selectProject} onCancel={() => setEditingSlot(null)} onClear={() => deleteEntry(slot)} />
                    ) : thisEntry ? (
                      <span onClick={() => setEditingSlot(slot)} title="Click to change project"
                        style={{ display: 'inline-block', padding: '1px 7px', border: '1px solid rgba(0,0,0,0.18)', borderRadius: 5, fontSize: 12, fontFamily: 'DM Mono, monospace', background: 'rgba(255,255,255,0.52)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        {projectLabel(thisEntry)}
                      </span>
                    ) : isFirst ? (
                      <input readOnly onFocus={() => setEditingSlot(slot)} placeholder="project #…"
                        style={{ width: 100, fontSize: 12, background: 'transparent', border: '1px dashed var(--border2)', borderRadius: 5, padding: '1px 6px', color: 'var(--text3)', cursor: 'text' }}
                      />
                    ) : (
                      <div style={{ minHeight: 22, cursor: 'text' }} onClick={() => setEditingSlot(slot)} />
                    )}
                  </td>
                  <td style={{ ...EXP_PAD }}>
                    {thisEntry && <DescInput key={thisEntry.id} entry={thisEntry} onSave={desc => saveDescription(slot, desc)} />}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Invoice Breakdown print window ─────────────────────────────────────────────

function openInvoiceBreakdown(rows, invoiceFilter) {
  const target = invoiceFilter
    ? rows.filter(r => r.invoice_number === invoiceFilter)
    : rows.filter(r => r.invoice_number)

  const w = window.open('', '_blank', 'width=960,height=700')
  if (!w) return
  const totalHours = target.reduce((s, r) => s + r.hours, 0)
  const totalAmt   = target.reduce((s, r) => s + r.billableAmt, 0)
  const title = invoiceFilter ? `Invoice Breakdown — Invoice #${invoiceFilter}` : 'Invoice Breakdown'

  const dates = target.map(r => r.date).filter(Boolean).sort()
  const dateRange = dates.length === 0 ? ''
    : dates[0] === dates[dates.length - 1]
      ? fmtDate(dates[0])
      : `${fmtDate(dates[0])} – ${fmtDate(dates[dates.length - 1])}`

  w.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
<style>
  body{font-family:Arial,sans-serif;font-size:13px;padding:32px;color:#222}
  h1{font-size:18px;margin-bottom:4px}p{color:#666;margin:4px 0 12px}
  button{margin-bottom:16px;padding:6px 14px;cursor:pointer}
  table{width:100%;border-collapse:collapse}
  th{text-align:left;border-bottom:2px solid #333;padding:6px 8px;font-size:11px;text-transform:uppercase;letter-spacing:.05em}
  td{border-bottom:1px solid #eee;padding:6px 8px}
  .mono{font-family:monospace}.right{text-align:right}
  tfoot td{font-weight:700;border-top:2px solid #333;border-bottom:none}
  @media print{button{display:none}}
</style></head><body>
<h1>${title}</h1>${dateRange ? `<p>${dateRange}</p>` : ''}
<button onclick="window.print()">Print / Save PDF</button>
<table>
  <thead><tr>
    <th>Date</th><th>Project</th><th>Description</th>
    <th class="right">Hours</th><th class="right">Rate</th><th class="right">Amount</th>
  </tr></thead>
  <tbody>
    ${target.map(r => `<tr>
      <td>${fmtDate(r.date)}</td>
      <td class="mono">${projectLabel(r)}</td>
      <td>${r.description || ''}</td>
      <td class="mono right">${r.hours.toFixed(2)}</td>
      <td class="mono right">${fmt$(r.hourly_rate || 0)}</td>
      <td class="mono right">${fmt$(r.billableAmt)}</td>
    </tr>`).join('')}
  </tbody>
  <tfoot><tr>
    <td colspan="3">Total</td>
    <td class="mono right">${totalHours.toFixed(2)}</td>
    <td></td>
    <td class="mono right">${fmt$(totalAmt)}</td>
  </tr></tfoot>
</table></body></html>`)
  w.document.close()
}

// ── Collapsed View ─────────────────────────────────────────────────────────────

const TH = { padding: '8px 10px', fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '2px solid var(--border2)', whiteSpace: 'nowrap', textAlign: 'left' }
const TD = { padding: '7px 10px', fontSize: 13, verticalAlign: 'middle', borderBottom: '1px solid var(--border)' }

function CollapsedView({ rows, projects, onEntryChange, user, filterInvoice, onOpenBreakdown }) {
  const [addRow, setAddRow]       = useState({ date: todayISO(), inTime: '', description: '' })
  const [addProject, setAddProject]         = useState(null)
  const [editAddProject, setEditAddProject] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [selectedRows, setSelectedRows] = useState(new Set())
  const [applyInvoiceDate,   setApplyInvoiceDate]   = useState('')
  const [applyInvoiceWeek,   setApplyInvoiceWeek]   = useState('')
  const [applyInvoiceNumber, setApplyInvoiceNumber] = useState('')
  const [applyError, setApplyError] = useState('')

  const allSelected = rows.length > 0 && rows.every(r => selectedRows.has(r.id))
  function toggleSelectAll() {
    setSelectedRows(allSelected ? new Set() : new Set(rows.map(r => r.id)))
  }
  function toggleRow(id) {
    setSelectedRows(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleApply() {
    const updateObj = {}
    if (applyInvoiceDate)   updateObj.invoice_date   = applyInvoiceDate
    if (applyInvoiceWeek)   updateObj.invoice_week   = parseInt(applyInvoiceWeek, 10) || null
    if (applyInvoiceNumber) updateObj.invoice_number = applyInvoiceNumber
    if (Object.keys(updateObj).length === 0) return
    setApplyError('')
    const ids = [...selectedRows]
    const { error } = await supabase.from('time_entries').update(updateObj).in('id', ids)
    if (error) {
      console.error('Apply invoice info error:', error)
      setApplyError('Failed to save. Please try again.')
      return
    }
    rows.filter(r => ids.includes(r.id)).forEach(r => onEntryChange({ ...r, ...updateObj }))
    setSelectedRows(new Set())
    setApplyInvoiceDate('')
    setApplyInvoiceWeek('')
    setApplyInvoiceNumber('')
  }

  async function toggleBillable(entry, val) {
    await supabase.from('time_entries').update({ is_billable: val }).eq('id', entry.id)
    onEntryChange({ ...entry, is_billable: val })
  }

  async function saveInvoiceNumber(entry, invoiceNo) {
    const val = invoiceNo || null
    await supabase.from('time_entries').update({ invoice_number: val }).eq('id', entry.id)
    onEntryChange({ ...entry, invoice_number: val })
  }

  async function saveInvoiceDate(entry, val) {
    const v = val || null
    await supabase.from('time_entries').update({ invoice_date: v }).eq('id', entry.id)
    onEntryChange({ ...entry, invoice_date: v })
  }

  async function saveInvoiceWeek(entry, val) {
    const v = val ? (parseInt(val, 10) || null) : null
    await supabase.from('time_entries').update({ invoice_week: v }).eq('id', entry.id)
    onEntryChange({ ...entry, invoice_week: v })
  }

  async function saveDescription(entry, desc) {
    await supabase.from('time_entries').update({ description: desc || null }).eq('id', entry.id)
    onEntryChange({ ...entry, description: desc || null })
  }

  async function saveRate(entry, rate) {
    await supabase.from('time_entries').update({ hourly_rate: rate }).eq('id', entry.id)
    onEntryChange({ ...entry, hourly_rate: rate })
  }

  async function handleAddSave() {
    if (!addRow.date || !addRow.inTime || !addProject) return
    setSaving(true)
    const { data } = await supabase.from('time_entries')
      .insert({
        date:        addRow.date,
        start_time:  addRow.inTime + ':00',
        project_id:  addProject.id,
        hourly_rate: addProject.client?.hourly_rate || 0,
        description: addRow.description || null,
        user_id:     user?.id,
      })
      .select('*, project:projects(id, name, project_number, category, client:clients(id, company, alias))')
      .single()
    if (data) onEntryChange(data)
    setAddRow({ date: todayISO(), inTime: '', description: '' })
    setAddProject(null)
    setSaving(false)
  }

  const totalHours   = rows.reduce((s, r) => s + r.hours, 0)
  const totalBillable = rows.reduce((s, r) => s + r.billableAmt, 0)
  const totalInvoice  = rows.reduce((s, r) => s + r.invoiceAmt, 0)

  const timePillStyle = {
    display: 'inline-block', padding: '2px 7px',
    border: '1px solid var(--border)', borderRadius: 4,
    fontSize: 12, fontFamily: 'DM Mono, monospace',
    background: 'var(--bg3)', whiteSpace: 'nowrap',
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {selectedRows.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, padding: '8px 12px', borderBottom: '1px solid var(--border)', background: 'var(--accent-glow)' }}>
          <input
            type="date"
            value={applyInvoiceDate}
            onChange={e => setApplyInvoiceDate(e.target.value)}
            style={{ width: 130, fontSize: 12 }}
          />
          <input
            type="number"
            value={applyInvoiceWeek}
            onChange={e => setApplyInvoiceWeek(e.target.value)}
            placeholder="Week"
            style={{ width: 70, fontSize: 12 }}
          />
          <input
            type="text"
            value={applyInvoiceNumber}
            onChange={e => setApplyInvoiceNumber(e.target.value)}
            placeholder="Invoice No."
            style={{ width: 110, fontSize: 12 }}
          />
          <button className="btn btn-primary btn-sm" onClick={handleApply}>Apply</button>
          {applyError && <span style={{ fontSize: 12, color: '#f87171', marginLeft: 4 }}>{applyError}</span>}
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
          <thead>
            <tr>
              <th style={{ ...TH, width: 32, textAlign: 'center' }}>
                <button onClick={toggleSelectAll} title={allSelected ? 'Deselect all' : 'Select all'}
                  style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--text3)', padding: 0, cursor: 'pointer', background: allSelected ? 'var(--text)' : 'transparent', display: 'inline-block', verticalAlign: 'middle' }}
                />
              </th>
              <th style={{ ...TH, width: 48 }}>Date</th>
              <th style={{ ...TH, width: 90 }}>In</th>
              <th style={{ ...TH, width: 90 }}>Out</th>
              <th style={{ ...TH, width: 130 }}>Project</th>
              <th style={TH}>Description</th>
              <th style={{ ...TH, textAlign: 'right', width: 65 }}>Hours</th>
              <th style={{ ...TH, width: 50, textAlign: 'center' }}></th>
              <th style={{ ...TH, textAlign: 'right', width: 65 }}>Rate</th>
              <th style={{ ...TH, textAlign: 'right', width: 80 }}>Billable</th>
              <th style={{ ...TH, textAlign: 'right', width: 80 }}>Invoice</th>
              <th style={{ ...TH, width: 90, textAlign: 'center' }}>Date</th>
              <th style={{ ...TH, width: 60, textAlign: 'center' }}>Week</th>
              <th style={{ ...TH, width: 90 }}>Invoice No.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const rowStyle = { ...TD }
              const cat = row.project?.category
              const catColor = CATEGORY_COLORS[cat] || '#eee'
              return (
                <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ ...rowStyle, textAlign: 'center' }}>
                    <button onClick={() => toggleRow(row.id)} title={selectedRows.has(row.id) ? 'Deselect' : 'Select'}
                      style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--text3)', padding: 0, cursor: 'pointer', background: selectedRows.has(row.id) ? 'var(--text)' : 'transparent', display: 'inline-block', verticalAlign: 'middle' }}
                    />
                  </td>
                  <td style={rowStyle}><span style={{ fontSize: 12, color: 'var(--text3)' }}>{fmtDate(row.date)}</span></td>
                  <td style={rowStyle}><span style={timePillStyle}>{fmtTime(row.start_time)}</span></td>
                  <td style={rowStyle}>{row.outTime ? <span style={timePillStyle}>{fmtTime(row.outTime)}</span> : <span style={{ color: 'var(--text3)', fontSize: 12 }}>—</span>}</td>
                  <td style={rowStyle}>
                    <span style={{ display: 'inline-block', padding: '2px 8px', background: catColor, borderRadius: 4, fontSize: 12, fontFamily: 'DM Mono, monospace', color: darken(catColor), whiteSpace: 'nowrap' }}>
                      {projectLabel(row)}
                    </span>
                  </td>
                  <td style={rowStyle}>
                    <InlineInput
                      value={row.description || ''}
                      onSave={v => saveDescription(row, v)}
                      placeholder="Description…"
                      width="100%"
                    />
                  </td>
                  <td style={{ ...rowStyle, textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
                    {row.hours > 0 ? fmtHours(row.hours) : '—'}
                  </td>
                  <td style={{ ...rowStyle, textAlign: 'center' }}>
                    <BillableToggle value={row.is_billable} onChange={val => toggleBillable(row, val)} />
                  </td>
                  <td style={{ ...rowStyle, textAlign: 'right' }}>
                    <RateCell rate={row.hourly_rate} onSave={rate => saveRate(row, rate)} />
                  </td>
                  <td style={{ ...rowStyle, textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
                    {row.billableAmt > 0 ? fmt$(row.billableAmt) : '—'}
                  </td>
                  <td style={{ ...rowStyle, textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
                    {row.invoiceAmt > 0 ? fmt$(row.invoiceAmt) : '—'}
                  </td>
                  <td style={{ ...rowStyle, textAlign: 'center' }}>
                    <InlineInput
                      value={row.invoice_date || ''}
                      onSave={v => saveInvoiceDate(row, v)}
                      placeholder="—"
                      width={84}
                      align="center"
                    />
                  </td>
                  <td style={{ ...rowStyle, textAlign: 'center' }}>
                    <InlineInput
                      value={row.invoice_week != null ? String(row.invoice_week) : ''}
                      onSave={v => saveInvoiceWeek(row, v)}
                      placeholder="—"
                      width={44}
                      align="center"
                    />
                  </td>
                  <td style={rowStyle}>
                    <InlineInput
                      value={row.invoice_number || ''}
                      onSave={v => saveInvoiceNumber(row, v)}
                      placeholder="—"
                      width={72}
                      align="center"
                    />
                  </td>
                </tr>
              )
            })}

            {/* Add row */}
            <tr style={{ background: 'var(--accent-glow)', borderBottom: '1px solid var(--border)' }}>
              <td style={TD} />
              <td style={TD}>
                <input type="date" value={addRow.date}
                  onChange={e => setAddRow(r => ({ ...r, date: e.target.value }))}
                  style={{ width: 120, fontSize: 12 }}
                />
              </td>
              <td style={TD}>
                <input type="time" value={addRow.inTime}
                  onChange={e => setAddRow(r => ({ ...r, inTime: e.target.value }))}
                  style={{ width: 100, fontSize: 12, fontFamily: 'DM Mono, monospace' }}
                />
              </td>
              <td style={{ ...TD, color: 'var(--text3)', fontSize: 12 }}>auto</td>
              <td style={TD}>
                {editAddProject ? (
                  <ProjectInput
                    existingEntry={null}
                    projects={projects}
                    onSelect={p => { setAddProject(p); setEditAddProject(false) }}
                    onCancel={() => setEditAddProject(false)}
                  />
                ) : addProject ? (
                  <span
                    onClick={() => setEditAddProject(true)}
                    style={{ display: 'inline-block', padding: '2px 8px', background: CATEGORY_COLORS[addProject.category] || '#eee', borderRadius: 4, fontSize: 12, fontFamily: 'DM Mono, monospace', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    {addProject.project_number}
                  </span>
                ) : (
                  <button className="btn btn-ghost btn-sm"
                    onClick={() => setEditAddProject(true)}
                    style={{ fontSize: 12, border: '1px dashed var(--border2)', color: 'var(--text3)' }}
                  >
                    — project —
                  </button>
                )}
              </td>
              <td style={TD}>
                <input value={addRow.description}
                  onChange={e => setAddRow(r => ({ ...r, description: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddSave() }}
                  placeholder="Description…"
                  style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: 13 }}
                />
              </td>
              <td colSpan={7} style={TD} />
              <td style={TD}>
                <button className="btn btn-primary btn-sm" onClick={handleAddSave} disabled={saving || !addRow.date || !addRow.inTime || !addProject}>
                  {saving ? '…' : 'Save'}
                </button>
              </td>
            </tr>
          </tbody>

          {/* Totals footer */}
          <tfoot>
            <tr style={{ background: 'var(--bg3)', borderTop: '2px solid var(--border2)' }}>
              <td colSpan={6} style={{ ...TD, fontWeight: 700, fontSize: 13, color: 'var(--text2)' }}>Total</td>
              <td style={{ ...TD, textAlign: 'right', fontFamily: 'DM Mono, monospace', fontWeight: 700, fontSize: 13 }}>{fmtHours(totalHours)}</td>
              <td style={TD} />
              <td style={TD} />
              <td style={{ ...TD, textAlign: 'right', fontFamily: 'DM Mono, monospace', fontWeight: 700, fontSize: 13 }}>{fmt$(totalBillable)}</td>
              <td style={{ ...TD, textAlign: 'right', fontFamily: 'DM Mono, monospace', fontWeight: 700, fontSize: 13 }}>{fmt$(totalInvoice)}</td>
              <td style={TD} />
              <td style={TD} />
              <td style={TD} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ── Rolling Stats ─────────────────────────────────────────────────────────────

function StatCard({ label, stats }) {
  const TH = { textAlign: 'right', fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text3)', paddingBottom: 6 }
  const TD = { textAlign: 'right', fontSize: 17, fontWeight: 700, fontFamily: 'DM Mono, monospace', color: 'var(--text)', padding: '5px 0' }
  const LB = { fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text3)', padding: '5px 12px 5px 0' }
  return (
    <div className="card" style={{ padding: '12px 16px', flex: '0 0 auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border2)' }}>
            <th style={{ ...TH, textAlign: 'left', paddingRight: 24 }}>{label}</th>
            <th style={TH}>Hours</th>
            <th style={{ ...TH, paddingLeft: 20 }}>Billable</th>
            <th style={{ ...TH, paddingLeft: 20 }}>Invoice</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={LB}>AVG</td>
            <td style={TD}>{fmtHours(stats.hrsAvg)}</td>
            <td style={{ ...TD, paddingLeft: 20 }}>{fmtHours(stats.billAvg)}</td>
            <td style={{ ...TD, paddingLeft: 20 }}>{fmtHours(stats.invAvg)}</td>
          </tr>
          <tr style={{ borderTop: '1px solid var(--border)' }}>
            <td style={LB}>TTL</td>
            <td style={TD}>{fmtHours(stats.hrsTtl)}</td>
            <td style={{ ...TD, paddingLeft: 20 }}>{fmtHours(stats.billTtl)}</td>
            <td style={{ ...TD, paddingLeft: 20 }}>{fmtHours(stats.invTtl)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function RollingStats({ enrichedEntries }) {
  const today = todayISO()

  function windowStats(days) {
    const d = new Date(today + 'T00:00:00')
    d.setDate(d.getDate() - days)
    const startISO = d.toISOString().slice(0, 10)
    const win = enrichedEntries.filter(e => e.date >= startISO && e.date < today)
    const billTtl = win.reduce((s, e) => s + (e.billableAmt || 0), 0)
    const invTtl  = win.filter(e => e.invoice_number).reduce((s, e) => s + (e.billableAmt || 0), 0)
    const hrsTtl  = billTtl / 100
    return {
      hrsTtl,  hrsAvg:  hrsTtl  / days,
      billTtl, billAvg: billTtl / days,
      invTtl,  invAvg:  invTtl  / days,
    }
  }

  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
      <StatCard label="7 Days"  stats={windowStats(7)}  />
      <StatCard label="28 Days" stats={windowStats(28)} />
      <div className="card" style={{ padding: '12px 16px', flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 12, lineHeight: 1.6 }}>
        <div>
          <div>Placeholder</div>
          <div>Yearly Report To Follow</div>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function TimeboardPage() {
  const { user } = useAuth()
  const [view, setView]       = useState('expanded')
  const [entries, setEntries] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [dateMode, setDateMode]               = useState('today')
  const [dateStart, setDateStart]             = useState('')
  const [dateEnd, setDateEnd]                 = useState('')
  const [filterClient, setFilterClient]           = useState('')
  const [filterProject, setFilterProject]         = useState('')
  const [filterCategory, setFilterCategory]       = useState('')
  const [filterInvoiceDate, setFilterInvoiceDate] = useState('')
  const [filterInvoiceWeek, setFilterInvoiceWeek] = useState('')
  const [filterInvoice, setFilterInvoice]         = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    if (!isDemo) {
      const [{ data: e }, { data: p }] = await Promise.all([
        supabase.from('time_entries')
          .select('*, project:projects(id, name, project_number, category, client:clients(id, company, alias))')
          .order('date').order('start_time'),
        supabase.from('projects')
          .select('id, name, project_number, category, client:clients(id, company, alias, hourly_rate)')
          .order('project_number'),
      ])
      console.log('[DEBUG raw entries] first entry from Supabase:', (e || [])[0] ? { id: e[0].id, is_billable: e[0].is_billable, is_billable_type: typeof e[0].is_billable, hourly_rate: e[0].hourly_rate } : 'none')
      setEntries(e || [])
      setProjects(p || [])
    }
    setLoading(false)
  }

  function handlePrevDay() {
    const base = dateMode === 'today' ? todayISO() : (dateStart || todayISO())
    const d = new Date(base + 'T00:00:00')
    d.setDate(d.getDate() - 1)
    const iso = d.toISOString().slice(0, 10)
    setDateStart(iso); setDateEnd(iso); setDateMode('range')
  }

  function handleNextDay() {
    const base = dateMode === 'today' ? todayISO() : (dateStart || todayISO())
    const d = new Date(base + 'T00:00:00')
    d.setDate(d.getDate() + 1)
    const iso = d.toISOString().slice(0, 10)
    setDateStart(iso); setDateEnd(iso); setDateMode('range')
  }

  function handleEntryChange(updated) {
    setEntries(prev => {
      const idx = prev.findIndex(e => e.id === updated.id)
      return idx >= 0 ? prev.map(e => e.id === updated.id ? updated : e) : [...prev, updated]
    })
  }

  function handleEntryDelete(id) {
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  // All entries with computed outTime, hours, billableAmt, invoiceAmt
  const enrichedEntries = useMemo(() => enrichEntries(entries), [entries])

  // Unique clients derived from projects (for the Client filter dropdown)
  const uniqueClients = useMemo(() => {
    const seen = new Set()
    const list = []
    projects.forEach(p => {
      if (p.client?.id && !seen.has(p.client.id)) {
        seen.add(p.client.id)
        list.push(p.client)
      }
    })
    return list.sort((a, b) => (a.company || a.alias || '').localeCompare(b.company || b.alias || ''))
  }, [projects])

  // Filtered + sorted enriched entries (for tiles and collapsed view)
  const displayRows = useMemo(() => {
    const today = todayISO()
    return enrichedEntries.filter(e => {
      if (dateMode === 'today')       { if (e.date !== today) return false }
      else if (dateMode === 'range')  {
        if (dateStart && e.date < dateStart) return false
        if (dateEnd   && e.date > dateEnd)   return false
      }
      if (filterClient   && e.project?.client?.id !== filterClient) return false
      if (filterProject) {
        const q = filterProject.toLowerCase()
        if (!(e.project?.project_number || '').toLowerCase().includes(q) &&
            !(e.project?.name       || '').toLowerCase().includes(q)) return false
      }
      if (filterCategory    && e.project?.category !== filterCategory) return false
      if (filterInvoiceDate && (e.invoice_date || '') !== filterInvoiceDate) return false
      if (filterInvoiceWeek && String(e.invoice_week || '') !== filterInvoiceWeek.trim()) return false
      if (filterInvoice     && (e.invoice_number || '').toLowerCase() !== filterInvoice.toLowerCase()) return false
      return true
    }).sort((a, b) => a.date !== b.date ? a.date.localeCompare(b.date) : (a.start_time || '').localeCompare(b.start_time || ''))
  }, [enrichedEntries, dateMode, dateStart, dateEnd, filterClient, filterProject, filterCategory, filterInvoiceDate, filterInvoiceWeek, filterInvoice])

  const expandedDate = dateMode === 'today' ? todayISO() : (dateStart || todayISO())

  return (
    <div className="fade-in">
      {/* ── topbar ── */}
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>Timeboard</span>
          <div style={{ display: 'flex', border: '1px solid var(--border2)', borderRadius: 6, overflow: 'hidden' }}>
            <button onClick={() => setView('expanded')}
              style={{ padding: '4px 12px', fontSize: 12, fontWeight: 600, border: 'none', borderRight: '1px solid var(--border2)', cursor: 'pointer', background: view === 'expanded' ? 'var(--bg3)' : 'transparent', color: view === 'expanded' ? 'var(--text)' : 'var(--text3)' }}>
              Expand
            </button>
            <button onClick={() => setView('collapsed')}
              style={{ padding: '4px 12px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: view === 'collapsed' ? 'var(--bg3)' : 'transparent', color: view === 'collapsed' ? 'var(--text)' : 'var(--text3)' }}>
              Collapse
            </button>
          </div>
        </div>
      </div>

      <div className="page-content">
        {/* ── summary tiles ── */}
        {loading
          ? <div style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 16 }}>Loading…</div>
          : <SummaryTiles entries={displayRows} />
        }

        {/* ── filter bar ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          <button
            className={`btn btn-sm ${dateMode === 'today' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontWeight: 600 }}
            onClick={() => { setDateMode('today'); setDateStart(''); setDateEnd('') }}
          >Today</button>
          <button className="btn btn-sm btn-ghost" onClick={handlePrevDay}>&lt;</button>
          <button className="btn btn-sm btn-ghost" onClick={handleNextDay}>&gt;</button>
          <input type="date" value={dateStart}
            onChange={e => { setDateStart(e.target.value); setDateMode('range') }}
            style={{ width: 140, fontSize: 12 }}
          />
          <input type="date" value={dateEnd}
            onChange={e => { setDateEnd(e.target.value); setDateMode('range') }}
            style={{ width: 140, fontSize: 12 }}
          />
          {view === 'collapsed' && (<>
            <select value={filterClient} onChange={e => setFilterClient(e.target.value)} style={{ fontSize: 12, width: 130 }}>
              <option value="">Client</option>
              {uniqueClients.map(c => <option key={c.id} value={c.id}>{c.company || c.alias}</option>)}
            </select>
            <input value={filterProject} onChange={e => setFilterProject(e.target.value)}
              placeholder="Project…" style={{ width: 110, fontSize: 12 }}
            />
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ fontSize: 12, width: 120 }}>
              <option value="">Category</option>
              {Object.keys(CATEGORY_COLORS).map(c => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            <input value={filterInvoiceDate} onChange={e => setFilterInvoiceDate(e.target.value)}
              placeholder="Date" style={{ width: 90, fontSize: 12 }}
            />
            <input value={filterInvoiceWeek} onChange={e => setFilterInvoiceWeek(e.target.value)}
              placeholder="Week" style={{ width: 70, fontSize: 12 }}
            />
            <input value={filterInvoice} onChange={e => setFilterInvoice(e.target.value)}
              placeholder="Invoice No." style={{ width: 110, fontSize: 12 }}
            />
            {filterInvoice && (
              <button className="btn btn-ghost btn-sm"
                onClick={() => openInvoiceBreakdown(displayRows, filterInvoice)}
              >
                Invoice Breakdown
              </button>
            )}
            </div>
          </>)}
        </div>

        {/* ── rolling stats (expanded view only) ── */}
        {!loading && view === 'expanded' && <RollingStats enrichedEntries={enrichedEntries} />}

        {/* ── views ── */}
        {!loading && view === 'expanded' && (
          <ExpandedView
            entries={entries}
            projects={projects}
            expandedDate={expandedDate}
            onEntryChange={handleEntryChange}
            onEntryDelete={handleEntryDelete}
            user={user}
          />
        )}
        {!loading && view === 'collapsed' && (
          <CollapsedView
            rows={displayRows}
            projects={projects}
            onEntryChange={handleEntryChange}
            user={user}
            filterInvoice={filterInvoice}
          />
        )}
      </div>
    </div>
  )
}
