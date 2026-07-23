import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { CATEGORY_COLORS } from '../lib/categories'
import { useAuth } from '../lib/auth'
import { windowStats, computeAnnualProjection } from '../lib/projections'
import { toLocalISO, todayISO, calcHoursFromTimes, enrichEntries } from '../lib/timeentries'
import { usePaceTargets } from '../lib/config'

const isDemo = !import.meta.env.VITE_SUPABASE_URL

// 288 five-minute time slots 00:00–23:55
const TIME_SLOTS = Array.from({ length: 288 }, (_, i) => {
  const h = Math.floor(i / 12)
  const m = (i % 12) * 5
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
})

// ── Helpers ───────────────────────────────────────────────────────────────────


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

// Display invoice_date (YYYY-MM-DD) as MM/DD/YY
function fmtInvoiceDate(isoDate) {
  if (!isoDate) return ''
  const [yyyy, mm, dd] = isoDate.split('-')
  if (!yyyy || !mm || !dd) return isoDate
  return `${mm}/${dd}/${yyyy.slice(2)}`
}

// Parse MM/DD/YY back to YYYY-MM-DD for storage
function parseInvoiceDate(val) {
  if (!val) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val
  const m = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/)
  if (m) return `20${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
  return val
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

// ── Daily Gauge ───────────────────────────────────────────────────────────────

function DailyGauge({ pace, breakEven, goal, stretch, billable }) {
  const usd = n => '$' + Math.round(n || 0).toLocaleString('en-US')
  const ceiling = stretch > 0 ? stretch : (goal || breakEven || 1)
  const clamp = v => Math.max(0, Math.min(1, v / ceiling))
  const zoneColor =
    pace >= goal      ? '#16a34a' :
    pace >= breakEven ? '#5b9bd5' :
                        '#dc2626'
  const segRed   = clamp(Math.min(pace, breakEven))
  const segBlue  = clamp(Math.min(pace, goal))    - clamp(Math.min(pace, breakEven))
  const segGreen = clamp(Math.min(pace, stretch)) - clamp(Math.min(pace, goal))
  const bePct    = clamp(breakEven)
  const goalPct  = clamp(goal)
  return (
    <div className="card" style={{ padding: '12px 16px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text3)' }}>Today's Pace</span>
        <span style={{ fontSize: 22, fontWeight: 800, fontFamily: 'DM Mono, monospace', color: zoneColor }}>
          {usd(pace)}<span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)' }}> /yr</span>
        </span>
      </div>
      <div style={{ position: 'relative', height: 14, borderRadius: 7, background: 'var(--bg3)', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: (segRed * 100) + '%', background: '#dc2626', transition: 'width 0.3s ease' }} />
        <div style={{ position: 'absolute', left: (segRed * 100) + '%', top: 0, bottom: 0, width: (segBlue * 100) + '%', background: '#5b9bd5', transition: 'all 0.3s ease' }} />
        <div style={{ position: 'absolute', left: ((segRed + segBlue) * 100) + '%', top: 0, bottom: 0, width: (segGreen * 100) + '%', background: '#16a34a', transition: 'all 0.3s ease' }} />
        <div style={{ position: 'absolute', left: (bePct * 100) + '%', top: 0, bottom: 0, width: 2, background: 'var(--text)', transform: 'translateX(-1px)' }} />
        <div style={{ position: 'absolute', left: (goalPct * 100) + '%', top: 0, bottom: 0, width: 2, background: 'var(--text)', transform: 'translateX(-1px)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: 'var(--text3)' }}>
        <span>Billable today: <strong style={{ color: 'var(--text)' }}>{usd(billable)}</strong></span>
        <span>
          <span style={{ marginRight: 10 }}>Break-even <strong style={{ color: 'var(--text)' }}>{usd(breakEven)}</strong></span>
          <span style={{ marginRight: 10 }}>Goal <strong style={{ color: 'var(--text)' }}>{usd(goal)}</strong></span>
          <span>Stretch <strong style={{ color: 'var(--text)' }}>{usd(stretch)}</strong></span>
        </span>
      </div>
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

const WEEKS_2026 = [
  { value: '2601', label: '2601 | 12/28 - 1/3' },
  { value: '2602', label: '2602 | 1/4 - 1/10' },
  { value: '2603', label: '2603 | 1/11 - 1/17' },
  { value: '2604', label: '2604 | 1/18 - 1/24' },
  { value: '2605', label: '2605 | 1/25 - 1/31' },
  { value: '2606', label: '2606 | 2/1 - 2/7' },
  { value: '2607', label: '2607 | 2/8 - 2/14' },
  { value: '2608', label: '2608 | 2/15 - 2/21' },
  { value: '2609', label: '2609 | 2/22 - 2/28' },
  { value: '2610', label: '2610 | 3/1 - 3/7' },
  { value: '2611', label: '2611 | 3/8 - 3/14' },
  { value: '2612', label: '2612 | 3/15 - 3/21' },
  { value: '2613', label: '2613 | 3/22 - 3/28' },
  { value: '2614', label: '2614 | 3/29 - 4/4' },
  { value: '2615', label: '2615 | 4/5 - 4/11' },
  { value: '2616', label: '2616 | 4/12 - 4/18' },
  { value: '2617', label: '2617 | 4/19 - 4/25' },
  { value: '2618', label: '2618 | 4/26 - 5/2' },
  { value: '2619', label: '2619 | 5/3 - 5/9' },
  { value: '2620', label: '2620 | 5/10 - 5/16' },
  { value: '2621', label: '2621 | 5/17 - 5/23' },
  { value: '2622', label: '2622 | 5/24 - 5/30' },
  { value: '2623', label: '2623 | 5/31 - 6/6' },
  { value: '2624', label: '2624 | 6/7 - 6/13' },
  { value: '2625', label: '2625 | 6/14 - 6/20' },
  { value: '2626', label: '2626 | 6/21 - 6/27' },
  { value: '2627', label: '2627 | 6/28 - 7/4' },
  { value: '2628', label: '2628 | 7/5 - 7/11' },
  { value: '2629', label: '2629 | 7/12 - 7/18' },
  { value: '2630', label: '2630 | 7/19 - 7/25' },
  { value: '2631', label: '2631 | 7/26 - 8/1' },
  { value: '2632', label: '2632 | 8/2 - 8/8' },
  { value: '2633', label: '2633 | 8/9 - 8/15' },
  { value: '2634', label: '2634 | 8/16 - 8/22' },
  { value: '2635', label: '2635 | 8/23 - 8/29' },
  { value: '2636', label: '2636 | 8/30 - 9/5' },
  { value: '2637', label: '2637 | 9/6 - 9/12' },
  { value: '2638', label: '2638 | 9/13 - 9/19' },
  { value: '2639', label: '2639 | 9/20 - 9/26' },
  { value: '2640', label: '2640 | 9/27 - 10/3' },
  { value: '2641', label: '2641 | 10/4 - 10/10' },
  { value: '2642', label: '2642 | 10/11 - 10/17' },
  { value: '2643', label: '2643 | 10/18 - 10/24' },
  { value: '2644', label: '2644 | 10/25 - 10/31' },
  { value: '2645', label: '2645 | 11/1 - 11/7' },
  { value: '2646', label: '2646 | 11/8 - 11/14' },
  { value: '2647', label: '2647 | 11/15 - 11/21' },
  { value: '2648', label: '2648 | 11/22 - 11/28' },
  { value: '2649', label: '2649 | 11/29 - 12/5' },
  { value: '2650', label: '2650 | 12/6 - 12/12' },
  { value: '2651', label: '2651 | 12/13 - 12/19' },
  { value: '2652', label: '2652 | 12/20 - 12/26' },
]

function ExpandedView({ entries, projects, expandedDate, onEntryChange, onEntryDelete, user }) {
  const [editingSlot, setEditingSlot] = useState(null)
  const scrollRef = useRef(null)
  // Re-entrancy guard: holds the slot currently mid-save so a rapid second
  // fire (double-click / doubled event) on the same slot can't insert a
  // duplicate before entryMap refreshes. See duplicate-entry fix.
  const savingSlotRef = useRef(null)

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
    // Bail if this same slot is already mid-save — prevents the duplicate
    // insert caused by a rapid second fire before entryMap refreshes.
    if (savingSlotRef.current === slot) return
    savingSlotRef.current = slot
    setEditingSlot(null)
    try {
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
    } finally {
      savingSlotRef.current = null
    }
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
  const target = (invoiceFilter
    ? rows.filter(r => r.invoice_number === invoiceFilter)
    : rows.filter(r => r.invoice_number)
  ).slice().sort((a, b) => a.date !== b.date ? a.date.localeCompare(b.date) : (a.start_time || '').localeCompare(b.start_time || ''))

  if (target.length === 0) return
  const w = window.open('', '_blank', 'width=900,height=700')
  if (!w) return

  const clientName = target[0]?.project?.client?.company || target[0]?.project?.client?.alias || ''
  const invoiceNum = target[0]?.invoice_number || ''
  const invoiceWeek = target[0]?.invoice_week ? String(target[0].invoice_week) : ''

  // Derive week start/end from WEEKS_2026 label (format: "2609 | 2/22 - 2/28")
  let weekStart = '', weekEnd = ''
  const weekEntry = WEEKS_2026.find(wk => wk.value === invoiceWeek)
  if (weekEntry) {
    const range = weekEntry.label.split('|')[1]?.trim().split(' - ')
    if (range?.length === 2) {
      weekStart = range[0].trim() + '/26'
      weekEnd   = range[1].trim() + '/26'
    }
  }

  const totalHours = target.reduce((s, r) => s + r.hours, 0)
  const totalAmt   = target.reduce((s, r) => s + r.billableAmt, 0)

  // Group entries by project, preserving encounter order
  const groupOrder = []
  const groupMap   = {}
  target.forEach(r => {
    const key = r.project_id || r.project?.project_number || 'unknown'
    if (!groupMap[key]) {
      const pn   = r.project?.project_number || ''
      const name = r.project?.name || ''
      groupMap[key] = { header: [pn, name].filter(Boolean).join(' | '), rows: [], hours: 0, amt: 0 }
      groupOrder.push(key)
    }
    groupMap[key].rows.push(r)
    groupMap[key].hours += r.hours
    groupMap[key].amt   += r.billableAmt
  })

  const groupsHtml = groupOrder.map(key => {
    const g = groupMap[key]
    const rowsHtml = g.rows.map(r => `<tr class="detail">
      <td class="date">${fmtDate(r.date)}</td>
      <td>${r.description || ''}</td>
      <td class="num">${r.hours.toFixed(2)}</td>
      <td class="num">${r.billableAmt > 0 ? r.billableAmt.toFixed(2) : '—'}</td>
    </tr>`).join('')
    return `<tr><td colspan="4" class="proj-hdr">${g.header}</td></tr>
${rowsHtml}
<tr class="subtotal"><td colspan="2" class="lbl">TOTAL</td><td class="num">${g.hours.toFixed(2)}</td><td class="num">${g.amt.toFixed(2)}</td></tr>
<tr class="gap"><td colspan="4"></td></tr>`
  }).join('\n')

  w.document.write(`<!DOCTYPE html><html><head><title>Invoice #${invoiceNum}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:Arial,sans-serif;font-size:12px;padding:32px 36px;color:#222;max-width:860px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  button{margin-bottom:20px;padding:5px 14px;cursor:pointer;font-size:12px}
  .hdr{display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:10px;border-bottom:1px solid #cccccc;margin-bottom:20px}
  .client{font-size:20px;font-weight:700}
  .meta{display:flex;gap:20px;text-align:center}
  .meta-field label{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:#888;margin-bottom:2px}
  .meta-field span{font-weight:600;font-size:12px}
  h2{font-size:13px;font-weight:700;margin:0 0 10px;padding-bottom:8px;border-bottom:1px solid #cccccc}
  table{width:100%;border-collapse:collapse}
  td{padding:3px 6px 3px 0;font-size:12px;vertical-align:top}
  td.date{width:52px;white-space:nowrap;color:#555}
  td.num{text-align:right;font-family:Helvetica,Arial,sans-serif;width:60px}
  td.lbl{text-align:right;font-weight:700}
  .proj-hdr{font-weight:700;font-size:12px;padding:10px 0 4px;border-top:none}
  .subtotal td{font-weight:700;border-top:1px solid #cccccc;padding-top:5px;padding-bottom:6px}
  .gap td{height:14px}
  .grand td{font-weight:700;border-top:1px solid #cccccc;padding-top:7px;font-size:13px}
  .detail td{border-bottom:0.5px solid #cccccc;padding-top:5px;padding-bottom:5px}
  @media print{button{display:none}}
</style></head><body>
<button onclick="window.print()">Print / Save PDF</button>
<div class="hdr">
  <div class="client">${clientName}</div>
  <div class="meta">
    <div class="meta-field"><label>Week</label><span>${invoiceWeek || '—'}</span></div>
    <div class="meta-field"><label>Start</label><span>${weekStart || '—'}</span></div>
    <div class="meta-field"><label>End</label><span>${weekEnd || '—'}</span></div>
    <div class="meta-field"><label>Inv No.</label><span>${invoiceNum || '—'}</span></div>
  </div>
</div>
<h2>Hours Summary</h2>
<table><tbody>
${groupsHtml}
</tbody><tfoot>
  <tr class="grand"><td colspan="2" class="lbl">TOTAL</td><td class="num">${totalHours.toFixed(2)}</td><td class="num">${totalAmt.toFixed(2)}</td></tr>
</tfoot></table>
</body></html>`)
  w.document.close()
}

// ── Client Totals ──────────────────────────────────────────────────────────────
// Per-client snapshot of whatever is currently in view. Paired with the
// To Invoice filter it answers "what does each client owe me this run?"
function openClientTotals(rows) {
  if (!rows || rows.length === 0) return
  const w = window.open('', '_blank', 'width=760,height=700')
  if (!w) return

  const map = {}
  rows.forEach(r => {
    const name = r.project?.client?.company || r.project?.client?.alias || 'Unassigned'
    if (!map[name]) map[name] = { hours: 0, amt: 0 }
    map[name].hours += r.hours
    map[name].amt   += r.billableAmt
  })

  const names = Object.keys(map).sort((a, b) => a.localeCompare(b))
  const totalHours = names.reduce((s, n) => s + map[n].hours, 0)
  const totalAmt   = names.reduce((s, n) => s + map[n].amt,   0)

  const rowsHtml = names.map(n => `<tr class="detail">
    <td>${n}</td>
    <td class="num">${map[n].hours.toFixed(2)}</td>
    <td class="num">${map[n].amt.toFixed(2)}</td>
  </tr>`).join('\n')

  w.document.write(`<!DOCTYPE html><html><head><title>Client Invoice List</title>
<style>
  *{box-sizing:border-box}
  body{font-family:Arial,sans-serif;font-size:12px;padding:32px 36px;color:#222;max-width:640px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  button{margin-bottom:20px;padding:5px 14px;cursor:pointer;font-size:12px}
  h1{font-size:20px;font-weight:700;margin:0 0 20px;padding-bottom:10px;border-bottom:1px solid #cccccc}
  table{width:100%;border-collapse:collapse}
  td{padding:8px 6px 8px 0;font-size:13px;vertical-align:middle}
  td.num{text-align:right;font-family:Helvetica,Arial,sans-serif;width:90px}
  td.lbl{text-align:right;font-weight:700}
  .detail td{border-bottom:0.5px solid #cccccc}
  .grand td{font-weight:700;border-top:1px solid #cccccc;padding-top:9px;font-size:13px}
  @media print{button{display:none}}
</style></head><body>
<button onclick="window.print()">Print / Save PDF</button>
<h1>Client Invoice List</h1>
<table><tbody>
${rowsHtml}
</tbody><tfoot>
  <tr class="grand"><td class="lbl">TOTAL</td><td class="num">${totalHours.toFixed(2)}</td><td class="num">${totalAmt.toFixed(2)}</td></tr>
</tfoot></table>
</body></html>`)
  w.document.close()
}

// ── Collapsed View ─────────────────────────────────────────────────────────────

const TH = { padding: '8px 10px', fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '2px solid var(--border2)', whiteSpace: 'nowrap', textAlign: 'left' }
const TD = { padding: '7px 10px', fontSize: 13, verticalAlign: 'middle', borderBottom: '1px solid var(--border)' }

function CollapsedView({ rows, projects, onEntryChange, user, filterInvoice, onOpenBreakdown, onEntryDelete }) {
  const [addRow, setAddRow]       = useState({ date: todayISO(), inTime: '', description: '' })
  const [addProject, setAddProject]         = useState(null)
  const [editAddProject, setEditAddProject] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [selectedRows, setSelectedRows] = useState(new Set())
  const [applyInvoiceDate,   setApplyInvoiceDate]   = useState('')
  const [applyInvoiceWeek,   setApplyInvoiceWeek]   = useState('')
  const [applyInvoiceNumber, setApplyInvoiceNumber] = useState('')
  const [applyError, setApplyError] = useState('')
  const [editingProjectId, setEditingProjectId] = useState(null)

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

  async function saveProject(entry, project) {
    const sel = '*, project:projects(id, name, project_number, category, client:clients(id, company, alias))'
    const { data } = await supabase.from('time_entries')
      .update({ project_id: project.id, hourly_rate: project.client?.hourly_rate || 0 })
      .eq('id', entry.id).select(sel).single()
    if (data) onEntryChange(data)
    setEditingProjectId(null)
  }

  async function deleteEntry(row) {
    if (!window.confirm('Delete this time entry? This cannot be undone.')) return
    const { error } = await supabase.from('time_entries').delete().eq('id', row.id)
    if (error) { console.error('Delete entry error:', error); return }
    onEntryDelete(row.id)
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
    display: 'inline-block', padding: '1px 4px',
    border: '1px solid var(--border)', borderRadius: 4,
    fontSize: 11, fontFamily: 'DM Mono, monospace',
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
          {applyInvoiceWeek ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2, border: '1px solid var(--border)', borderRadius: 4, padding: '1px 4px 1px 7px', fontSize: 12, background: 'var(--bg)', height: 26, boxSizing: 'border-box' }}>
              <span style={{ fontFamily: 'DM Mono, monospace' }}>{applyInvoiceWeek}</span>
              <button onClick={() => setApplyInvoiceWeek('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 15, lineHeight: 1, padding: '0 2px' }}>×</button>
            </div>
          ) : (
            <select value="" onChange={e => setApplyInvoiceWeek(e.target.value)}
              style={{ fontSize: 12, width: 160 }}
            >
              <option value="">Week</option>
              {WEEKS_2026.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
            </select>
          )}
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
              <th style={{ ...TH, width: '1%', minWidth: 0, padding: '8px 6px 8px 4px', whiteSpace: 'nowrap' }}>Date</th>
              <th style={{ ...TH, width: '1%', minWidth: 0, padding: '8px 6px 8px 4px', whiteSpace: 'nowrap' }}>In</th>
              <th style={{ ...TH, width: '1%', minWidth: 0, padding: '8px 6px 8px 4px', whiteSpace: 'nowrap' }}>Out</th>
              <th style={{ ...TH, minWidth: 200 }}>Project</th>
              <th style={{ ...TH, width: '100%' }}>Description</th>
              <th style={{ ...TH, textAlign: 'right', width: 65 }}>Hours</th>
              <th style={{ ...TH, width: 50, textAlign: 'center' }}></th>
              <th style={{ ...TH, textAlign: 'right', width: 65 }}>Rate</th>
              <th style={{ ...TH, textAlign: 'right', width: 80 }}>Billable</th>
              <th style={{ ...TH, textAlign: 'right', width: 80 }}>Invoice</th>
              <th style={{ ...TH, width: 90, textAlign: 'center' }}>Date</th>
              <th style={{ ...TH, width: 60, textAlign: 'center' }}>Week</th>
              <th style={{ ...TH, width: 90 }}>Invoice No.</th>
              <th style={{ ...TH, width: 40, textAlign: 'center' }}></th>
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
                  <td style={{ ...rowStyle, padding: '7px 6px 7px 4px', minWidth: 0, whiteSpace: 'nowrap' }}><span style={{ fontSize: 11, color: 'var(--text3)' }}>{fmtDate(row.date)}</span></td>
                  <td style={{ ...rowStyle, padding: '7px 6px 7px 4px', minWidth: 0, whiteSpace: 'nowrap' }}><span style={timePillStyle}>{fmtTime(row.start_time)}</span></td>
                  <td style={{ ...rowStyle, padding: '7px 6px 7px 4px', minWidth: 0, whiteSpace: 'nowrap' }}>{row.outTime ? <span style={timePillStyle}>{fmtTime(row.outTime)}</span> : <span style={{ color: 'var(--text3)', fontSize: 12 }}>—</span>}</td>
                  <td style={rowStyle}>
                    {editingProjectId === row.id ? (
                      <ProjectInput
                        existingEntry={row}
                        projects={projects}
                        onSelect={p => saveProject(row, p)}
                        onCancel={() => setEditingProjectId(null)}
                      />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap' }}>
                        <span
                          onClick={() => setEditingProjectId(row.id)}
                          style={{ display: 'inline-block', padding: '2px 8px', background: catColor, borderRadius: 4, fontSize: 12, fontFamily: 'DM Mono, monospace', color: darken(catColor), whiteSpace: 'nowrap', flexShrink: 0, cursor: 'pointer' }}
                        >
                          {projectLabel(row)}
                        </span>
                        {row.project?.name && (
                          <span style={{ fontSize: 12, color: 'var(--text2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {row.project.name}
                          </span>
                        )}
                      </div>
                    )}
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
                      value={fmtInvoiceDate(row.invoice_date)}
                      onSave={v => saveInvoiceDate(row, parseInvoiceDate(v))}
                      placeholder="—"
                      width={72}
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
                  <td style={{ ...rowStyle, textAlign: 'center' }}>
                    <button onClick={() => deleteEntry(row)} title="Delete entry"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text3)', display: 'inline-flex', alignItems: 'center' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </td>
                </tr>
              )
            })}

            {/* Add row */}
            <tr style={{ background: 'var(--accent-glow)', borderBottom: '1px solid var(--border)' }}>
              <td style={TD} />
              <td style={{ ...TD, padding: '7px 6px 7px 4px', minWidth: 0 }}>
                <input type="date" value={addRow.date}
                  onChange={e => setAddRow(r => ({ ...r, date: e.target.value }))}
                  style={{ width: 80, fontSize: 11 }}
                />
              </td>
              <td style={{ ...TD, padding: '7px 6px 7px 4px', minWidth: 0 }}>
                <input type="time" value={addRow.inTime}
                  onChange={e => setAddRow(r => ({ ...r, inTime: e.target.value }))}
                  style={{ width: 80, fontSize: 11, fontFamily: 'DM Mono, monospace' }}
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
              <td style={TD} />
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
              <td style={TD} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ── Annual Projection ─────────────────────────────────────────────────────────

function AnnualProjection({ ytdEnriched, sevenAvg, twentyEightAvg }) {
  const { A, B, C, D, E, F, G, H, I } = computeAnnualProjection({ ytdEnriched, sevenAvg, twentyEightAvg })

  function fmtUSD(n) {
    return '$' + Math.round(n || 0).toLocaleString('en-US')
  }

  const TH = { textAlign: 'right', fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text3)', paddingBottom: 6 }
  const TD = { textAlign: 'right', fontSize: 17, fontWeight: 700, fontFamily: 'DM Mono, monospace', color: 'var(--text)', padding: '3px 0' }
  const LB = { fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text3)', padding: '3px 12px 3px 0' }

  return (
    <div className="card" style={{ padding: '12px 16px', flex: '0 0 auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border2)' }}>
            <th style={{ ...TH, textAlign: 'left', paddingRight: 24 }}></th>
            <th style={TH}>AVG</th>
            <th style={{ ...TH, paddingLeft: 20 }}>Current Year</th>
            <th style={{ ...TH, paddingLeft: 20 }}>12 Months</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={LB}>YTD Pace</td>
            <td style={TD}>{fmtUSD(A)}</td>
            <td style={{ ...TD, paddingLeft: 20 }}>{fmtUSD(D)}</td>
            <td style={{ ...TD, paddingLeft: 20 }}>{fmtUSD(G)}</td>
          </tr>
          <tr style={{ borderTop: '1px solid var(--border)' }}>
            <td style={LB}>28-Day Pace</td>
            <td style={TD}>{fmtUSD(B)}</td>
            <td style={{ ...TD, paddingLeft: 20 }}>{fmtUSD(E)}</td>
            <td style={{ ...TD, paddingLeft: 20 }}>{fmtUSD(H)}</td>
          </tr>
          <tr style={{ borderTop: '1px solid var(--border)' }}>
            <td style={LB}>7-Day Pace</td>
            <td style={TD}>{fmtUSD(C)}</td>
            <td style={{ ...TD, paddingLeft: 20 }}>{fmtUSD(F)}</td>
            <td style={{ ...TD, paddingLeft: 20 }}>{fmtUSD(I)}</td>
          </tr>
        </tbody>
      </table>
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

function RollingStats() {
  const [statsEntries, setStatsEntries] = useState([])
  const [ytdEntries, setYtdEntries] = useState([])

  useEffect(() => {
    if (isDemo) return
    const today = todayISO()
    const d = new Date(today + 'T00:00:00')
    d.setDate(d.getDate() - 28)
    const startISO = toLocalISO(d)
    supabase.from('time_entries')
      .select('*, project:projects(id, name, project_number, category, client:clients(id, company, alias))')
      .gte('date', startISO).lt('date', today)
      .order('date').order('start_time')
      .then(({ data }) => setStatsEntries(data || []))

    const jan1 = toLocalISO(new Date(new Date().getFullYear(), 0, 1))
    supabase.from('time_entries')
      .select('*, project:projects(id, name, project_number, category, client:clients(id, company, alias))')
      .gte('date', jan1).lt('date', today)
      .order('date').order('start_time')
      .then(({ data }) => setYtdEntries(data || []))
  }, [])

  const enriched    = useMemo(() => enrichEntries(statsEntries), [statsEntries])
  const ytdEnriched = useMemo(() => enrichEntries(ytdEntries),   [ytdEntries])

  const today   = todayISO()
  const stats7  = windowStats(enriched, 7, today)
  const stats28 = windowStats(enriched, 28, today)

  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
      <StatCard label="7 Days"  stats={stats7}  />
      <StatCard label="28 Days" stats={stats28} />
      <AnnualProjection ytdEnriched={ytdEnriched} sevenAvg={stats7.billAvg} twentyEightAvg={stats28.billAvg} />
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function TimeboardPage() {
  useEffect(() => { document.title = 'Time Board' }, [])
  const paceTargets = usePaceTargets()
  const { user } = useAuth()
  const [view, setView]       = useState(() => localStorage.getItem('timeboard_view') || 'expanded')
  const [entries, setEntries] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [dateMode, setDateMode]               = useState('today')
  const [dateStart, setDateStart]             = useState('')
  const [dateEnd, setDateEnd]                 = useState('')
  const [filterClient, setFilterClient]           = useState('')
  const [filterProject, setFilterProject]         = useState('')
  const [filterDescription, setFilterDescription] = useState('')
  const [filterCategory, setFilterCategory]       = useState('')
  const [filterInvoiceDate, setFilterInvoiceDate] = useState('')
  const [filterInvoiceWeek, setFilterInvoiceWeek] = useState('')
  const [filterInvoice, setFilterInvoice]         = useState('')
  const [filterToInvoice, setFilterToInvoice]     = useState(false)

  useEffect(() => { load(dateMode, dateStart, dateEnd) }, [dateMode, dateStart, dateEnd])

  async function load(mode, start, end) {
    setLoading(true)
    if (!isDemo) {
      const today = todayISO()
      let q = supabase.from('time_entries')
        .select('*, project:projects(id, name, project_number, category, client:clients(id, company, alias))')
        .order('date').order('start_time')
        .range(0, 4999)
      if (mode === 'today') {
        q = q.gte('date', today).lte('date', today)
      } else if (mode === 'range') {
        if (start) q = q.gte('date', start)
        if (end)   q = q.lte('date', end)
      }
      const [{ data: e, error: eErr }, { data: p }] = await Promise.all([
        q,
        supabase.from('projects')
          .select('id, name, project_number, category, client:clients(id, company, alias, hourly_rate)')
          .order('project_number'),
      ])
      if (eErr) console.error('[load] time_entries error:', eErr)
      setEntries(e || [])
      setProjects(p || [])
    }
    setLoading(false)
  }

  function handlePrevDay() {
    const base = dateMode === 'today' ? todayISO() : (dateStart || todayISO())
    const d = new Date(base + 'T00:00:00')
    d.setDate(d.getDate() - 1)
    const iso = toLocalISO(d)
    setDateStart(iso); setDateEnd(iso); setDateMode('range')
  }

  function handleNextDay() {
    const base = dateMode === 'today' ? todayISO() : (dateStart || todayISO())
    const d = new Date(base + 'T00:00:00')
    d.setDate(d.getDate() + 1)
    const iso = toLocalISO(d)
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
    const clientProjectIds = filterClient
      ? new Set(projects.filter(p => p.client?.id === filterClient).map(p => p.id))
      : null
    return enrichedEntries.filter(e => {
      if (dateMode === 'today')       { if (e.date !== today) return false }
      else if (dateMode === 'range')  {
        if (dateStart && e.date < dateStart) return false
        if (dateEnd   && e.date > dateEnd)   return false
      }
      if (clientProjectIds && !clientProjectIds.has(e.project_id)) return false
      if (filterProject) {
        const q = filterProject.toLowerCase()
        if (!(e.project?.project_number || '').toLowerCase().includes(q) &&
            !(e.project?.name       || '').toLowerCase().includes(q)) return false
      }
      if (filterDescription && !(e.description || '').toLowerCase().includes(filterDescription.toLowerCase())) return false
      if (filterCategory    && e.project?.category !== filterCategory) return false
      if (filterInvoiceDate && (e.invoice_date || '') !== filterInvoiceDate) return false
      if (filterInvoiceWeek && String(e.invoice_week || '') !== filterInvoiceWeek.trim()) return false
      if (filterInvoice     && (e.invoice_number || '').toLowerCase() !== filterInvoice.toLowerCase()) return false
      if (filterToInvoice   && !(e.invoice_number == null || e.invoice_number === '')) return false
      return true
    }).sort((a, b) => a.date !== b.date ? a.date.localeCompare(b.date) : (a.start_time || '').localeCompare(b.start_time || ''))
  }, [enrichedEntries, dateMode, dateStart, dateEnd, filterClient, filterProject, filterDescription, filterCategory, filterInvoiceDate, filterInvoiceWeek, filterInvoice, filterToInvoice, projects])

  const expandedDate = dateMode === 'today' ? todayISO() : (dateStart || todayISO())

  const todayBillable = useMemo(() => {
    const t = todayISO()
    return enrichedEntries.reduce((s, e) => (e.date === t ? s + (e.billableAmt || 0) : s), 0)
  }, [enrichedEntries])

  return (
    <div className="fade-in">
      {/* ── topbar ── */}
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>Timeboard</span>
          <div style={{ display: 'flex', border: '1px solid var(--border2)', borderRadius: 6, overflow: 'hidden' }}>
            <button onClick={() => { setView('expanded'); localStorage.setItem('timeboard_view', 'expanded') }}
              style={{ padding: '4px 12px', fontSize: 12, fontWeight: 600, border: 'none', borderRight: '1px solid var(--border2)', cursor: 'pointer', background: view === 'expanded' ? 'var(--bg3)' : 'transparent', color: view === 'expanded' ? 'var(--text)' : 'var(--text3)' }}>
              Expand
            </button>
            <button onClick={() => { setView('collapsed'); localStorage.setItem('timeboard_view', 'collapsed') }}
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

        {!loading && dateMode === 'today' && (
          <DailyGauge pace={todayBillable * 365} breakEven={paceTargets.breakEven} goal={paceTargets.goal} stretch={paceTargets.stretch} billable={todayBillable} />
        )}

        {/* ── filter bar ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          <button
            className={`btn btn-sm ${dateMode === 'today' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontWeight: 600 }}
            onClick={() => {
              if (dateMode === 'today') { setDateMode('all') }
              else { setDateMode('today'); setDateStart(''); setDateEnd('') }
            }}
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
            <input value={filterDescription} onChange={e => setFilterDescription(e.target.value)}
              placeholder="Description…" style={{ width: 130, fontSize: 12 }}
            />
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ fontSize: 12, width: 120 }}>
              <option value="">Category</option>
              {Object.keys(CATEGORY_COLORS).map(c => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              className={`btn btn-sm ${filterToInvoice ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setFilterToInvoice(v => !v)}
            >To Invoice</button>
            {filterToInvoice && (
              <button className="btn btn-ghost btn-sm"
                onClick={() => openClientTotals(displayRows)}
              >
                Client Totals
              </button>
            )}
            <input value={filterInvoiceDate} onChange={e => setFilterInvoiceDate(e.target.value)}
              placeholder="Date" style={{ width: 90, fontSize: 12 }}
            />
            {filterInvoiceWeek ? (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2, border: '1px solid var(--border)', borderRadius: 4, padding: '1px 4px 1px 7px', fontSize: 12, background: 'var(--bg)', height: 26, boxSizing: 'border-box' }}>
                <span style={{ fontFamily: 'DM Mono, monospace' }}>{filterInvoiceWeek}</span>
                <button onClick={() => setFilterInvoiceWeek('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 15, lineHeight: 1, padding: '0 2px' }}>×</button>
              </div>
            ) : (
              <select value="" onChange={e => setFilterInvoiceWeek(e.target.value)}
                style={{ fontSize: 12, width: 160 }}
              >
                <option value="">Week</option>
                {WEEKS_2026.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
              </select>
            )}
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
        {!loading && view === 'expanded' && <RollingStats />}

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
            onEntryDelete={handleEntryDelete}
          />
        )}
      </div>
    </div>
  )
}
