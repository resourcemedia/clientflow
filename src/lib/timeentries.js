// Shared time-entry helpers: local-date formatting + enrichment of raw
// time_entries rows into { outTime, hours, billableAmt, invoiceAmt, isActive }.
// Hoisted out of Timeboard so the Pace page and Timeboard share one enrich path.

export function toLocalISO(d) {
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
}

export function todayISO() { return toLocalISO(new Date()) }

export function calcHoursFromTimes(start, end) {
  if (!start || !end) return 0
  const toMins = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
  return Math.max(0, (toMins(end) - toMins(start)) / 60)
}

// Enrich entries with computed outTime, hours, billableAmt, invoiceAmt
// outTime priority: stored end_time → next entry's start_time → '24:00' (past date) → null (today, open).
export function enrichEntries(entries) {
  const today = todayISO()
  const byDate = {}
  entries.forEach(e => { if (!byDate[e.date]) byDate[e.date] = []; byDate[e.date].push(e) })
  const result = []
  Object.values(byDate).forEach(day => {
    const sorted = [...day].sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
    sorted.forEach((entry, i) => {
      const isLast   = i === sorted.length - 1
      const isActive = isLast && entry.date === today
      const outTime  = entry.end_time || sorted[i + 1]?.start_time || (entry.date < today ? '24:00' : null)
      const hours    = calcHoursFromTimes(entry.start_time, outTime)
      const isPrimary   = entry.project?.category === 'primary'
      const isBillable  = entry.is_billable === true || (entry.is_billable === null && isPrimary)
      const roundedHours = Math.round(hours * 100) / 100
      const billableAmt = isBillable ? roundedHours * (entry.hourly_rate || 0) : 0
      const invoiceAmt  = (isBillable && (entry.invoice_number == null || entry.invoice_number === '')) ? roundedHours * (entry.hourly_rate || 0) : 0
      result.push({ ...entry, outTime, hours, billableAmt, invoiceAmt, isActive })
    })
  })
  return result
}
