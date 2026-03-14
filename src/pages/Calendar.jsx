import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isSameMonth, isSameDay,
} from 'date-fns'

// Covers both auto-populated channels (product_type: CO/ST/DS/OH)
// and legacy manual channels (social/email/print/web)
const CHANNEL_COLORS = {
  CO:     { bg: 'var(--accent-glow)', text: 'var(--accent2)', label: 'Content'  },
  ST:     { bg: 'var(--blue-bg)',     text: 'var(--blue)',    label: 'Setup'    },
  DS:     { bg: 'var(--coral-bg)',    text: 'var(--coral)',   label: 'Design'   },
  OH:     { bg: 'var(--bg4)',         text: 'var(--text3)',   label: 'Overhead' },
  social: { bg: 'var(--accent-glow)', text: 'var(--accent2)', label: 'Social'  },
  email:  { bg: 'var(--amber-bg)',    text: 'var(--amber)',   label: 'Email'    },
  print:  { bg: 'var(--coral-bg)',    text: 'var(--coral)',   label: 'Print'    },
  web:    { bg: 'var(--green-bg)',    text: 'var(--green)',   label: 'Web'      },
}

const FILTER_CHANNELS = [
  { id: 'all', label: 'All' },
  { id: 'CO',  label: 'Content'  },
  { id: 'ST',  label: 'Setup'    },
  { id: 'DS',  label: 'Design'   },
  { id: 'OH',  label: 'Overhead' },
]

function colorFor(channel) {
  return CHANNEL_COLORS[channel] || { bg: 'var(--bg4)', text: 'var(--text2)', label: channel || '—' }
}

export default function CalendarPage() {
  const [events, setEvents]           = useState([])
  const [loading, setLoading]         = useState(true)
  const [current, setCurrent]         = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(null)
  const [channelFilter, setChannelFilter] = useState('all')

  useEffect(() => {
    loadEvents()
    setSelectedDay(null)
  }, [current])

  async function loadEvents() {
    setLoading(true)
    const rangeStart = format(startOfMonth(current), 'yyyy-MM-dd')
    const rangeEnd   = format(endOfMonth(current),   'yyyy-MM-dd')
    const { data } = await supabase
      .from('calendar_events')
      .select('*, client:clients(company)')
      .gte('event_date', rangeStart)
      .lte('event_date', rangeEnd)
      .order('event_date')
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

  const filtered = channelFilter === 'all'
    ? events
    : events.filter(e => e.channel === channelFilter)

  function eventsOnDay(day) {
    const iso = format(day, 'yyyy-MM-dd')
    return filtered.filter(e => e.event_date === iso)
  }

  const today            = new Date()
  const selectedEvents   = selectedDay ? eventsOnDay(selectedDay) : []

  return (
    <div className="fade-in">
      <div className="topbar">
        <div className="topbar-title">Content calendar</div>

        {/* Channel filter pills */}
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          {FILTER_CHANNELS.map(ch => {
            const col     = CHANNEL_COLORS[ch.id]
            const isActive = channelFilter === ch.id
            return (
              <button
                key={ch.id}
                onClick={() => setChannelFilter(ch.id)}
                style={{
                  padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                  cursor: 'pointer', border: `1px solid ${isActive ? (col?.text || 'var(--accent)') : 'var(--border)'}`,
                  background: isActive ? (col?.bg || 'var(--accent-glow)') : 'transparent',
                  color: isActive ? (col?.text || 'var(--accent2)') : 'var(--text2)',
                  transition: 'all 0.15s',
                }}
              >
                {ch.label}
              </button>
            )
          })}
        </div>

        {/* Month navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setCurrent(m => subMonths(m, 1))}>←</button>
          <span style={{
            fontSize: 14, fontWeight: 600, color: 'var(--text)',
            minWidth: 120, textAlign: 'center',
          }}>
            {format(current, 'MMMM yyyy')}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => setCurrent(m => addMonths(m, 1))}>→</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setCurrent(new Date())}>Today</button>
        </div>
      </div>

      <div className="page-content">
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

              return (
                <div
                  key={i}
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                  style={{
                    minHeight: 90, padding: '8px 6px',
                    borderRight:  hasBorderR ? '1px solid var(--border)' : 'none',
                    borderBottom: hasBorderB ? '1px solid var(--border)' : 'none',
                    borderLeft:   isSelected ? '2px solid var(--accent)' : '2px solid transparent',
                    background: isToday
                      ? 'var(--accent-glow)'
                      : isSelected ? 'var(--bg3)' : 'var(--bg2)',
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
                    const c = colorFor(ev.channel)
                    return (
                      <div key={j} style={{
                        fontSize: 10, fontWeight: 500,
                        padding: '2px 5px', borderRadius: 4, marginBottom: 2,
                        background: c.bg, color: c.text,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }} title={ev.title}>
                        {ev.title}
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

        {/* Day detail panel */}
        {selectedDay && (
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
              const c = colorFor(ev.channel)
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '12px 20px',
                  borderBottom: i < selectedEvents.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: c.text, flexShrink: 0,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 2 }}>
                      {ev.title}
                    </div>
                    {ev.client?.company && (
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{ev.client.company}</div>
                    )}
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 600,
                    padding: '2px 8px', borderRadius: 20,
                    background: c.bg, color: c.text, flexShrink: 0,
                  }}>
                    {c.label}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>
                    {ev.status || 'scheduled'}
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
