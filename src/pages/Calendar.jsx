import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { deleteItemCascade, getItemProofCount } from '../lib/items'
import { CATEGORY_COLORS, CATEGORY_LABELS, catColor, catLabel } from '../lib/categories'
import { Breadcrumb, NoteCell, Modal, FormGroup, EditableCell } from '../components/ui'
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  startOfYear, endOfYear,
  addDays, addMonths, subMonths, isSameMonth, isSameDay,
} from 'date-fns'

// The per-client hub project. Named with a leading dash so it sorts first
// alphabetically. If this convention changes, this is the only line to edit.
const TODO_PROJECT = '- ToDo'

export default function CalendarPage() {
  useEffect(() => { document.title = 'Calendar' }, [])
  const navigate  = useNavigate()
  const location  = useLocation()
  const [events, setEvents]           = useState([])
  const [loading, setLoading]         = useState(true)
  const [current, setCurrent]         = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(null)
  const [filterClient,  setFilterClient]  = useState(() => localStorage.getItem('cal_filterClient') || '')
  const [filterProject, setFilterProject] = useState(() => localStorage.getItem('cal_filterProject') ?? TODO_PROJECT)   // hub on first visit; ?? keeps a saved '' meaning "no filter"
  const [filterItem,    setFilterItem]    = useState('')
  const [filterTag,     setFilterTag]     = useState('')
  const [filterStatus,  setFilterStatus]  = useState('')
  const [draggedId,   setDraggedId]   = useState(null)
  const [dragOverIso, setDragOverIso] = useState(null)
  const [listDragIdx, setListDragIdx] = useState(null)   // List reorder (Priority mode)
  const [listOverIdx, setListOverIdx] = useState(null)
  const [cardOverId,  setCardOverId]  = useState(null)   // Day card reorder drop target
  const listDragFrom  = useRef(null)
  const reorderingRef = useRef(false)                     // re-entrancy guard
  const [view, setView] = useState(() => localStorage.getItem('cal_view') || 'list')   // 'day' | 'week' | 'month' | 'list'
  const [allProjects, setAllProjects] = useState([])   // full projects catalog, independent of items
  const [clients, setClients] = useState([])           // Add Item modal options
  const [showAddItem,   setShowAddItem]   = useState(false)
  const [npClientId,    setNpClientId]    = useState('')
  const [npProjectSel,  setNpProjectSel]  = useState('')   // project id, or '__new__'
  const [npNewProjName, setNpNewProjName] = useState('')
  const [npItemName,    setNpItemName]    = useState('')
  const [npDate,        setNpDate]        = useState('')   // optional — blank creates an unscheduled item
  const [dateStart, setDateStart] = useState('')   // List view range (yyyy-MM-dd)
  const [dateEnd,   setDateEnd]   = useState('')
  const [scope,     setScope]     = useState(() => localStorage.getItem('cal_scope') || 'all')  // List only: 'scheduled' | 'all'
  const [sortBy,    setSortBy]    = useState(() => localStorage.getItem('cal_sortBy') || 'client')     // List only: 'client' | 'date' | 'priority'
  const inFlightRef = useRef(new Set())

  // Remember where the user left off — mirrors the Tasks page's saved-state pattern
  useEffect(() => {
    localStorage.setItem('cal_view',          view)
    localStorage.setItem('cal_scope',         scope)
    localStorage.setItem('cal_sortBy',        sortBy)
    localStorage.setItem('cal_filterClient',  filterClient)
    localStorage.setItem('cal_filterProject', filterProject)
  }, [view, scope, sortBy, filterClient, filterProject])

  // Active clients for the Add Item modal — same query the Projects page uses
  useEffect(() => {
    supabase.from('clients').select('id, company, alias').eq('status', 'active').order('company')
      .then(({ data, error }) => {
        if (error) { console.error('clients load failed:', error); return }
        setClients(data || [])
      })
  }, [])

  // Dropdowns must reflect ALL projects, including ones with no items yet —
  // deriving them from loaded items would hide empty projects entirely.
  useEffect(() => {
    supabase
      .from('projects')
      .select('id, name, category, project_number, client_id, client:clients(company, alias)')
      .then(({ data, error }) => {
        if (error) { console.error('projects catalog load failed:', error); return }
        setAllProjects(data || [])
      })
  }, [])

  // Reschedule an item by drag-drop. Optimistic + rollback, single write, re-entrancy-guarded.
  async function moveItem(id, newDateIso) {
    if (!id || inFlightRef.current.has(id)) return       // guard: ignore concurrent fire on same item
    const item = events.find(e => e.id === id)
    const value = newDateIso || null                        // empty picker → back to backlog
    if (!item || item.scheduled_date === value) return      // missing or no-op (same day)
    const prevDate = item.scheduled_date

    inFlightRef.current.add(id)                            // LOCK synchronously, before any await
    setEvents(prev => prev.map(e => e.id === id ? { ...e, scheduled_date: value } : e))  // optimistic

    const { error } = await supabase
      .from('project_items')
      .update({ scheduled_date: value })
      .eq('id', id)

    if (error) {
      setEvents(prev => prev.map(e => e.id === id ? { ...e, scheduled_date: prevDate } : e))  // rollback
      console.error('Calendar move failed, reverted:', error)
    }
    inFlightRef.current.delete(id)                         // release
  }

  // Update item status inline (List). Flipping to Complete stamps completed_date (today,
  // local — UTC-safe via date-fns format); back to Open clears it. Optimistic + rollback,
  // re-entrancy-guarded (shares inFlightRef).
  async function updateItemStatus(id, newStatus) {
    if (!id || inFlightRef.current.has(id)) return
    const item = events.find(e => e.id === id)
    if (!item || item.status === newStatus) return
    const prev = { status: item.status, completed_date: item.completed_date }
    const newCompleted = newStatus === 'Complete' ? format(new Date(), 'yyyy-MM-dd') : null

    inFlightRef.current.add(id)
    setEvents(arr => arr.map(e => e.id === id ? { ...e, status: newStatus, completed_date: newCompleted } : e))

    const { error } = await supabase
      .from('project_items')
      .update({ status: newStatus, completed_date: newCompleted })
      .eq('id', id)

    if (error) {
      setEvents(arr => arr.map(e => e.id === id ? { ...e, status: prev.status, completed_date: prev.completed_date } : e))
      console.error('Status update failed, reverted:', error)
    }
    inFlightRef.current.delete(id)
  }

  // Edit an item's completion date inline (List). String in/out ('yyyy-MM-dd') — no Date
  // round-trip, so UTC-safe. Optimistic + rollback, re-entrancy-guarded (shares inFlightRef).
  async function updateCompletedDate(id, dateStr) {
    if (!id || inFlightRef.current.has(id)) return
    const item = events.find(e => e.id === id)
    if (!item) return
    const value = dateStr || null            // empty picker clears it
    if (item.completed_date === value) return
    const prev = item.completed_date

    inFlightRef.current.add(id)
    setEvents(arr => arr.map(e => e.id === id ? { ...e, completed_date: value } : e))

    const { error } = await supabase
      .from('project_items')
      .update({ completed_date: value })
      .eq('id', id)

    if (error) {
      setEvents(arr => arr.map(e => e.id === id ? { ...e, completed_date: prev } : e))
      console.error('Completion date update failed, reverted:', error)
    }
    inFlightRef.current.delete(id)
  }

  // Rename an item inline (List). Blank names are ignored — a name is required.
  // Optimistic + rollback, re-entrancy-guarded (shares inFlightRef).
  async function updateItemName(id, text) {
    if (!id || inFlightRef.current.has(id)) return
    const item = events.find(e => e.id === id)
    if (!item) return
    const value = text && text.trim() ? text.trim() : null
    if (!value || (item.name ?? '') === value) return
    const prev = item.name

    inFlightRef.current.add(id)
    setEvents(arr => arr.map(e => e.id === id ? { ...e, name: value } : e))

    const { error } = await supabase
      .from('project_items')
      .update({ name: value })
      .eq('id', id)
    if (error) {
      console.error('item rename failed:', error)
      setEvents(arr => arr.map(e => e.id === id ? { ...e, name: prev } : e))
    }
    inFlightRef.current.delete(id)
  }

  // Save an item's note inline (List). Empty note clears to null.
  // Optimistic + rollback, re-entrancy-guarded (shares inFlightRef).
  async function updateNote(id, text) {
    if (!id || inFlightRef.current.has(id)) return
    const item = events.find(e => e.id === id)
    if (!item) return
    const value = text && text.trim() ? text : null
    if ((item.note ?? null) === value) return
    const prev = item.note

    inFlightRef.current.add(id)
    setEvents(arr => arr.map(e => e.id === id ? { ...e, note: value } : e))

    const { error } = await supabase
      .from('project_items')
      .update({ note: value })
      .eq('id', id)

    if (error) {
      setEvents(arr => arr.map(e => e.id === id ? { ...e, note: prev } : e))
      console.error('Note update failed, reverted:', error)
    }
    inFlightRef.current.delete(id)
  }

  // ── List reorder (Priority mode) ────────────────────────────────────────────
  // The visible rows occupy a set of priority slots. Reorder the rows among
  // those SAME slots. Rows hidden by a filter keep their ranks untouched, so
  // reordering inside a client filter cannot corrupt the master ordering.
  // Permutes a SUBSET of rows among the priority slots they already occupy.
  // Rows outside `sourceRows` keep their ranks untouched. Used by the List
  // (all filtered rows) and by Day view (that one day's cards).
  async function reorderPriority(sourceRows, fromIdx, toIdx) {
    if (reorderingRef.current) return
    const rows  = [...sourceRows]
    const slots = rows.map(r => r.priority_order)   // ascending; NOT NULL by constraint
    if (slots.some(s => s == null)) {
      console.error('Reorder aborted: null priority_order in view')
      return
    }

    const [moved] = rows.splice(fromIdx, 1)
    rows.splice(toIdx, 0, moved)

    const changed = rows
      .map((row, k) => ({ row, next: slots[k] }))
      .filter(({ row, next }) => row.priority_order !== next)
    if (!changed.length) return

    reorderingRef.current = true                    // LOCK before any await
    const prev = events
    const byId = new Map(changed.map(({ row, next }) => [row.id, next]))
    setEvents(arr =>
      arr
        .map(e => (byId.has(e.id) ? { ...e, priority_order: byId.get(e.id) } : e))
        .sort((a, b) => a.priority_order - b.priority_order)
    )

    const results = await Promise.all(
      changed.map(({ row, next }) =>
        supabase.from('project_items').update({ priority_order: next }).eq('id', row.id)
      )
    )
    const failed = results.find(r => r.error)
    if (failed) {
      console.error('Priority reorder failed, reverted:', failed.error)
      setEvents(prev)
    }
    reorderingRef.current = false                   // release
  }

  function startListDrag(e, idx) {
    e.dataTransfer.effectAllowed = 'move'
    listDragFrom.current = idx
    setListDragIdx(idx)
  }
  function overListRow(e, idx) { e.preventDefault(); setListOverIdx(idx) }
  function endListDrag() {
    setListDragIdx(null); setListOverIdx(null); listDragFrom.current = null
  }
  function dropListRow(toIdx) {
    const fromIdx = listDragFrom.current
    endListDrag()
    if (fromIdx == null || fromIdx === toIdx) return
    reorderPriority(filtered, fromIdx, toIdx)
  }

  // View-aware navigation: month steps by month, week by 7 days, day by 1 day.
  function navPrev() { setCurrent(c => view === 'day' ? addDays(c, -1) : view === 'week' ? addDays(c, -7) : subMonths(c, 1)) }
  function navNext() { setCurrent(c => view === 'day' ? addDays(c, 1)  : view === 'week' ? addDays(c, 7)  : addMonths(c, 1)) }

  // Draggable item card + day drop-target props — shared by Week and Day views.
  // (Month view keeps its own inline copy; unify later if card styling changes.)
  function eventCard(ev, showNote = false, rows = null) {
    const cat        = ev.project?.category
    const isDragging = draggedId === ev.id
    const alias      = ev.project?.client?.alias || ev.project?.client?.company || ''
    const startDrag  = e => {
      e.stopPropagation()
      setDraggedId(ev.id)
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', ev.id)
    }
    const endDrag = () => { setDraggedId(null); setDragOverIso(null); setCardOverId(null) }

    // Card-on-card drop. stopPropagation keeps the day cell's onDrop from also
    // firing, so this handler must cover BOTH cases:
    //   same day      → reorder (priority_order)
    //   different day → reschedule onto this card's date (scheduled_date)
    // Without the cross-day branch, dropping onto an existing card in Week or
    // Month would silently do nothing.
    const dropOnCard = e => {
      e.preventDefault()
      e.stopPropagation()
      const dragged = draggedId
      const fromIdx = rows.findIndex(r => r.id === dragged)
      const toIdx   = rows.findIndex(r => r.id === ev.id)
      setCardOverId(null); setDraggedId(null); setDragOverIso(null)
      if (fromIdx < 0) {
        if (dragged && ev.scheduled_date) moveItem(dragged, ev.scheduled_date)
        return
      }
      if (toIdx < 0 || fromIdx === toIdx) return
      reorderPriority(rows, fromIdx, toIdx)
    }
    const dropTargetProps = rows ? {
      onDragOver: e => {
        e.preventDefault(); e.stopPropagation()
        if (draggedId && draggedId !== ev.id && cardOverId !== ev.id) setCardOverId(ev.id)
      },
      onDragLeave: () => setCardOverId(c => (c === ev.id ? null : c)),
      onDrop: dropOnCard,
    } : {}

    // The one card. Used by Day, Week, and Month.
    return (
      <div key={ev.id}
        onDragEnd={endDrag}
        {...dropTargetProps}
        style={{
          display: 'flex', alignItems: 'stretch',
          marginBottom: 8, borderRadius: 6, overflow: 'hidden',
          background: 'var(--bg3)',
          opacity: isDragging ? 0.4 : 1,
          // inset shadow, not a border — a border would shift the layout mid-drag
          boxShadow: cardOverId === ev.id ? 'inset 0 3px 0 0 var(--accent)' : 'none',
        }}
        title={`${ev.project?.name || ''} — ${ev.name}`}>

        <div
          draggable
          onDragStart={startDrag}
          title="Drag to reschedule"
          style={{
            flex: '0 0 18px', background: catColor(cat),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'grab', userSelect: 'none',
            fontSize: 11, color: 'rgba(0,0,0,0.35)',
          }}>⠿</div>

        <div style={{ flex: 1, minWidth: 0, padding: '8px 12px' }}>
          {alias && (
            <div style={{
              display: 'inline-block',
              padding: '1px 8px', marginBottom: 3,
              borderRadius: 4,
              background: catColor(cat),
              fontSize: 12, lineHeight: 1.45, fontWeight: 500,
              color: '#000',
            }}>{alias}</div>
          )}
          <div style={{
            fontSize: 12, lineHeight: 1.45, color: 'var(--text2)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{ev.project?.name}</div>
          <div style={{
            fontSize: 13, lineHeight: 1.5, fontWeight: 700, color: 'var(--text)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{ev.name}</div>
          {showNote && ev.note && (
            <div style={{
              fontSize: 12, lineHeight: 1.5, marginTop: 2,
              color: 'var(--text2)', whiteSpace: 'pre-wrap',
            }}>{ev.note}</div>
          )}
        </div>
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
  }, [current, location.pathname, view, dateStart, dateEnd, scope, sortBy])

  async function loadEvents() {
    setLoading(true)
    // Grid views load the visible month; List loads the date-range inputs (defaults to this year).
    let rangeStart, rangeEnd
    if (view === 'list') {
      rangeStart = dateStart || format(startOfYear(current), 'yyyy-MM-dd')
      rangeEnd   = dateEnd   || format(endOfYear(current),   'yyyy-MM-dd')
    } else {
      rangeStart = format(startOfWeek(startOfMonth(current)), 'yyyy-MM-dd')
      rangeEnd   = format(endOfWeek(endOfMonth(current)),     'yyyy-MM-dd')
    }
    let query = supabase
      .from('project_items')
      .select('id, project_id, name, scheduled_date, status, completed_date, note, priority_order, project:projects(name, category, tags, client:clients(company, alias))')

    if (view === 'list' && scope === 'all') {
      // A range comparison never matches NULL, so undated items are excluded by
      // .gte/.lte. OR them back in. They ignore the date range by definition.
      query = query.or(
        `and(scheduled_date.gte.${rangeStart},scheduled_date.lte.${rangeEnd}),scheduled_date.is.null`
      )
    } else {
      query = query.gte('scheduled_date', rangeStart).lte('scheduled_date', rangeEnd)
    }

    // Grid views always order by date. List honors the sort toggle.
    const byPriority = view === 'list' && sortBy === 'priority'
    const { data, error } = byPriority
      ? await query
          .order('priority_order', { ascending: true })
          .order('scheduled_date', { ascending: true, nullsFirst: false })
      : await query
          .order('scheduled_date', { ascending: true, nullsFirst: false })
          .order('priority_order', { ascending: true })

    if (error) console.error('calendar load error:', error)
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
  const clientOptions  = [...new Set(allProjects.map(p => p.client?.company).filter(Boolean))].sort()
  // When a client filter is active, the Project dropdown only offers that client's projects
  const projectOptions = [...new Set(
    allProjects
      .filter(p => !filterClient || p.client?.company === filterClient)
      .map(p => p.name)
      .filter(Boolean)
  )].sort()
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

  // Client sort — the hub's default order: category, then client alias, then priority.
  // Done client-side because category and alias live on joined tables, where
  // server-side .order() across nested joins gets unwieldy.
  const CATEGORY_SORT = ['primary', 'secondary', 'accounting', 'overhead', 'charity', 'personal']
  const catRank = c => { const i = CATEGORY_SORT.indexOf(c); return i === -1 ? 999 : i }
  const listRows = (view === 'list' && sortBy === 'client')
    ? [...filtered].sort((a, b) => {
        const cr = catRank(a.project?.category) - catRank(b.project?.category)
        if (cr !== 0) return cr
        const aa = (a.project?.client?.alias || a.project?.client?.company || '').toLowerCase()
        const ab = (b.project?.client?.alias || b.project?.client?.company || '').toLowerCase()
        if (aa !== ab) return aa < ab ? -1 : 1
        const pa = (a.project?.name || '').toLowerCase()
        const pb = (b.project?.name || '').toLowerCase()
        if (pa !== pb) return pa < pb ? -1 : 1
        // Date within project — undated items float to the top: they may need
        // doing first, or can be quickly tagged to today.
        if (a.scheduled_date !== b.scheduled_date) {
          if (!a.scheduled_date) return -1
          if (!b.scheduled_date) return 1
          return a.scheduled_date < b.scheduled_date ? -1 : 1
        }
        const na = (a.name || '').toLowerCase()
        const nb = (b.name || '').toLowerCase()
        if (na !== nb) return na < nb ? -1 : 1
        return (a.priority_order ?? 0) - (b.priority_order ?? 0)
      })
    : filtered

  const anyFilterActive = filterClient || filterProject || filterItem || filterTag || filterStatus
  async function handleAddItem() {
    const itemName = npItemName.trim()
    if (!itemName || !npClientId) return
    const creatingProject = npProjectSel === '__new__'
    const newProjName = npNewProjName.trim()
    if (creatingProject ? !newProjName : !npProjectSel) return

    let project
    if (creatingProject) {
      const nums = allProjects.map(p => parseInt(p.project_number, 10)).filter(n => !isNaN(n))
      const nextNumber = nums.length ? String(Math.max(...nums) + 1) : '1000'
      const { data, error } = await supabase
        .from('projects')
        .insert({
          name:           newProjName,
          client_id:      npClientId,
          project_number: nextNumber,
          category:       'primary',
          priority:       'Normal',
          proof_status:   'Open',
          inv_status:     'Open',
          collect_status: 'Open',
        })
        .select('id, name, category, project_number, client_id, client:clients(company, alias)')
        .single()
      if (error) { console.error('project insert failed:', error); return }
      project = data
      setAllProjects(prev => [...prev, data])
    } else {
      project = allProjects.find(p => p.id === npProjectSel)
      if (!project) return
    }

    // item_number continues the project's sequence — mirrors Projects.jsx addProjectItem.
    // priority_order is assigned by the DB trigger; scheduled_date stays null (unscheduled).
    const { count } = await supabase
      .from('project_items')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', project.id)
    const itemNumber = String((count || 0) + 1).padStart(2, '0')

    const { error: itemError } = await supabase
      .from('project_items')
      .insert({ project_id: project.id, item_number: itemNumber, name: itemName, status: 'Open', scheduled_date: npDate || null })
    if (itemError) { console.error('item insert failed:', itemError); return }

    // Inset stays open for rapid entry — item name clears, everything else is sticky.
    // After creating a new project, the select switches to it for subsequent saves.
    setNpItemName('')
    if (creatingProject) { setNpProjectSel(project.id); setNpNewProjName('') }
    // Land on the project so the new item is immediately visible
    setFilterClient(project.client?.company || '')
    setFilterProject(project.name)
    loadEvents()
  }

  function clearFilters() {
    setFilterClient(''); setFilterProject(''); setFilterItem(''); setFilterTag(''); setFilterStatus('')
    setDateStart(''); setDateEnd('')
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

  // ── Delete ────────────────────────────────────────────────────────────
  async function deleteItem(ev) {
    const proofCount = await getItemProofCount(ev.id)
    const warning = proofCount > 0
      ? `\n\nThis will also permanently delete ${proofCount} proof${proofCount === 1 ? '' : 's'}, their comments, and any uploaded images.`
      : ''
    if (!window.confirm(`Delete "${ev.name}"?${warning}\n\nThis cannot be undone.`)) return

    const prev = events
    setEvents(arr => arr.filter(e => e.id !== ev.id))   // optimistic
    const { error } = await deleteItemCascade(ev.id)
    if (error) {
      console.error('Delete failed, reverted:', error)
      setEvents(prev)
    }
  }

  return (
    <div className="fade-in">
      <div className="topbar">
        {/* Plain wrapper: .breadcrumb's flex:1 only applies as a direct child of the
            flex topbar, so this div keeps the title compact and the toggles flush left */}
        <div>
          <Breadcrumb segments={[
            { label: 'Dashboard', onClick: () => navigate('/') },
            { label: 'Calendar' },
          ]} />
        </div>

        {/* View toggle */}
        <div style={{ display: 'flex', gap: 4, marginLeft: 12 }}>
          {[['list','List'],['day','Day'],['week','Week'],['month','Month']].map(([v, label]) => (
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

        {/* ToDo hub shortcut — active exactly when filters equal the hub state */}
        {view === 'list' && (
          <>
            <div style={{ width: 1, height: 22, background: 'var(--border)', margin: '0 4px' }} />
            <button
              onClick={() => {
                if (filterProject === TODO_PROJECT && !filterClient) { setFilterProject('') }
                else { setFilterClient(''); setFilterProject(TODO_PROJECT) }
              }}
              style={{
                padding: '4px 11px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                border: '1px solid var(--border)',
                background: (filterProject === TODO_PROJECT && !filterClient) ? 'var(--bg4)' : 'transparent',
                color: (filterProject === TODO_PROJECT && !filterClient) ? 'var(--text)' : 'var(--text2)',
              }}>
              ToDo
            </button>
          </>
        )}

        {/* Sort toggle — List only. Drag-to-reorder is enabled in Priority mode. */}
        {view === 'list' && (
          <>
            <div style={{ width: 1, height: 22, background: 'var(--border)', margin: '0 4px' }} />
            <div style={{ display: 'flex', gap: 4 }}>
              {[['priority','Priority'],['date','Date'],['client','Client']].map(([s, label]) => (
                <button key={s} onClick={() => setSortBy(s)}
                  style={{
                    padding: '4px 11px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    border: '1px solid var(--border)',
                    background: sortBy === s ? 'var(--bg4)' : 'transparent',
                    color: sortBy === s ? 'var(--text)' : 'var(--text2)',
                  }}>
                  {label}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Scope toggle — List only. Grid views have no cell for an undated item. */}
        {view === 'list' && (
          <>
            <div style={{ width: 1, height: 22, background: 'var(--border)', margin: '0 4px' }} />
            <div style={{ display: 'flex', gap: 4 }}>
              {[['all','All'],['scheduled','Scheduled']].map(([s, label]) => (
                <button key={s} onClick={() => setScope(s)}
                  style={{
                    padding: '4px 11px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    border: '1px solid var(--border)',
                    background: scope === s ? 'var(--bg4)' : 'transparent',
                    color: scope === s ? 'var(--text)' : 'var(--text2)',
                  }}>
                  {label}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Add Item — List only, far right. Opens preloaded with the current drill context. */}
        {view === 'list' && (
          <button className="btn btn-primary" style={{ marginLeft: 'auto' }}
            onClick={() => {
              const cur = clients.find(c => c.company === filterClient)
              setNpClientId(cur?.id || '')
              const curProj = cur && filterProject
                ? allProjects.find(p => p.client_id === cur.id && p.name === filterProject)
                : null
              setNpProjectSel(curProj?.id || '')
              setShowAddItem(true)
            }}>
            Add Item
          </button>
        )}

        {/* Date navigation (view-aware) — hidden in List; date inputs drive that view */}
        {view !== 'list' && (
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
        )}
      </div>

      {/* Filter bar — attribute filters, stack as AND. Date range lives in List view. */}
      <div style={{
        display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
        padding: '10px 0', marginBottom: 4,
      }}>
        <select value={filterClient}
          onChange={e => { setFilterClient(e.target.value); setFilterProject('') }}
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

        {view === 'list' && (
          <>
            <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)}
              style={{ ...filterCtrl, cursor: 'text' }} title="Date start" />
            <input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)}
              style={{ ...filterCtrl, cursor: 'text' }} title="Date end" />
          </>
        )}

        <button onClick={clearFilters}
          style={{ ...filterCtrl, color: 'var(--text3)', cursor: 'pointer', border: 'none', background: 'transparent' }}>
          Clear
        </button>
      </div>

      {/* Add Item inset — a horizontal pre-row above the table */}
      {view === 'list' && showAddItem && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          margin: '12px 28px 0', padding: '12px 16px',
          background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12,
        }}
          onKeyDown={e => { if (e.key === 'Escape') setShowAddItem(false) }}>
          <input type="date" value={npDate} onChange={e => setNpDate(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 13 }} />
          <select value={npClientId}
            onChange={e => { setNpClientId(e.target.value); setNpProjectSel('') }}
            style={{ flex: '1 1 160px', minWidth: 140, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 13 }}>
            <option value="">Client</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.company}</option>)}
          </select>
          <select value={npProjectSel} onChange={e => setNpProjectSel(e.target.value)}
            disabled={!npClientId}
            style={{ flex: '1 1 160px', minWidth: 140, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 13 }}>
            <option value="">Project Name</option>
            {allProjects
              .filter(p => p.client_id === npClientId)
              .sort((a, b) => a.name.localeCompare(b.name))
              .map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            <option value="__new__">+ New project…</option>
          </select>
          {npProjectSel === '__new__' && (
            <input value={npNewProjName} onChange={e => setNpNewProjName(e.target.value)}
              placeholder="New project name" autoFocus
              style={{ flex: '1 1 160px', minWidth: 140, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 13, boxSizing: 'border-box' }} />
          )}
          <input value={npItemName} onChange={e => setNpItemName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddItem() }}
            placeholder="Item" autoFocus
            style={{ flex: '2 1 200px', minWidth: 160, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 13, boxSizing: 'border-box' }} />
          <button className="btn btn-primary" onClick={handleAddItem}
            disabled={!npItemName.trim() || !npClientId
              || (npProjectSel === '__new__' ? !npNewProjName.trim() : !npProjectSel)}>
            Save
          </button>
        </div>
      )}

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
                    minHeight: 130, padding: '8px 6px',
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

                  {/* Event cards — same component as Day/Week, no note */}
                  {dayEvents.slice(0, 3).map(ev => eventCard(ev, false, dayEvents))}
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
                    {dayEvents.map(ev => eventCard(ev, false, dayEvents))}
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
                  : dayEvents.map(ev => eventCard(ev, true, dayEvents))}
              </div>
            </div>
          )
        })()}

        {view === 'list' && (
          <div className="card" style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--bg3)' }}>
                  <th style={{ width: 28, padding: '10px 0 10px 14px' }}></th>
                  {['Date','Client','Project','Item','Note','Tags','Status'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text3)' }}>{h}</th>
                  ))}
                  <th style={{ width: 44 }}></th>
                </tr>
              </thead>
              <tbody>
                {listRows.length === 0 ? (
                  <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
                    {scope === 'all' ? 'No items match these filters.' : 'No items in this range.'}
                  </td></tr>
                ) : listRows.map((ev, idx) => {
                  const cat     = ev.project?.category
                  const company  = ev.project?.client?.company || ''
                  const alias    = ev.project?.client?.alias || company
                  const projName = ev.project?.name || ''
                  const projActive = projName && filterProject === projName && filterClient === company
                  const canDrag = sortBy === 'priority'
                  const compFmt  = ev.completed_date ? format(new Date(ev.completed_date + 'T00:00:00'), 'M/d/yy') : ''
                  return (
                    <tr key={ev.id}
                      onDragOver={canDrag ? (e => overListRow(e, idx)) : undefined}
                      onDrop={canDrag ? (() => dropListRow(idx)) : undefined}
                      onDragEnd={canDrag ? endListDrag : undefined}
                      style={{
                        borderTop: listOverIdx === idx && listDragIdx !== idx
                          ? '2px solid var(--accent)' : '1px solid var(--border)',
                        opacity: listDragIdx === idx ? 0.4 : 1,
                      }}>
                      {/* height:1px on the td + height:100% on the child is the standard
                          trick to make a div fill a table row's actual height. */}
                      <td style={{ width: 26, height: 1, padding: '4px 0 4px 12px' }}>
                        <div
                          draggable={canDrag}
                          onDragStart={canDrag ? (e => startListDrag(e, idx)) : undefined}
                          title={canDrag ? 'Drag to reorder priority' : 'Switch sort to Priority to reorder'}
                          style={{
                            width: 18, height: '100%', minHeight: 30,
                            borderRadius: 4,
                            background: catColor(cat),
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, userSelect: 'none',
                            cursor: canDrag ? 'grab' : 'default',
                            color: canDrag ? 'rgba(0,0,0,0.35)' : 'transparent',
                          }}>
                          ⠿
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        <input type="date"
                          value={ev.scheduled_date || ''}
                          onChange={e => moveItem(ev.id, e.target.value)}
                          style={{
                            padding: '3px 6px', borderRadius: 6, fontSize: 13,
                            border: '1px solid var(--border)',
                            background: ev.scheduled_date ? 'var(--bg4)' : 'transparent',
                            color: ev.scheduled_date ? 'var(--text)' : 'var(--text3)',
                            cursor: 'text',
                          }}
                          title="Scheduled date — clear it to send this item back to the unscheduled backlog" />
                      </td>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        {company && (
                          <button
                            onClick={() => {
                              if (filterClient === company) { setFilterClient(''); setFilterProject(TODO_PROJECT) }
                              else { setFilterClient(company); setFilterProject('') }
                            }}
                            title={filterClient === company ? 'Back to ToDo hub' : `Show all ${alias} projects`}
                            style={{
                              width: 14, height: 14, borderRadius: '50%', marginRight: 8,
                              border: '1.5px solid var(--text3)', cursor: 'pointer', padding: 0,
                              background: filterClient === company ? 'var(--text3)' : 'transparent',
                              verticalAlign: 'middle',
                            }} />
                        )}
                        <span style={{
                          display: 'inline-block', width: 84, boxSizing: 'border-box',
                          padding: '3px 10px', borderRadius: 8, fontSize: 12,
                          background: catColor(cat), color: 'var(--text)', verticalAlign: 'middle',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>{alias || catLabel(cat)}</span>
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                        {projName && (
                          <button
                            onClick={() => {
                              if (projActive) { setFilterProject('') }
                              else { setFilterClient(company); setFilterProject(projName) }
                            }}
                            title={projActive ? 'Back to client list' : `Show only ${projName}`}
                            style={{
                              width: 14, height: 14, borderRadius: '50%', marginRight: 8,
                              border: '1.5px solid var(--text3)', cursor: 'pointer', padding: 0,
                              background: projActive ? 'var(--text3)' : 'transparent',
                              verticalAlign: 'middle',
                            }} />
                        )}
                        <span style={{ verticalAlign: 'middle' }}>{projName || '—'}</span>
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--text)', fontWeight: 500 }}>
                        <EditableCell value={ev.name} onSave={text => updateItemName(ev.id, text)} />
                      </td>
                      <td style={{ padding: '10px 14px', minWidth: 180, verticalAlign: 'top' }}>
                        <NoteCell value={ev.note} onSave={text => updateNote(ev.id, text)} textColor="var(--text)" />
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        {(ev.project?.tags || []).map(t => (
                          <span key={t} style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, background: 'var(--bg4)', color: 'var(--text2)', marginRight: 4 }}>{t}</span>
                        ))}
                      </td>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        <select value={ev.status || 'Open'} onChange={e => updateItemStatus(ev.id, e.target.value)}
                          style={{
                            padding: '3px 8px', borderRadius: 6, fontSize: 13, cursor: 'pointer',
                            border: '1px solid var(--border)', background: 'var(--bg2)',
                            color: ev.status === 'Complete' ? 'var(--green)' : 'var(--text2)',
                            fontWeight: ev.status === 'Complete' ? 600 : 400,
                          }}>
                          <option value="Open">Open</option>
                          <option value="Complete">Complete</option>
                        </select>
                        {ev.status === 'Complete' && (
                          <input type="date"
                            value={ev.completed_date || ''}
                            onChange={e => updateCompletedDate(ev.id, e.target.value)}
                            style={{
                              marginLeft: 8, padding: '2px 6px', borderRadius: 6, fontSize: 12,
                              border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text2)',
                              cursor: 'text',
                            }} title="Completion date — edit if you finished on a different day" />
                        )}
                      </td>
                      <td style={{ width: 44, padding: '10px 14px 10px 0', textAlign: 'center' }}>
                        <button
                          onClick={() => deleteItem(ev)}
                          title="Delete item"
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            padding: 4, lineHeight: 0, color: 'var(--text3)',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)' }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text3)' }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6" />
                            <path d="M10 11v6M14 11v6" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

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
