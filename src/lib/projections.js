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

// Rolling annualized run-rate over a trailing window (default 91 days).
// At each day D: the 7-day and 28-day billable averages and the YTD pace, each ×365.
// Mirrors the windowStats convention — window is [D-N, D), today-exclusive — so the
// right-edge values equal the table's 12-Months column (G / H / I).
export function buildRunRateSeries(ytdEnriched, now = new Date(), windowDays = 91) {
  const pad = n => String(n).padStart(2, '0')
  const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const year  = now.getFullYear()
  const today = new Date(year, now.getMonth(), now.getDate())
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

  const data = []
  const monthTicks = []
  const start = new Date(today); start.setDate(start.getDate() - (windowDays - 1))
  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const ms = d.getTime()
    if (d.getDate() === 1) monthTicks.push(ms)
    const lo7  = new Date(d); lo7.setDate(lo7.getDate() - 7)
    const lo28 = new Date(d); lo28.setDate(lo28.getDate() - 28)
    const rate7  = (sumRange(lo7,  d) / 7)  * 365
    const rate28 = (sumRange(lo28, d) / 28) * 365
    const dp = Math.round((d - jan0) / DAY)
    const rateYtd = dp > 0 ? (sumRange(jan1, d) / dp) * 365 : 0
    data.push({ t: ms, rateYtd, rate28, rate7 })
  }
  return { data, monthTicks, domain: [start.getTime(), today.getTime()] }
}
