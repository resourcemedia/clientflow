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
