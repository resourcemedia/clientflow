// Pure projection / rolling-window math, shared across Timeboard and the Pace page.
// No React, no data fetching — callers pass in enriched entries + the reference date.

import { toLocalISO } from './timeentries'

// Rolling window over enriched time entries.
// Preserves existing behavior exactly: the previous `days` days, today-EXCLUSIVE.
// `today` is an ISO date string (YYYY-MM-DD).
export function windowStats(enriched, days, today) {
  const d = new Date(today + 'T00:00:00')
  d.setDate(d.getDate() - days)
  const startISO = toLocalISO(d)
  const win = enriched.filter(e => e.date >= startISO && e.date < today)
  const billTtl = win.reduce((s, e) => s + (e.billableAmt || 0), 0)
  const invTtl  = win.filter(e => e.invoice_number).reduce((s, e) => s + (e.billableAmt || 0), 0)
  const hrsTtl  = billTtl / 100
  return {
    hrsTtl,  hrsAvg:  hrsTtl  / days,
    billTtl, billAvg: billTtl / days,
    invTtl,  invAvg:  invTtl  / days,
  }
}

// Annual projection math. `now` is a Date. Returns the same A..I values the table
// renders today, plus the day counts for later use.
export function computeAnnualProjection({ ytdEnriched, sevenAvg, twentyEightAvg, now = new Date() }) {
  const daysPassed = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000)
  const totalDays = new Date(now.getFullYear(), 1, 29).getMonth() === 1 ? 366 : 365
  const daysLeft = totalDays - daysPassed

  const ytdTtl = ytdEnriched.reduce((s, e) => s + (e.billableAmt || 0), 0)
  const A = daysPassed > 0 ? ytdTtl / daysPassed : 0
  const B = twentyEightAvg
  const C = sevenAvg

  const D = A * totalDays
  const E = A * daysPassed + B * daysLeft
  const F = A * daysPassed + C * daysLeft
  const G = A * 365
  const H = B * 365
  const I = C * 365

  return { A, B, C, D, E, F, G, H, I, daysPassed, daysLeft, totalDays, ytdTtl }
}

// Builds the "how the year ends" series: cumulative banked billable Jan 1 → today,
// then three forecast rays (YTD / 28-day / 7-day pace) from today → Dec 31.
// `proj` is the object returned by computeAnnualProjection (uses proj.A/B/C).
// Each forecast's Dec-31 endpoint equals the table's Current Year value (D/E/F).
export function buildYearEndSeries(ytdEnriched, proj, now = new Date()) {
  const pad = n => String(n).padStart(2, '0')
  const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const year  = now.getFullYear()
  const jan1  = new Date(year, 0, 1)
  const dec31 = new Date(year, 11, 31)
  const today = new Date(year, now.getMonth(), now.getDate())
  const todayMs = today.getTime()
  const DAY = 86400000

  const byDate = {}
  ytdEnriched.forEach(e => { byDate[e.date] = (byDate[e.date] || 0) + (e.billableAmt || 0) })

  // banked total through today (matches ytdTtl)
  let bankedToday = 0
  for (let d = new Date(jan1); d <= today; d.setDate(d.getDate() + 1)) {
    bankedToday += (byDate[toISO(d)] || 0)
  }

  const { A, B, C } = proj
  const data = []
  const monthTicks = []
  let cum = 0
  for (let d = new Date(jan1); d <= dec31; d.setDate(d.getDate() + 1)) {
    const ms = d.getTime()
    if (d.getDate() === 1) monthTicks.push(ms)
    const row = { t: ms, banked: null, ytdProj: null, proj28: null, proj7: null }
    if (ms <= todayMs) { cum += (byDate[toISO(d)] || 0); row.banked = cum }
    if (ms >= todayMs) {
      const offset = Math.round((ms - todayMs) / DAY)
      row.ytdProj = bankedToday + A * offset
      row.proj28  = bankedToday + B * offset
      row.proj7   = bankedToday + C * offset
    }
    data.push(row)
  }
  return { data, monthTicks, domain: [jan1.getTime(), dec31.getTime()] }
}

// Rolling annualized run-rate over a window. By default the trailing `windowDays`
// ending today (unchanged). Optional startISO/endISO (YYYY-MM-DD) override it with a
// picked span, clamped to [Jan 1, yesterday] (yesterday = data ceiling, since the YTD
// fetch is today-exclusive). At each day: the 7-day and 28-day billable averages and
// the YTD pace, each ×365. A rolling line is null until its lookback fully sits inside
// the loaded data (≥ Jan 1), so early-year points aren't understated by dividing a
// partial window by a fixed 7 / 28; the YTD line self-corrects and is always drawn.
// Ticks adapt: months for long spans, sampled days for short (tickFmt picks the formatter).
export function buildRunRateSeries(ytdEnriched, startISO = '', endISO = '', now = new Date(), windowDays = 91) {
  const pad = n => String(n).padStart(2, '0')
  const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const parse = s => { const [y, m, dd] = s.split('-').map(Number); return new Date(y, m - 1, dd) }
  const year  = now.getFullYear()
  const today = new Date(year, now.getMonth(), now.getDate())
  const lastDay = new Date(today); lastDay.setDate(lastDay.getDate() - 1)
  const jan0  = new Date(year, 0, 0)
  const jan1  = new Date(year, 0, 1)
  const DAY = 86400000

  const byDate = {}
  ytdEnriched.forEach(e => { byDate[e.date] = (byDate[e.date] || 0) + (e.billableAmt || 0) })
  const sumRange = (lo, hiExcl) => {
    let s = 0
    for (let d = new Date(lo); d < hiExcl; d.setDate(d.getDate() + 1)) s += (byDate[toISO(d)] || 0)
    return s
  }

  let start, end
  if (startISO || endISO) {
    start = startISO ? parse(startISO) : new Date(jan1)
    end   = endISO   ? parse(endISO)   : new Date(lastDay)
    if (start < jan1)    start = new Date(jan1)
    if (end   > lastDay) end   = new Date(lastDay)
  } else {
    end = new Date(today)
    start = new Date(today); start.setDate(start.getDate() - (windowDays - 1))
  }

  const data = []
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const ms = d.getTime()
    const lo7  = new Date(d); lo7.setDate(lo7.getDate() - 7)
    const lo28 = new Date(d); lo28.setDate(lo28.getDate() - 28)
    const rate7  = lo7  >= jan1 ? (sumRange(lo7,  d) / 7)  * 365 : null
    const rate28 = lo28 >= jan1 ? (sumRange(lo28, d) / 28) * 365 : null
    const dp = Math.round((d - jan0) / DAY)
    const rateYtd = dp > 0 ? (sumRange(jan1, d) / dp) * 365 : 0
    data.push({ t: ms, rateYtd, rate28, rate7 })
  }

  const spanDays = data.length
  const ticks = []
  let tickFmt = 'month'
  if (spanDays > 75) {
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (d.getDate() === 1) ticks.push(d.getTime())
    }
  } else {
    tickFmt = 'day'
    const step = Math.max(1, Math.ceil(spanDays / 10))
    for (let i = 0; i < data.length; i += step) ticks.push(data[i].t)
  }
  return { data, ticks, tickFmt, domain: [start.getTime(), end.getTime()] }
}

export function buildDailyHoursSeries(ytdEnriched, startISO = '', endISO = '', now = new Date()) {
  const pad = n => String(n).padStart(2, '0')
  const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const parse = s => { const [y, m, dd] = s.split('-').map(Number); return new Date(y, m - 1, dd) }
  const year = now.getFullYear()
  const jan1 = new Date(year, 0, 1)
  const lastDay = new Date(year, now.getMonth(), now.getDate()); lastDay.setDate(lastDay.getDate() - 1)

  let start = startISO ? parse(startISO) : new Date(jan1)
  let end   = endISO   ? parse(endISO)   : new Date(lastDay)
  if (start < jan1)    start = new Date(jan1)
  if (end   > lastDay) end   = new Date(lastDay)

  const byDate = {}
  ytdEnriched.forEach(e => { byDate[e.date] = (byDate[e.date] || 0) + (e.billableAmt || 0) })

  const data = []
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const amt = byDate[toISO(d)] || 0
    data.push({ t: d.getTime(), hours: Math.round(amt) / 100 })
  }

  const spanDays = data.length
  const ticks = []
  let tickFmt = 'month'
  if (spanDays > 75) {
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (d.getDate() === 1) ticks.push(d.getTime())
    }
  } else {
    tickFmt = 'day'
    const step = Math.max(1, Math.ceil(spanDays / 10))
    for (let i = 0; i < data.length; i += step) ticks.push(data[i].t)
  }
  return { data, ticks, tickFmt, domain: [start.getTime(), end.getTime()] }
}
