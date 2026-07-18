// Single source of truth for project_category presentation.
// DB enum (project_category): primary | secondary | accounting | overhead | charity | personal
// Previously duplicated byte-for-byte in Calendar.jsx, Projects.jsx,
// Tasks.jsx, and Timeboard.jsx.

export const CATEGORY_COLORS = {
  primary:    '#ffb8b8',
  secondary:  '#4fd1b8',
  accounting: '#63ca7a',
  overhead:   '#b9dd67',
  charity:    '#c6c7fe',
  personal:   '#ebb8e5',
}

export const CATEGORY_LABELS = {
  primary: 'Prin', secondary: 'Sec', accounting: 'Acct',
  overhead: 'OH', charity: 'Char', personal: 'Pers',
}

export function catColor(category) { return CATEGORY_COLORS[category] || 'var(--bg4)' }
export function catLabel(category) { return CATEGORY_LABELS[category] || (category || '—') }

// Darker tint of a category color — used for the filled "complete" toggle dot
// on Calendar item cards. Computed (RGB × 0.72) from CATEGORY_COLORS so the
// base palette stays the single source of truth.
function darkenHex(hex, factor = 0.72) {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.round(((n >> 16) & 255) * factor)
  const g = Math.round(((n >> 8) & 255) * factor)
  const b = Math.round((n & 255) * factor)
  return `rgb(${r}, ${g}, ${b})`
}
export function catColorDark(category) {
  const base = CATEGORY_COLORS[category]
  return base ? darkenHex(base) : 'rgba(0,0,0,0.35)'
}
