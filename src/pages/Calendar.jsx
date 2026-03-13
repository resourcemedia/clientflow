import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { DEMO_CALENDAR_EVENTS, CHANNEL_COLORS } from '../lib/demo-data'
import { Modal, FormGroup } from '../components/ui'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay, parseISO } from 'date-fns'

const isDemo = !import.meta.env.VITE_SUPABASE_URL

export default function CalendarPage() {
  const [events, setEvents]         = useState([])
  const [loading, setLoading]       = useState(true)
  const [current, setCurrent]       = useState(new Date(2026, 2, 1)) // March 2026
  const [selectedDay, setSelectedDay] = useState(null)
  const [showModal, setShowModal]   = useState(false)
  const [channelFilter, setChannelFilter] = useState('all')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    if (isDemo) {
      setEvents(DEMO_CALENDAR_EVENTS)
    } else {
      const { data } = await supabase
        .from('calendar_events')
        .select('*, client:clients(company)')
        .order('event_date')
      setEvents(data || [])
    }
    setLoading(false)
  }

  const filtered = channelFilter === 'all'
    ? events
    : events.filter(e => e.channel === channelFilter)

  // Build calendar grid (6 rows × 7 days)
  const monthStart = startOfMonth(current)
  const monthEnd   = endOfMonth(current)
  const gridStart  = startOfWeek(monthStart)
  const gridEnd    = endOfWeek(monthEnd)
  const days = []
  let d = gridStart
  while (d <= gridEnd) { days.push(d); d = addDays(d, 1) }

  function eventsOnDay(day) {
    const iso = format(day, 'yyyy-MM-dd')
    return filtered.filter(e => e.event_date === iso)
  }

  const today = new Date(2026, 2, 13) // demo "today"

  return (
    <div className="fade-in">
      <div className="topbar">
        <div className="topbar-title">Content calendar</div>

        {/* Month nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setCurrent(m => subMonths(m, 1))}>←</button>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', minWidth: 110, textAlign: 'center' }}>
            {format(current, 'MMMM yyyy')}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => setCurrent(m => addMonths(m, 1))}>→</button>
        </div>

        {/* Channel filter */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {['all', 'social', 'email', 'print', 'web'].map(ch => {
            const col = CHANNEL_COLORS[ch]
            const isActive = channelFilter === ch
            return (
              <button
                key={ch}
                onClick={() => setChannelFilter(ch)}
                style={{
                  padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                  cursor: 'pointer', border: `1px solid ${isActive ? (col?.text || 'var(--accent)') : 'var(--border)'}`,
                  background: isActive ? (col?.bg || 'var(--accent-glow)') : 'transparent',
                  color: isActive ? (col?.text || 'var(--accent2)') : 'var(--text2)',
                  transition: 'all 0.15s',
                }}
              >
                {ch === 'all' ? 'All' : col?.label || ch}
              </button>
            )
          })}
        </div>

        <button className="btn btn-primary" onClick={() => { setSelectedDay(today); setShowModal(true) }}>
          + Add event
        </button>
      </div>

      <div className="page-content">
        <div className="card">
          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
              <div key={d} style={{ padding: '8px 10px', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text3)', textAlign: 'center' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 0 }}>
            {days.map((day, i) => {
              const dayEvents = eventsOnDay(day)
              const isThisMonth = isSameMonth(day, current)
              const isToday = isSameDay(day, today)
              const isSel = selectedDay && isSameDay(day, selectedDay)

              return (
                <div
                  key={i}
                  onClick={() => { setSelectedDay(day); if (dayEvents.length === 0) setShowModal(true) }}
                  style={{
                    minHeight: 90, padding: '8px 6px',
                    borderRight: (i + 1) % 7 !== 0 ? '1px solid var(--border)' : 'none',
                    borderBottom: i < days.length - 7 ? '1px solid var(--border)' : 'none',
                    background: isToday ? 'var(--accent-glow)' : isSel ? 'var(--bg3)' : 'var(--bg2)',
                    opacity: isThisMonth ? 1 : 0.35,
                    cursor: 'pointer', transition: 'background 0.1s',
                  }}
                >
                  <div style={{
                    fontSize: 12, fontWeight: isToday ? 700 : 500,
                    color: isToday ? 'var(--accent2)' : 'var(--text2)',
                    marginBottom: 4, textAlign: 'right', paddingRight: 4,
                  }}>
                    {format(day, 'd')}
                  </div>
                  {dayEvents.slice(0, 3).map((ev, j) => {
                    const col = CHANNEL_COLORS[ev.channel] || { bg: 'var(--bg4)', text: 'var(--text2)' }
                    return (
                      <div key={j} style={{
                        fontSize: 10, fontWeight: 500, padding: '2px 5px', borderRadius: 4, marginBottom: 2,
                        background: col.bg, color: col.text,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {ev.title}
                      </div>
                    )
                  })}
                  {dayEvents.length > 3 && (
                    <div style={{ fontSize: 10, color: 'var(--text3)', paddingLeft: 4 }}>+{dayEvents.length - 3} more</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Day detail panel — shows when a day with events is selected */}
        {selectedDay && eventsOnDay(selectedDay).length > 0 && (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-header">
              <span className="card-title">{format(selectedDay, 'EEEE, MMMM d')}</span>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>{eventsOnDay(selectedDay).length} event{eventsOnDay(selectedDay).length !== 1 ? 's' : ''}</span>
            </div>
            <div>
              {eventsOnDay(selectedDay).map((ev, i) => {
                const col = CHANNEL_COLORS[ev.channel] || { bg: 'var(--bg4)', text: 'var(--text2)', label: ev.channel }
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px', borderBottom: i < eventsOnDay(selectedDay).length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: col.text, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{ev.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{ev.client?.company}</div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: col.bg, color: col.text }}>
                      {col.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <AddEventModal
          defaultDate={selectedDay ? format(selectedDay, 'yyyy-MM-dd') : ''}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}

// ── ADD EVENT MODAL ────────────────────────────────────────────────────────────
function AddEventModal({ defaultDate, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: '', channel: 'social', event_date: defaultDate, status: 'scheduled',
  })
  const [saving, setSaving] = useState(false)
  function set(f) { return e => setForm(p => ({ ...p, [f]: e.target.value })) }

  async function save() {
    if (!form.title.trim()) return
    setSaving(true)
    if (!isDemo) await supabase.from('calendar_events').insert(form)
    setTimeout(() => { setSaving(false); onSaved() }, isDemo ? 400 : 0)
  }

  return (
    <Modal title="Add calendar event" onClose={onClose} footer={
      <>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Add event'}</button>
      </>
    }>
      <div className="form-grid">
        <FormGroup label="Event title" full>
          <input value={form.title} onChange={set('title')} placeholder="e.g. Arrow — FB post" />
        </FormGroup>
        <FormGroup label="Channel">
          <select value={form.channel} onChange={set('channel')}>
            <option value="social">Social media</option>
            <option value="email">Email</option>
            <option value="print">Print</option>
            <option value="web">Web / blog</option>
          </select>
        </FormGroup>
        <FormGroup label="Date">
          <input type="date" value={form.event_date} onChange={set('event_date')} />
        </FormGroup>
      </div>
    </Modal>
  )
}
