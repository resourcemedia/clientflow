import { useState, useEffect, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts'
import { supabase } from '../lib/supabase'
import { toLocalISO, todayISO, enrichEntries } from '../lib/timeentries'
import { windowStats, computeAnnualProjection, buildYearEndSeries, buildRunRateSeries, buildDailyHoursSeries } from '../lib/projections'
import { usePaceTargets } from '../lib/config'

const isDemo = !import.meta.env.VITE_SUPABASE_URL
const SELECT = '*, project:projects(id, name, project_number, category, client:clients(id, company, alias))'

function fmtUSD(n) { return '$' + Math.round(n || 0).toLocaleString('en-US') }
function fmtAxisMonth(ms) { return new Date(ms).toLocaleDateString('en-US', { month: 'short' }) }
function fmtK(v) { return '$' + Math.round(v / 1000) + 'k' }
function fmtTipDate(ms) { return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }
function fmtAxisDay(ms) { const d = new Date(ms); return (d.getMonth() + 1) + '/' + d.getDate() }

export default function PacePage() {
  useEffect(() => { document.title = 'Pace' }, [])
  const { goal } = usePaceTargets()
  const [statsEntries, setStatsEntries] = useState([])
  const [ytdEntries,   setYtdEntries]   = useState([])
  const [loading,      setLoading]      = useState(true)
  const [hoursStart,   setHoursStart]   = useState('')
  const [hoursEnd,     setHoursEnd]     = useState('')

  useEffect(() => {
    if (isDemo) { setLoading(false); return }
    const today = todayISO()
    const d = new Date(today + 'T00:00:00')
    d.setDate(d.getDate() - 28)
    const startISO = toLocalISO(d)
    const jan1 = toLocalISO(new Date(new Date().getFullYear(), 0, 1))
    Promise.all([
      supabase.from('time_entries').select(SELECT).gte('date', startISO).lt('date', today).order('date').order('start_time'),
      supabase.from('time_entries').select(SELECT).gte('date', jan1).lt('date', today).order('date').order('start_time'),
    ]).then(([a, b]) => {
      setStatsEntries(a.data || [])
      setYtdEntries(b.data || [])
      setLoading(false)
    })
  }, [])

  const enriched    = useMemo(() => enrichEntries(statsEntries), [statsEntries])
  const ytdEnriched = useMemo(() => enrichEntries(ytdEntries),   [ytdEntries])

  const today   = todayISO()
  const stats7  = windowStats(enriched, 7, today)
  const stats28 = windowStats(enriched, 28, today)
  const proj    = computeAnnualProjection({ ytdEnriched, sevenAvg: stats7.billAvg, twentyEightAvg: stats28.billAvg })
  const yearEnd = useMemo(() => buildYearEndSeries(ytdEnriched, proj), [ytdEnriched, proj.A, proj.B, proj.C])
  const runRate = useMemo(() => buildRunRateSeries(ytdEnriched), [ytdEnriched])
  const dailyHours = useMemo(() => buildDailyHoursSeries(ytdEnriched, hoursStart, hoursEnd), [ytdEnriched, hoursStart, hoursEnd])

  const TH = { textAlign: 'right', fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text3)', paddingBottom: 6 }
  const TD = { textAlign: 'right', fontSize: 17, fontWeight: 700, fontFamily: 'DM Mono, monospace', color: 'var(--text)', padding: '3px 0' }
  const LB = { fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text3)', padding: '3px 12px 3px 0' }

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 16 }}>Pace</h1>
      {loading ? (
        <div style={{ color: 'var(--text3)' }}>Loading…</div>
      ) : (
        <div>
        <div className="card" style={{ padding: 16, marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text3)', marginBottom: 12 }}>How the Year Ends</div>
          <ResponsiveContainer width="100%" height={360}>
            <LineChart data={yearEnd.data} margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" dataKey="t" scale="time" domain={yearEnd.domain} ticks={yearEnd.monthTicks} tickFormatter={fmtAxisMonth} tick={{ fontSize: 11, fill: 'var(--text3)' }} />
              <YAxis tickFormatter={fmtK} width={48} tick={{ fontSize: 11, fill: 'var(--text3)' }} />
              <Tooltip labelFormatter={fmtTipDate} formatter={(v, name) => [v == null ? '—' : fmtUSD(v), name]} />
              <Legend payload={[
                { value: 'Banked',      type: 'line', id: 'banked',  color: '#185FA5' },
                { value: 'YTD pace',    type: 'line', id: 'ytdProj', color: '#94a3b8' },
                { value: '28-day pace', type: 'line', id: 'proj28',  color: '#BA7517' },
                { value: '7-day pace',  type: 'line', id: 'proj7',   color: '#D85A30' },
              ]} />
              <ReferenceLine y={goal} stroke="#16a34a" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: 'Goal', position: 'insideTopRight', fill: '#16a34a', fontSize: 11 }} />
              <Line type="linear" dataKey="banked"  name="Banked"      stroke="#185FA5" strokeWidth={2}   dot={false} connectNulls={false} isAnimationActive={false} />
              <Line type="linear" dataKey="ytdProj" name="YTD pace"    stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 4" dot={false} connectNulls={false} isAnimationActive={false} />
              <Line type="linear" dataKey="proj28"  name="28-day pace" stroke="#BA7517" strokeWidth={1.5} strokeDasharray="5 4" dot={false} connectNulls={false} isAnimationActive={false} />
              <Line type="linear" dataKey="proj7"   name="7-day pace"  stroke="#D85A30" strokeWidth={1.5} strokeDasharray="5 4" dot={false} connectNulls={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="card" style={{ padding: 16, marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text3)', marginBottom: 12 }}>Rolling 12-Month Pace</div>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={runRate.data} margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" dataKey="t" scale="time" domain={runRate.domain} ticks={runRate.monthTicks} tickFormatter={fmtAxisMonth} tick={{ fontSize: 11, fill: 'var(--text3)' }} />
              <YAxis tickFormatter={fmtK} width={48} domain={['auto', 'auto']} tick={{ fontSize: 11, fill: 'var(--text3)' }} />
              <Tooltip labelFormatter={fmtTipDate} formatter={(v, name) => [v == null ? '—' : fmtUSD(v), name]} />
              <Legend payload={[
                { value: 'YTD pace',    type: 'line', id: 'rateYtd', color: '#94a3b8' },
                { value: '28-day pace', type: 'line', id: 'rate28',  color: '#BA7517' },
                { value: '7-day pace',  type: 'line', id: 'rate7',   color: '#D85A30' },
              ]} />
              <Line type="linear" dataKey="rateYtd" name="YTD pace"    stroke="#94a3b8" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              <Line type="linear" dataKey="rate28"  name="28-day pace" stroke="#BA7517" strokeWidth={2}   dot={false} isAnimationActive={false} />
              <Line type="linear" dataKey="rate7"   name="7-day pace"  stroke="#D85A30" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="card" style={{ padding: 16, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text3)' }}>Billable Hours</div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="date" value={hoursStart} max={hoursEnd || undefined}
                onChange={e => setHoursStart(e.target.value)} style={{ width: 140, fontSize: 12 }} />
              <span style={{ color: 'var(--text3)', fontSize: 12 }}>→</span>
              <input type="date" value={hoursEnd} min={hoursStart || undefined}
                onChange={e => setHoursEnd(e.target.value)} style={{ width: 140, fontSize: 12 }} />
              {(hoursStart || hoursEnd) && (
                <button className="btn btn-sm btn-ghost" onClick={() => { setHoursStart(''); setHoursEnd('') }}>YTD</button>
              )}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={dailyHours.data} margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" dataKey="t" scale="time" domain={dailyHours.domain} ticks={dailyHours.ticks} tickFormatter={dailyHours.tickFmt === 'day' ? fmtAxisDay : fmtAxisMonth} tick={{ fontSize: 11, fill: 'var(--text3)' }} />
              <YAxis width={40} tick={{ fontSize: 11, fill: 'var(--text3)' }} />
              <Tooltip labelFormatter={fmtTipDate} formatter={(v) => [v == null ? '—' : `${v} hrs`, 'Billable']} />
              <Line type="linear" dataKey="hours" name="Billable hours" stroke="#185FA5" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="card" style={{ padding: '12px 16px', display: 'inline-block' }}>
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
                <td style={TD}>{fmtUSD(proj.A)}</td>
                <td style={{ ...TD, paddingLeft: 20 }}>{fmtUSD(proj.D)}</td>
                <td style={{ ...TD, paddingLeft: 20 }}>{fmtUSD(proj.G)}</td>
              </tr>
              <tr style={{ borderTop: '1px solid var(--border)' }}>
                <td style={LB}>28-Day Pace</td>
                <td style={TD}>{fmtUSD(proj.B)}</td>
                <td style={{ ...TD, paddingLeft: 20 }}>{fmtUSD(proj.E)}</td>
                <td style={{ ...TD, paddingLeft: 20 }}>{fmtUSD(proj.H)}</td>
              </tr>
              <tr style={{ borderTop: '1px solid var(--border)' }}>
                <td style={LB}>7-Day Pace</td>
                <td style={TD}>{fmtUSD(proj.C)}</td>
                <td style={{ ...TD, paddingLeft: 20 }}>{fmtUSD(proj.F)}</td>
                <td style={{ ...TD, paddingLeft: 20 }}>{fmtUSD(proj.I)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        </div>
      )}
    </div>
  )
}
