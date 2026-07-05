import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Breadcrumb } from '../components/ui'
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isSameMonth, isSameDay,
} from 'date-fns'

// Category colors — mirror of CATEGORY_COLORS in Projects.jsx.
// Duplicated intentionally to keep this a single-file change;
// candidate for extraction to src/lib/categories.js later.
const CATEGORY_COLORS = {
  primary:    '#ffb8b8',
  secondary:  '#4fd1b8',
  accounting: '#63ca7a',
  overhead:   '#b9dd67',
  charity:    '#c6c7fe',
  personal:   '#ebb8e5',
}
const CATEGORY_LABELS = {
  primary: 'Prin', secondary: 'Sec', accounting: 'Acct',
  overhead: 'OH', charity: 'Char', personal: 'Pers',
}
function catColor(category) { return CATEGORY_COLORS[category] || 'var(--bg4)' }
function catLabel(category) { return CATEGORY_LABELS[category] || (category || '—') }

export default function CalendarPage() {
  useEffect(() => { document.title = 'Calendar' }, [])
  const navigate  = useNavigate()
  const location  = useLocation()
  const [events, setEvents]           = useState([])
  const [loading, setLoading]         = useState(true)
  const [current, setCurrent]         = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(null)
  const [filterClient,  setFilterClient]  = useState('')
  const [filterProject, setFilterProject] = useState('')
  const [filterItem,    setFilterItem]    = useState('')
  const [filterTag,     setFilterTag]     = useState('')
  const [filterStatus,  setFilterStatus]  = useState('')
  const [draggedId,   setDraggedId]   = useState(null)
  const [dragOverIso, setDragOverIso] = useState(null)
  const [view, setView] = useState('month')   // 'day' | 'week' | 'month'
  const inFlightRef = useRef(new Set())

  // Reschedule an item by drag-drop. Optimistic + rollback, single write, re-entrancy-guarded.
  async function moveItem(id, newDateIso) {
    if (!id || inFlightRef.current.has(id)) return       // guard: ignore concurrent fire on same item
    const item = events.find(e => e.id === id)
    if (!item || item.scheduled_date === newDateIso) return   // missing or no-op (same day)
    const prevDate = item.scheduled_date

    inFlightRef.current.add(id)                            // LOCK synchronously, before any await
    setEvents(prev => prev.map(e => e.id === id ? { ...e, scheduled_date: newDateIso } : e))  // optimistic move

    const { error } = await supabase
      .from('project_items')
      .update({ scheduled_date: newDateIso })
      .eq('id', id)

    if (error) {
      setEvents(prev => prev.map(e => e.id === id ? { ...e, scheduled_date: prevDate } : e))  // rollback
      console.error('Calendar move failed, reverted:', error)
    }
    inFlightRef.current.delete(id)                         // release
  }

  // View-aware navigation: month steps by month, week by 7 days, day by 1 day.
  function navPrev() { setCurrent(c => view === 'day' ? addDays(c, -1) : view === 'week' ? addDays(c, -7) : subMonths(c, 1)) }
  function navNext() { setCurrent(c => view === 'day' ? addDays(c, 1)  : view === 'week' ? addDays(c, 7)  : addMonths(c, 1)) }

  // Draggable item card + day drop-target props — shared by Week and Day views.
  // (Month view keeps its own inline copy; unify later if card styling changes.)
  function eventCard(ev) {
    const cat = ev.project?.category
    const isDragging = draggedId === ev.id
    return (
      <div key={ev.id}
        draggable
        onDragStart={e => {
          e.stopPropagation()
          setDraggedId(ev.id)
          e.dataTransfer.effectAllowed = 'move'
          e.dataTransfer.setData('text/plain', ev.id)
        }}
        onDragEnd={() => { setDraggedId(null); setDragOverIso(null) }}
        style={{
          fontSize: 12, fontWeight: 500,
          padding: '4px 8px', borderRadius: 4, marginBottom: 3,
          borderLeft: `3px solid ${catColor(cat)}`,
          background: 'var(--bg3)', color: 'var(--text2)',
          cursor: 'grab',
          opacity: isDragging ? 0.4 : 1,
        }} title={`${ev.project?.name || ''} — ${ev.name}`}>
        {ev.project?.name ? `${ev.project.name}: ` : ''}{ev.name}
      </div>
    )
  }
  function dropProps(dayIso) {
    return {
      onDragOver: e => { e.preventDefault(); if (dragOverIso !== dayIso) setDragOverIso(dayIso) },
      onDragLeave: () => { if (dragOverIso === dayIso) setDragOverIso(null) },
      onDrop: e => { e.preventDefault(); moveItem(draggedId, dayIso); setDraggedId(null); setDragOverIso(null) },
    }
  }

  useEffect(() => {
    setLoading(true)
    loadEvents()
    setSelectedDay(null)
  }, [current, location.pathname])

  async function loadEvents() {
    setLoading(true)
    // Query the full visible grid (incl. leading/trailing days from adjacent months)
    const rangeStart = format(startOfWeek(startOfMonth(current)), 'yyyy-MM-dd')
    const rangeEnd   = format(endOfWeek(endOfMonth(current)),     'yyyy-MM-dd')
    const { data } = await supabase
      .from('project_items')
      .select('id, name, scheduled_date, status, completed_date, project:projects(name, category, tags, client:clients(company))')
      .gte('scheduled_date', rangeStart)
      .lte('scheduled_date', rangeEnd)
      .order('scheduled_date')
    setEvents(data || [])
    setLoading(false)
  }

  // Build grid from Sunday of first week through Saturday of last week
  const monthStart = startOfMonth(current)
  const monthEnd   = endOfMonth(current)
  const gridStart  = startOfWeek(monthStart)
  const gridEnd    = endOfWeek(monthEnd)
  const days = []
  let d = gridStart
  while (d <= gridEnd) { days.push(d); d = addDays(d, 1) }

  // Filter options derived from the loaded month (client-side, no extra queries)
  const clientOptions  = [...new Set(events.map(e => e.project?.client?.company).filter(Boolean))].sort()
  const projectOptions = [...new Set(events.map(e => e.project?.name).filter(Boolean))].sort()
  const tagOptions     = [...new Set(events.flatMap(e => e.project?.tags || []).filter(Boolean))].sort()
  const STATUS_OPTIONS = ['Open', 'Complete']

  const filtered = events.filter(e => {
    if (filterClient  && e.project?.client?.company !== filterClient) return false
    if (filterProject && e.project?.name !== filterProject) return false
    if (filterItem    && !(e.name || '').toLowerCase().includes(filterItem.toLowerCase())) return false
    if (filterTag     && !(e.project?.tags || []).includes(filterTag)) return false
    if (filterStatus  && e.status !== filterStatus) return false
    return true
  })

  const anyFilterActive = filterClient || filterProject || filterItem || filterTag || filterStatus
  function clearFilters() {
    setFilterClient(''); setFilterProject(''); setFilterItem(''); setFilterTag(''); setFilterStatus('')
  }

  const filterCtrl = {
    padding: '6px 12px', borderRadius: 8, fontSize: 13,
    border: '1px solid var(--border)', background: 'var(--bg2)',
    color: 'var(--text2)', cursor: 'pointer', outline: 'none',
  }

  function eventsOnDay(day) {
    const iso = format(day, 'yyyy-MM-dd')
    return filtered.filter(e => e.scheduled_date === iso)
  }

  const today            = new Date()
  const selectedEvents   = selectedDay ? eventsOnDay(selectedDay) : []
  const viewTitle = view === 'day'
    ? format(current, 'EEE, MMM d, yyyy')
    : view === 'week'
      ? `${format(startOfWeek(current), 'MMM d')} – ${format(endOfWeek(current), 'MMM d, yyyy')}`
      : format(current, 'MMMM yyyy')

  return (
    <div className="fade-in">
      <div className="topbar">
        <Breadcrumb segments={[
          { label: 'Dashboard', onClick: () => navigate('/') },
          { label: 'Calendar' },
        ]} />

        {/* View toggle */}
        <div style={{ display: 'flex', gap: 4, marginLeft: 12 }}>
          {[['day','D'],['week','W'],['month','M']].map(([v, label]) => (
            <button key={v} onClick={() => setView(v)}
              style={{
                padding: '4px 11px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                border: '1px solid var(--border)',
                background: view === v ? 'var(--bg4)' : 'transparent',
                color: view === v ? 'var(--text)' : 'var(--text2)',
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* Date navigation (view-aware) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
          <button className="btn btn-ghost btn-sm" onClick={navPrev}>←</button>
          <span style={{
            fontSize: 14, fontWeight: 600, color: 'var(--text)',
            minWidth: 190, textAlign: 'center',
          }}>
            {viewTitle}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={navNext}>→</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setCurrent(new Date())}>Today</button>
        </div>
      </div>

      {/* Filter bar — attribute filters, stack as AND. Date range lives in List view. */}
      <div style={{
        display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
        padding: '10px 0', marginBottom: 4,
      }}>
        <select value={filterClient} onChange={e => setFilterClient(e.target.value)}
          style={{ ...filterCtrl, borderColor: filterClient ? 'var(--accent)' : 'var(--border)' }}>
          <option value="">Client</option>
          {clientOptions.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
          style={{ ...filterCtrl, borderColor: filterProject ? 'var(--accent)' : 'var(--border)' }}>
          <option value="">Project</option>
          {projectOptions.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        <input value={filterItem} onChange={e => setFilterItem(e.target.value)} placeholder="Item"
          style={{ ...filterCtrl, borderColor: filterItem ? 'var(--accent)' : 'var(--border)', cursor: 'text', minWidth: 120 }} />

        <select value={filterTag} onChange={e => setFilterTag(e.target.value)}
          style={{ ...filterCtrl, borderColor: filterTag ? 'var(--accent)' : 'var(--border)' }}>
          <option value="">Tags</option>
          {tagOptions.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ ...filterCtrl, borderColor: filterStatus ? 'var(--accent)' : 'var(--border)' }}>
          <option value="">Status</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        {anyFilterActive && (
          <button onClick={clearFilters}
            style={{ ...filterCtrl, color: 'var(--text3)', cursor: 'pointer', border: 'none', background: 'transparent' }}>
            Clear
          </button>
        )}
      </div>

      <div className="page-content">

        {view === 'month' && (
        <div className="card">
          {/* Day-of-week headers */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(7,1fr)',
            background: 'var(--bg3)', borderBottom: '1px solid var(--border)',
          }}>
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day => (
              <div key={day} style={{
                padding: '8px 10px', fontSize: 11, fontWeight: 600,
                letterSpacing: '0.06em', textTransform: 'uppercase',
                color: 'var(--text3)', textAlign: 'center',
              }}>
                {day}
              </div>
            ))}
          </div>

          {/* Calendar cells */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
            {days.map((day, i) => {
              const dayEvents   = eventsOnDay(day)
              const inMonth     = isSameMonth(day, current)
              const isToday     = isSameDay(day, today)
              const isSelected  = selectedDay && isSameDay(day, selectedDay)
              const hasBorderR  = (i + 1) % 7 !== 0
              const hasBorderB  = i < days.length - 7

              const dayIso    = format(day, 'yyyy-MM-dd')
              const isDragOver = dragOverIso === dayIso
              return (
                <div
                  key={i}
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                  onDragOver={e => { e.preventDefault(); if (dragOverIso !== dayIso) setDragOverIso(dayIso) }}
                  onDragLeave={e => { if (dragOverIso === dayIso) setDragOverIso(null) }}
                  onDrop={e => {
                    e.preventDefault()
                    moveItem(draggedId, dayIso)
                    setDraggedId(null)
                    setDragOverIso(null)
                  }}
                  style={{
                    minHeight: 90, padding: '8px 6px',
                    borderRight:  hasBorderR ? '1px solid var(--border)' : 'none',
                    borderBottom: hasBorderB ? '1px solid var(--border)' : 'none',
                    borderLeft:   isSelected ? '2px solid var(--accent)' : '2px solid transparent',
                    background: isDragOver
                      ? 'var(--accent-glow)'
                      : isToday
                        ? 'var(--accent-glow)'
                        : isSelected ? 'var(--bg3)' : 'var(--bg2)',
                    outline: isDragOver ? '2px dashed var(--accent)' : 'none',
                    outlineOffset: -2,
                    opacity: inMonth ? 1 : 0.35,
                    cursor: 'pointer',
                    transition: 'background 0.1s',
                  }}
                >
                  {/* Date number */}
                  <div style={{ marginBottom: 4, textAlign: 'right', paddingRight: 2 }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 22, height: 22, borderRadius: '50%',
                      background: isToday ? 'var(--accent)' : 'transparent',
                      fontSize: 12,
                      fontWeight: isToday ? 700 : isSameDay(day, selectedDay || 0) ? 600 : 400,
                      color: isToday ? '#fff' : 'var(--text2)',
                    }}>
                      {format(day, 'd')}
                    </span>
                  </div>

                  {/* Event pills */}
                  {dayEvents.slice(0, 3).map((ev, j) => {
                    const cat = ev.project?.category
                    const isDragging = draggedId === ev.id
                    return (
                      <div key={j}
                        draggable
                        onDragStart={e => {
                          e.stopPropagation()
                          setDraggedId(ev.id)
                          e.dataTransfer.effectAllowed = 'move'
                          e.dataTransfer.setData('text/plain', ev.id)   // Firefox needs data set to initiate drag
                        }}
                        onDragEnd={() => { setDraggedId(null); setDragOverIso(null) }}
                        style={{
                          fontSize: 10, fontWeight: 500,
                          padding: '2px 5px', borderRadius: 4, marginBottom: 2,
                          borderLeft: `3px solid ${catColor(cat)}`,
                          background: 'var(--bg3)', color: 'var(--text2)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          cursor: 'grab',
                          opacity: isDragging ? 0.4 : 1,
                        }} title={`${ev.project?.name || ''} — ${ev.name}`}>
                        {ev.project?.name ? `${ev.project.name}: ` : ''}{ev.name}
                      </div>
                    )
                  })}
                  {dayEvents.length > 3 && (
                    <div style={{ fontSize: 10, color: 'var(--text3)', paddingLeft: 4 }}>
                      +{dayEvents.length - 3} more
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
        )}

        {view === 'week' && (
          <div className="card">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
              {Array.from({ length: 7 }, (_, k) => addDays(startOfWeek(current), k)).map((day, i) => {
                const dayIso     = format(day, 'yyyy-MM-dd')
                const dayEvents  = eventsOnDay(day)
                const isToday    = isSameDay(day, today)
                const isDragOver = dragOverIso === dayIso
                return (
                  <div key={i} {...dropProps(dayIso)}
                    style={{
                      minHeight: 340, padding: '8px 6px',
                      borderRight: i < 6 ? '1px solid var(--border)' : 'none',
                      background: isDragOver ? 'var(--accent-glow)' : 'var(--bg2)',
                      outline: isDragOver ? '2px dashed var(--accent)' : 'none', outlineOffset: -2,
                    }}>
                    <div style={{ textAlign: 'center', marginBottom: 8, fontSize: 12, fontWeight: 600, color: isToday ? 'var(--accent)' : 'var(--text2)' }}>
                      {format(day, 'EEE d')}
                    </div>
                    {dayEvents.map(ev => eventCard(ev))}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {view === 'day' && (() => {
          const dayIso     = format(current, 'yyyy-MM-dd')
          const dayEvents  = eventsOnDay(current)
          const isDragOver = dragOverIso === dayIso
          return (
            <div className="card">
              <div style={{ padding: '12px 16px', textAlign: 'center', fontSize: 15, fontWeight: 700, borderBottom: '1px solid var(--border)', background: 'var(--bg3)' }}>
                {format(current, 'EEEE, MMMM d')}
              </div>
              <div {...dropProps(dayIso)}
                style={{
                  minHeight: 360, padding: '12px 16px',
                  background: isDragOver ? 'var(--accent-glow)' : 'var(--bg2)',
                  outline: isDragOver ? '2px dashed var(--accent)' : 'none', outlineOffset: -2,
                }}>
                {dayEvents.length === 0
                  ? <div style={{ color: 'var(--text3)', fontSize: 13, textAlign: 'center', padding: 20 }}>Nothing scheduled.</div>
                  : dayEvents.map(ev => eventCard(ev))}
              </div>
            </div>
          )
        })()}

        {/* Day detail panel */}
        {view === 'month' && selectedDay && (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-header">
              <span className="card-title">{format(selectedDay, 'EEEE, MMMM d')}</span>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                {selectedEvents.length} event{selectedEvents.length !== 1 ? 's' : ''}
              </span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setSelectedDay(null)}
                style={{ marginLeft: 'auto' }}
              >
                ✕
              </button>
            </div>

            {loading ? (
              <div style={{ padding: '20px', color: 'var(--text3)', fontSize: 13, textAlign: 'center' }}>Loading…</div>
            ) : selectedEvents.length === 0 ? (
              <div style={{ padding: '24px 20px', color: 'var(--text3)', fontSize: 13, textAlign: 'center' }}>
                No events scheduled for this day.
              </div>
            ) : selectedEvents.map((ev, i) => {
              const cat = ev.project?.category
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '12px 20px',
                  borderBottom: i < selectedEvents.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: catColor(cat), flexShrink: 0,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 2 }}>
                      {ev.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                      {ev.project?.name}{ev.project?.client?.company ? ` · ${ev.project.client.company}` : ''}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 600,
                    padding: '2px 8px', borderRadius: 20,
                    background: catColor(cat), color: 'var(--text)', flexShrink: 0,
                  }}>
                    {catLabel(cat)}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>
                    {ev.status || 'Open'}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
