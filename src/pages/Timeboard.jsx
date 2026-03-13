import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { DEMO_TIME_ENTRIES, DEMO_PROJECTS } from '../lib/demo-data'
import { StatCard, Modal, EmptyState, FormGroup } from '../components/ui'
import { format, startOfWeek, endOfWeek, addDays, addWeeks, subWeeks, parseISO } from 'date-fns'

const isDemo = !import.meta.env.VITE_SUPABASE_URL

const TEAM = [
  { id: 'u1', name: 'Jim OConnell', role: 'Manager'   },
  { id: 'u2', name: 'Sarah M.',     role: 'Design'     },
  { id: 'u3', name: 'Mike T.',      role: 'Dev'        },
]

export default function TimeboardPage() {
  const [entries, setEntries]   = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading]   = useState(true)
  const [weekStart, setWeekStart] = useState(new Date(2026, 2, 9)) // Mon Mar 9
  const [showModal, setShowModal] = useState(false)
  const [prefill, setPrefill]   = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    if (isDemo) {
      setEntries(DEMO_TIME_ENTRIES)
      setProjects(DEMO_PROJECTS)
    } else {
      const [{ data: e }, { data: p }] = await Promise.all([
        supabase.from('time_entries').select('*, project:projects(name), user_id').order('entry_date'),
        supabase.from('projects').select('id,name').order('name'),
      ])
      setEntries(e || [])
      setProjects(p || [])
    }
    setLoading(false)
  }

  // 7 days starting from weekStart
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const weekEnd = days[6]

  // Entries for this week only
  const weekEntries = entries.filter(e => {
    const d = parseISO(e.entry_date)
    return d >= weekStart && d <= weekEnd
  })

  // Hours by user + day
  function hoursFor(userId, day) {
    const iso = format(day, 'yyyy-MM-dd')
    return weekEntries
      .filter(e => e.user_id === userId && e.entry_date === iso)
      .reduce((s, e) => s + (e.hours || 0), 0)
  }

  function totalFor(userId) {
    return weekEntries.filter(e => e.user_id === userId).reduce((s, e) => s + (e.hours || 0), 0)
  }

  const grandTotal   = weekEntries.reduce((s, e) => s + (e.hours || 0), 0)
  const today = new Date(2026, 2, 13)

  // Entries by project for breakdown
  const byProject = {}
  weekEntries.forEach(e => {
    const name = e.project?.name || 'Unknown'
    byProject[name] = (byProject[name] || 0) + (e.hours || 0)
  })

  return (
    <div className="fade-in">
      <div className="topbar">
        <div className="topbar-title">Time board</div>

        {/* Week nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setWeekStart(w => subWeeks(w, 1))}>← Week</button>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', minWidth: 160, textAlign: 'center' }}>
            {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => setWeekStart(w => addWeeks(w, 1))}>Week →</button>
        </div>

        <button className="btn btn-primary" onClick={() => { setPrefill(null); setShowModal(true) }}>
          + Log time
        </button>
      </div>

      <div className="page-content">
        {/* Stats */}
        <div className="stat-grid mb-24">
          <StatCard label="Total this week"  value={`${grandTotal}h`}                         color="accent" />
          <StatCard label="Billable hours"   value={`${(grandTotal * 0.86).toFixed(1)}h`}    color="green"  />
          <StatCard label="Non-billable"     value={`${(grandTotal * 0.14).toFixed(1)}h`}    color="amber"  />
          <StatCard label="Utilization"      value={`${Math.round(grandTotal/40*100)}%`}      color="blue"   />
        </div>

        {/* Weekly grid */}
        <div className="card mb-24">
          <div style={{ overflowX: 'auto' }}>
            {/* Header row */}
            <div style={{ display: 'grid', gridTemplateColumns: '180px repeat(7,1fr) 80px', background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
              <div style={{ padding: '10px 16px', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)' }}>Team member</div>
              {days.map((day, i) => {
                const isToday = format(day, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')
                return (
                  <div key={i} style={{ padding: '8px 10px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: isToday ? 'var(--accent2)' : 'var(--text3)', borderLeft: '1px solid var(--border)' }}>
                    {format(day, 'EEE')}<br />
                    <span style={{ fontWeight: 400, fontSize: 10 }}>{format(day, 'MMM d')}</span>
                  </div>
                )
              })}
              <div style={{ padding: '10px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text3)', borderLeft: '1px solid var(--border)' }}>Total</div>
            </div>

            {/* Team rows */}
            {TEAM.map((member, mi) => (
              <div key={member.id} style={{ display: 'grid', gridTemplateColumns: '180px repeat(7,1fr) 80px', borderBottom: mi < TEAM.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%',
                    background: 'var(--accent-glow)', border: '1px solid var(--accent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, color: 'var(--accent2)', flexShrink: 0,
                  }}>
                    {member.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{member.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{member.role}</div>
                  </div>
                </div>

                {days.map((day, di) => {
                  const h = hoursFor(member.id, day)
                  const isToday = format(day, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')
                  return (
                    <div
                      key={di}
                      onClick={() => h > 0 ? null : (setPrefill({ user_id: member.id, entry_date: format(day, 'yyyy-MM-dd') }), setShowModal(true))}
                      style={{
                        padding: '12px 10px', textAlign: 'center',
                        borderLeft: '1px solid var(--border)',
                        fontFamily: 'DM Mono, monospace', fontSize: 13,
                        color: h > 0 ? (isToday ? 'var(--accent2)' : 'var(--text)') : 'var(--text3)',
                        background: isToday ? 'color-mix(in srgb, var(--accent) 5%, transparent)' : 'transparent',
                        cursor: h === 0 ? 'pointer' : 'default',
                      }}
                    >
                      {h > 0 ? h.toFixed(1) : '—'}
                    </div>
                  )
                })}

                <div style={{ padding: '12px 10px', textAlign: 'center', borderLeft: '1px solid var(--border)', fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 600, color: 'var(--accent2)', background: 'var(--bg3)' }}>
                  {totalFor(member.id).toFixed(1)}h
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Hours by project breakdown */}
        <div className="card">
          <div className="card-header"><span className="card-title">Hours by project — this week</span></div>
          <table>
            <thead><tr><th>Project</th><th>Hours</th><th>Share</th></tr></thead>
            <tbody>
              {Object.entries(byProject).sort((a,b) => b[1]-a[1]).map(([name, hours]) => (
                <tr key={name}>
                  <td className="td-main">{name}</td>
                  <td className="text-mono">{hours.toFixed(1)}h</td>
                  <td style={{ width: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--bg4)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 3, width: `${grandTotal > 0 ? (hours/grandTotal*100) : 0}%`, background: 'var(--accent)' }} />
                      </div>
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: 'var(--text3)', minWidth: 36 }}>
                        {grandTotal > 0 ? Math.round(hours/grandTotal*100) : 0}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <LogTimeModal
          projects={projects}
          prefill={prefill}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}

// ── LOG TIME MODAL ────────────────────────────────────────────────────────────
function LogTimeModal({ projects, prefill, onClose, onSaved }) {
  const [form, setForm] = useState({
    project_id: projects[0]?.id || '',
    user_id: prefill?.user_id || 'u1',
    entry_date: prefill?.entry_date || format(new Date(2026, 2, 13), 'yyyy-MM-dd'),
    hours: '',
    description: '',
    category: 'Content',
  })
  const [saving, setSaving] = useState(false)
  function set(f) { return e => setForm(p => ({ ...p, [f]: e.target.value })) }

  async function save() {
    if (!form.hours || isNaN(+form.hours)) return
    setSaving(true)
    if (!isDemo) await supabase.from('time_entries').insert({ ...form, hours: +form.hours })
    setTimeout(() => { setSaving(false); onSaved() }, isDemo ? 400 : 0)
  }

  return (
    <Modal title="Log time" onClose={onClose} footer={
      <>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Log time'}</button>
      </>
    }>
      <div className="form-grid">
        <FormGroup label="Project" full>
          <select value={form.project_id} onChange={set('project_id')}>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </FormGroup>
        <FormGroup label="Team member">
          <select value={form.user_id} onChange={set('user_id')}>
            <option value="u1">Jim OConnell</option>
            <option value="u2">Sarah M.</option>
            <option value="u3">Mike T.</option>
          </select>
        </FormGroup>
        <FormGroup label="Category">
          <select value={form.category} onChange={set('category')}>
            {['Content','Design','Development','Account Mgmt','Admin'].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </FormGroup>
        <FormGroup label="Date">
          <input type="date" value={form.entry_date} onChange={set('entry_date')} />
        </FormGroup>
        <FormGroup label="Hours" full>
          <input type="number" step="0.5" min="0.5" max="24" value={form.hours} onChange={set('hours')} placeholder="e.g. 2.5" />
        </FormGroup>
        <FormGroup label="Description" full>
          <textarea value={form.description} onChange={set('description')} rows={2}
            placeholder="e.g. Proof writing + revisions for FB Posts 52" />
        </FormGroup>
      </div>
    </Modal>
  )
}
