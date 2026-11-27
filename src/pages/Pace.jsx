import { useState, useEffect, useMemo } from 'react'
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts'
import { supabase } from '../lib/supabase'
import { toLocalISO, todayISO, enrichEntries } from '../lib/timeentries'
import { windowStats, computeAnnualProjection, buildYearEndSeries, buildRunRateSeries, buildDailyHoursSeries, buildCategoryHoursSeries, CATEGORY_SERIES } from '../lib/projections'
import { CATEGORY_COLORS } from '../lib/categories'
import { usePaceTargets } from '../lib/config'

const isDemo = !import.meta.env.VITE_SUPABASE_URL
const SELECT = '*, project:projects(id, name, project_number, category, client:clients(id, company, alias))'

function fmtUSD(n) { return '$' + Math.round(n || 0).toLocaleString('en-US') }
function fmtAxisMonth(ms) { return new Date(ms).toLocaleDateString('en-US', { month: 'short' }) }
function fmtK(v) { return '$' + Math.round(v / 1000) + 'k' }
function fmtTipDate(ms) { return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }
function fmtAxisDay(ms) { const d = new Date(ms); return (d.getMonth() + 1) + '/' + d.getDate() }
const CAT_NAMES = { primary: 'Primary', secondary: 'Secondary', charity: 'Charity', personal: 'Personal', accounting: 'Accounting', overhead: 'Overhead' }

export default function PacePage() {
  useEffect(() => { document.title = 'Pace' }, [])
  const { goal } = usePaceTargets()
  const [statsEntries, setStatsEntries] = useState([])
  const [ytdEntries,   setYtdEntries]   = useState([])
  const [loading,      setLoading]      = useState(true)
  const [hoursStart,   setHoursStart]   = useState('')
  const [hoursEnd,     setHoursEnd]     = useState('')
  const [hoursBucket,  setHoursBucket]  = useState(() => localStorage.getItem('pace_hoursBucket') || 'day')   // 'day' | 'week' | 'month'
  useEffect(() => { localStorage.setItem('pace_hoursBucket', hoursBucket) }, [hoursBucket])
  const [rateStart,    setRateStart]    = useState('')
  const [rateEnd,      setRateEnd]      = useState('')
  const [catBucket,    setCatBucket]    = useState(() => localStorage.getItem('pace_catBucket') || 'week')   // 'day' | 'week' | 'month'
  useEffect(() => { localStorage.setItem('pace_catBucket', catBucket) }, [catBucket])
  const [catStart,     setCatStart]     = useState('')
  const [catEnd,       setCatEnd]       = useState('')
  const [catHidden,    setCatHidden]    = useState(() => (localStorage.getItem('pace_catHidden') || '').split(',').filter(Boolean))   // categories switched off
  useEffect(() => { localStorage.setItem('pace_catHidden', catHidden.join(',')) }, [catHidden])
  const [catMode,      setCatMode]      = useState(() => localStorage.getItem('pace_catMode') || 'lines')   // 'lines' | 'stacked' | 'share'
  useEffect(() => { localStorage.setItem('pace_catMode', catMode) }, [catMode])
  const [primaryTarget, setPrimaryTarget] = useState(() => Number(localStorage.getItem('pace_primaryTarget')) || 40)   // Share view target line, % of shown hours
  useEffect(() => { localStorage.setItem('pace_primaryTarget', String(primaryTarget)) }, [primaryTarget])

  useEffect(() => {
    if (isDemo) { setLoading(false); return }
    const today = todayISO()
    const d = new Date(today + 'T00:00:00')
    d.setDate(d.getDate() - 28)
    const startISO = toLocalISO(d)
    const jan1 = toLocalISO(new Date(new Date().getFullYear(), 0, 1))
    // Supabase caps each response at 1000 rows (server max-rows). Page through in
    // 1000-row chunks so the YTD fetch doesn't silently drop the newest entries.
    // Same pattern as Timeboard's fetchAllEntries; order('id') keeps pages stable.
    const fetchAll = async (fromISO) => {
      const PAGE = 1000
      let all = [], from = 0
      while (true) {
        const { data, error } = await supabase.from('time_entries').select(SELECT)
          .gte('date', fromISO).lt('date', today)
          .order('date').order('start_time').order('id')
          .range(from, from + PAGE - 1)
        if (error) { console.error('[Pace] time_entries error:', error); break }
        all = all.concat(data || [])
        if (!data || data.length < PAGE) break
        from += PAGE
      }
      return all
    }
    Promise.all([fetchAll(startISO), fetchAll(jan1)]).then(([a, b]) => {
      setStatsEntries(a)
      setYtdEntries(b)
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
  const runRate = useMemo(() => buildRunRateSeries(ytdEnriched, rateStart, rateEnd), [ytdEnriched, rateStart, rateEnd])
  const dailyHours = useMemo(() => buildDailyHoursSeries(ytdEnriched, hoursStart, hoursEnd, hoursBucket), [ytdEnriched, hoursStart, hoursEnd, hoursBucket])
  const catHours   = useMemo(() => buildCategoryHoursSeries(ytdEnriched, catBucket, catStart, catEnd), [ytdEnriched, catBucket, catStart, catEnd])

  // Hover box for the category chart (all three modes): one row per shown category,
  // top band first to match the stack, each as hrs + % of shown hours, then a Total row.
  function renderCatTip({ active, label }) {
    const row = active && catHours.data.find(r => r.t === label)
    if (!row) return null
    const shown = CATEGORY_SERIES.filter(c => !catHidden.includes(c)).reverse()
    const total = shown.reduce((s, c) => s + (row[c] || 0), 0)
    const pct = v => total > 0 ? Math.round((v / total) * 100) : 0
    const hrs = v => Math.round(v * 100) / 100
    const title = catBucket === 'month'
      ? new Date(label).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : catBucket === 'week' ? 'Week of ' + fmtTipDate(label) : fmtTipDate(label)
    return (
      <div style={{ background: '#fff', border: '1px solid #ccc', padding: '8px 12px', fontSize: 13, lineHeight: 1.7, color: '#222' }}>
        <div style={{ fontWeight: 600, marginBottom: 2 }}>{title}</div>
        {shown.map(c => (
          <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: CATEGORY_COLORS[c], flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{CAT_NAMES[c]}</span>
            <span style={{ fontFamily: 'DM Mono, monospace', marginLeft: 16 }}>
              {catMode === 'share' ? `${pct(row[c] || 0)}% (${hrs(row[c] || 0)} hrs)` : `${hrs(row[c] || 0)} hrs (${pct(row[c] || 0)}%)`}
            </span>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, borderTop: '1px solid #ddd', marginTop: 4, paddingTop: 4, fontWeight: 700 }}>
          <span style={{ width: 10, flexShrink: 0 }} />
          <span style={{ flex: 1 }}>Total</span>
          <span style={{ fontFamily: 'DM Mono, monospace', marginLeft: 16 }}>{catMode === 'share' ? `100% (${hrs(total)} hrs)` : `${hrs(total)} hrs (100%)`}</span>
        </div>
      </div>
    )
  }

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text3)' }}>Rolling 12-Month Pace</div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="date" value={rateStart} max={rateEnd || undefined}
                onChange={e => setRateStart(e.target.value)} style={{ width: 140, fontSize: 12 }} />
              <span style={{ color: 'var(--text3)', fontSize: 12 }}>→</span>
              <input type="date" value={rateEnd} min={rateStart || undefined}
                onChange={e => setRateEnd(e.target.value)} style={{ width: 140, fontSize: 12 }} />
              {(rateStart || rateEnd) && (
                <button className="btn btn-sm btn-ghost" onClick={() => { setRateStart(''); setRateEnd('') }}>Reset</button>
              )}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={runRate.data} margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" dataKey="t" scale="time" domain={runRate.domain} ticks={runRate.ticks} tickFormatter={runRate.tickFmt === 'day' ? fmtAxisDay : fmtAxisMonth} tick={{ fontSize: 11, fill: 'var(--text3)' }} />
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
            <div style={{ display: 'flex', gap: 4 }}>
              {[['day', 'Day'], ['week', 'Week'], ['month', 'Month']].map(([b, label]) => (
                <button key={b} onClick={() => setHoursBucket(b)}
                  style={{
                    padding: '4px 11px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    border: '1px solid var(--border)',
                    background: hoursBucket === b ? 'var(--bg4)' : 'transparent',
                    color: hoursBucket === b ? 'var(--text)' : 'var(--text2)',
                  }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={dailyHours.data} margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" dataKey="t" scale="time" domain={dailyHours.domain} ticks={dailyHours.ticks} tickFormatter={dailyHours.tickFmt === 'day' ? fmtAxisDay : fmtAxisMonth} tick={{ fontSize: 11, fill: 'var(--text3)' }} />
              <YAxis width={40} tick={{ fontSize: 11, fill: 'var(--text3)' }} />
              <Tooltip
                labelFormatter={ms => hoursBucket === 'month'
                  ? new Date(ms).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                  : hoursBucket === 'week' ? 'Week of ' + fmtTipDate(ms) : fmtTipDate(ms)}
                formatter={(v) => [v == null ? '—' : `${v} hrs`, 'Billable']} />
              <Line type="linear" dataKey="hours" name="Billable hours" stroke="#185FA5" strokeWidth={hoursBucket === 'day' ? 1.5 : 2}
                dot={hoursBucket === 'month' ? { r: 3, fill: '#185FA5' } : false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="card" style={{ padding: 16, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text3)' }}>Hours by Category</div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="date" value={catStart} max={catEnd || undefined}
                onChange={e => setCatStart(e.target.value)} style={{ width: 140, fontSize: 12 }} />
              <span style={{ color: 'var(--text3)', fontSize: 12 }}>→</span>
              <input type="date" value={catEnd} min={catStart || undefined}
                onChange={e => setCatEnd(e.target.value)} style={{ width: 140, fontSize: 12 }} />
              {(catStart || catEnd) && (
                <button className="btn btn-sm btn-ghost" onClick={() => { setCatStart(''); setCatEnd('') }}>Reset</button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[['lines', 'Lines'], ['stacked', 'Stacked'], ['share', 'Share']].map(([m, label]) => (
                <button key={m} onClick={() => setCatMode(m)}
                  title={m === 'lines' ? 'One line per category' : m === 'stacked' ? 'Stacked hours: total and each category\'s part' : 'Each category as % of shown hours'}
                  style={{
                    padding: '4px 11px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    border: '1px solid var(--border)',
                    background: catMode === m ? 'var(--bg4)' : 'transparent',
                    color: catMode === m ? 'var(--text)' : 'var(--text2)',
                  }}>
                  {label}
                </button>
              ))}
            </div>
            {catMode === 'share' && !catHidden.includes('primary') && (
              <label title="Primary target: dashed line on the Share chart (% of the hours shown)"
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text2)' }}>
                Primary target
                <input type="number" min={0} max={100} step={5} value={primaryTarget}
                  onChange={e => setPrimaryTarget(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                  style={{ width: 56, fontSize: 12 }} />%
              </label>
            )}
            <div style={{ display: 'flex', gap: 4 }}>
              {[['day', 'Day'], ['week', 'Week'], ['month', 'Month']].map(([b, label]) => (
                <button key={b} onClick={() => setCatBucket(b)}
                  style={{
                    padding: '4px 11px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    border: '1px solid var(--border)',
                    background: catBucket === b ? 'var(--bg4)' : 'transparent',
                    color: catBucket === b ? 'var(--text)' : 'var(--text2)',
                  }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            {catMode === 'lines' ? (
            <LineChart data={catHours.data} margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" dataKey="t" scale="time" domain={catHours.domain} ticks={catHours.ticks} tickFormatter={catHours.tickFmt === 'day' ? fmtAxisDay : fmtAxisMonth} tick={{ fontSize: 11, fill: 'var(--text3)' }} />
              <YAxis width={40} tick={{ fontSize: 11, fill: 'var(--text3)' }} />
              <Tooltip content={renderCatTip} />
              {CATEGORY_SERIES.filter(c => !catHidden.includes(c)).map(c => (
                <Line key={c} type="linear" dataKey={c} name={CAT_NAMES[c]} stroke={CATEGORY_COLORS[c]} strokeWidth={2.5}
                  dot={catBucket === 'month' ? { r: 3, fill: CATEGORY_COLORS[c] } : false} isAnimationActive={false} />
              ))}
            </LineChart>
            ) : (
            <AreaChart data={catHours.data} stackOffset={catMode === 'share' ? 'expand' : 'none'} margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" dataKey="t" scale="time" domain={catHours.domain} ticks={catHours.ticks} tickFormatter={catHours.tickFmt === 'day' ? fmtAxisDay : fmtAxisMonth} tick={{ fontSize: 11, fill: 'var(--text3)' }} />
              <YAxis width={44} tick={{ fontSize: 11, fill: 'var(--text3)' }}
                tickFormatter={catMode === 'share' ? v => Math.round(v * 100) + '%' : undefined} />
              <Tooltip content={renderCatTip} />
              {CATEGORY_SERIES.filter(c => !catHidden.includes(c)).map(c => (
                <Area key={c} type="linear" dataKey={c} name={CAT_NAMES[c]} stackId="cat"
                  stroke={CATEGORY_COLORS[c]} fill={CATEGORY_COLORS[c]} fillOpacity={0.85} strokeWidth={1.5} isAnimationActive={false} />
              ))}
              {/* Primary is the bottom band, so its top edge reads straight against this line. */}
              {catMode === 'share' && !catHidden.includes('primary') && primaryTarget > 0 && (
                <ReferenceLine y={primaryTarget / 100} stroke="#16a34a" strokeDasharray="5 4" strokeWidth={2}
                  label={{ value: `Primary target ${primaryTarget}%`, position: 'insideBottomLeft', fill: '#16a34a', fontSize: 11 }} />
              )}
            </AreaChart>
            )}
          </ResponsiveContainer>
          {/* Category toggles — click to switch a line off/on; the y-axis rescales to what's shown. */}
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 8 }}>
            {CATEGORY_SERIES.map(c => {
              const off = catHidden.includes(c)
              return (
                <button key={c} onClick={() => setCatHidden(h => h.includes(c) ? h.filter(x => x !== c) : [...h, c])}
                  title={off ? 'Show ' + CAT_NAMES[c] : 'Hide ' + CAT_NAMES[c]}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 6,
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)',
                    background: off ? 'transparent' : 'var(--bg2)',
                    color: off ? 'var(--text3)' : 'var(--text)',
                    textDecoration: off ? 'line-through' : 'none', opacity: off ? 0.6 : 1,
                  }}>
                  <span style={{ width: 14, height: 4, borderRadius: 2, background: off ? 'var(--border)' : CATEGORY_COLORS[c] }} />
                  {CAT_NAMES[c]}
                </button>
              )
            })}
          </div>
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
