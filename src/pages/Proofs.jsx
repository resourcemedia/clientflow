import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { DEMO_PROOFS, DEMO_PROJECTS, DEMO_CLIENTS } from '../lib/demo-data'
import { StatusBadge, Modal, EmptyState, StatCard, PillNav, FormGroup } from '../components/ui'

const isDemo = !import.meta.env.VITE_SUPABASE_URL

const TABS = [
  { id: 'pending',  label: 'Pending review' },
  { id: 'all',      label: 'All proofs'     },
]

const PROOF_STATUS_MAP = {
  Open:     { bg: 'var(--amber-bg)',   color: 'var(--amber)',   label: 'Awaiting review' },
  Approved: { bg: 'var(--green-bg)',   color: 'var(--green)',   label: 'Approved'        },
  Revise:   { bg: 'var(--red-bg)',     color: 'var(--red)',     label: 'Needs revision'  },
  'No Go':  { bg: 'var(--bg4)',        color: 'var(--text3)',   label: 'No go'           },
}

export default function ProofsPage() {
  const [proofs, setProofs]       = useState([])
  const [projects, setProjects]   = useState([])
  const [clients, setClients]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [tab, setTab]             = useState('pending')
  const [showModal, setShowModal] = useState(false)
  const [viewProof, setViewProof] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    if (isDemo) {
      setProofs(DEMO_PROOFS)
      setProjects(DEMO_PROJECTS)
      setClients(DEMO_CLIENTS)
    } else {
      const [{ data: pr }, { data: pj }, { data: cl }] = await Promise.all([
        supabase.from('proofs').select('*, project:projects(name, client:clients(company))').order('created_at', { ascending: false }),
        supabase.from('projects').select('id,name,client_id').order('name'),
        supabase.from('clients').select('id,company,alias').eq('status','active').order('company'),
      ])
      setProofs(pr || [])
      setProjects(pj || [])
      setClients(cl || [])
    }
    setLoading(false)
  }

  async function updateStatus(id, status) {
    if (!isDemo) {
      await supabase.from('proofs').update({ status }).eq('id', id)
    }
    setProofs(prev => prev.map(p => p.id === id ? { ...p, status } : p))
    if (viewProof?.id === id) setViewProof(v => ({ ...v, status }))
  }

  const pending  = proofs.filter(p => p.status === 'Open' || p.status === 'Revise')
  const displayed = tab === 'pending' ? pending : proofs

  return (
    <div className="fade-in">
      <div className="topbar">
        <div className="topbar-title">Proofs</div>
        <PillNav tabs={TABS} active={tab} onChange={setTab} />
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add proof</button>
      </div>

      <div className="page-content">
        {/* Stats */}
        <div className="stat-grid mb-24">
          <StatCard label="Pending review" value={pending.length}                               color="amber" />
          <StatCard label="Approved"        value={proofs.filter(p=>p.status==='Approved').length} color="green" />
          <StatCard label="Needs revision"  value={proofs.filter(p=>p.status==='Revise').length}   color="red"   />
          <StatCard label="Total proofs"    value={proofs.length}                               color="blue"  />
        </div>

        {loading ? (
          <div className="card"><div className="empty-state text-dim">Loading…</div></div>
        ) : displayed.length === 0 ? (
          <EmptyState icon="📄" title={tab === 'pending' ? 'No proofs awaiting review' : 'No proofs yet'}
            sub="Add a proof to start the review workflow" />
        ) : tab === 'pending' ? (
          /* Card grid for pending */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {displayed.map(p => (
              <ProofCard key={p.id} proof={p} onView={() => setViewProof(p)} onStatus={updateStatus} />
            ))}
          </div>
        ) : (
          /* Table for all proofs */
          <div className="card">
            <div className="card-header"><span className="card-title">All proofs</span></div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Client / Project</th><th>Version</th><th>Preview</th>
                    <th>Status</th><th>Scheduled</th><th>Boost</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map(p => (
                    <tr key={p.id} onClick={() => setViewProof(p)} style={{ cursor: 'pointer' }}>
                      <td>
                        <div className="td-main">{p.project?.client?.company || '—'}</div>
                        <div className="text-dim text-xs">{p.project?.name}</div>
                      </td>
                      <td className="text-mono">v{p.version}</td>
                      <td style={{ maxWidth: 260 }}>
                        <div style={{ fontSize: 12, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.content?.slice(0, 80)}…
                        </div>
                      </td>
                      <td><ProofStatusBadge status={p.status} /></td>
                      <td className="text-mono text-dim">{p.scheduled_date || '—'}</td>
                      <td>{p.boost ? <span style={{ color: 'var(--amber)' }}>✦ Boost</span> : <span className="text-dim">—</span>}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setViewProof(p)}>Review</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {viewProof && (
        <ProofReviewModal
          proof={viewProof}
          onClose={() => setViewProof(null)}
          onStatus={updateStatus}
        />
      )}

      {showModal && (
        <AddProofModal
          projects={projects}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}

// ── PROOF CARD ────────────────────────────────────────────────────────────────
function ProofCard({ proof: p, onView, onStatus }) {
  const s = PROOF_STATUS_MAP[p.status] || PROOF_STATUS_MAP['Open']
  return (
    <div className="card" style={{ cursor: 'pointer' }} onClick={onView}>
      {/* Mock preview */}
      <div style={{
        margin: 16, borderRadius: 8, height: 110,
        background: 'var(--bg3)', border: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 6, color: 'var(--text3)',
      }}>
        <div style={{ fontSize: 24 }}>{p.image_url ? '🖼' : '📝'}</div>
        <div style={{ fontSize: 11, fontWeight: 500 }}>
          {p.image_url ? 'Image proof' : 'Text proof'}
        </div>
      </div>

      <div style={{ padding: '0 16px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'DM Mono, monospace' }}>
            {p.project?.client?.company} · {p.project?.name} · v{p.version}
          </div>
          <ProofStatusBadge status={p.status} />
        </div>

        <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 12, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {p.content}
        </div>

        {p.scheduled_date && (
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10 }}>
            Scheduled: <span style={{ color: 'var(--text2)' }}>{p.scheduled_date}</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
          <button className="btn btn-primary btn-sm" style={{ flex: 1 }}
            onClick={() => onStatus(p.id, 'Approved')}>
            ✓ Approve
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => onStatus(p.id, 'Revise')}>Revise</button>
          <button className="btn btn-ghost btn-sm" onClick={() => onStatus(p.id, 'No Go')}>No go</button>
        </div>
      </div>
    </div>
  )
}

// ── PROOF REVIEW MODAL ────────────────────────────────────────────────────────
function ProofReviewModal({ proof: p, onClose, onStatus }) {
  const [boost, setBoost] = useState(p.boost || false)

  return (
    <Modal
      title={`Proof review — ${p.project?.client?.company}`}
      onClose={onClose}
      footer={
        <div style={{ display: 'flex', gap: 8, width: '100%' }}>
          <button className="btn btn-ghost" onClick={onClose} style={{ marginRight: 'auto' }}>Close</button>
          {p.status !== 'Approved' && (
            <button className="btn btn-primary" onClick={() => { onStatus(p.id, 'Approved'); onClose() }}>✓ Approve</button>
          )}
          {p.status !== 'Revise' && (
            <button className="btn btn-ghost" onClick={() => { onStatus(p.id, 'Revise'); onClose() }}>Request revision</button>
          )}
          {p.status !== 'No Go' && (
            <button className="btn btn-ghost" style={{ color: 'var(--red)' }} onClick={() => { onStatus(p.id, 'No Go'); onClose() }}>No go</button>
          )}
        </div>
      }
    >
      <div style={{ padding: '16px 24px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Meta */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <ProofStatusBadge status={p.status} />
          <span style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'DM Mono, monospace' }}>Version {p.version}</span>
          {p.scheduled_date && (
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>Scheduled: {p.scheduled_date}</span>
          )}
        </div>

        {/* Project / client */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 4 }}>Client</div>
            <div style={{ fontSize: 13, color: 'var(--text)' }}>{p.project?.client?.company}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 4 }}>Project</div>
            <div style={{ fontSize: 13, color: 'var(--text)' }}>{p.project?.name}</div>
          </div>
        </div>

        {/* Image placeholder */}
        {p.image_url ? (
          <img src={p.image_url} alt="proof" style={{ borderRadius: 8, border: '1px solid var(--border)', width: '100%' }} />
        ) : (
          <div style={{ background: 'var(--bg3)', borderRadius: 8, border: '1px solid var(--border)', padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 80 }}>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>No image attached</span>
          </div>
        )}

        {/* Copy */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 8 }}>Proof copy</div>
          <div style={{
            background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8,
            padding: '14px 16px', fontSize: 14, color: 'var(--text)', lineHeight: 1.7,
            fontStyle: 'italic',
          }}>
            "{p.content}"
          </div>
        </div>

        {/* Boost toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg3)', borderRadius: 8, border: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>Boost this post</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>Mark for paid promotion when published</div>
          </div>
          <div
            onClick={() => setBoost(b => !b)}
            style={{
              width: 40, height: 22, borderRadius: 11,
              background: boost ? 'var(--amber)' : 'var(--border2)',
              position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
            }}
          >
            <div style={{
              position: 'absolute', top: 3, left: boost ? 21 : 3,
              width: 16, height: 16, borderRadius: '50%', background: '#fff',
              transition: 'left 0.2s',
            }} />
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ── ADD PROOF MODAL ────────────────────────────────────────────────────────────
function AddProofModal({ projects, onClose, onSaved }) {
  const [form, setForm] = useState({
    project_id: projects[0]?.id || '',
    version: 1,
    content: '',
    status: 'Open',
    scheduled_date: '',
    boost: false,
  })
  const [saving, setSaving] = useState(false)
  function set(f) { return e => setForm(p => ({ ...p, [f]: e.target.value })) }

  async function save() {
    if (!form.content.trim()) return
    setSaving(true)
    if (!isDemo) await supabase.from('proofs').insert(form)
    setTimeout(() => { setSaving(false); onSaved() }, isDemo ? 400 : 0)
  }

  return (
    <Modal title="Add proof" onClose={onClose} footer={
      <>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Add proof'}</button>
      </>
    }>
      <div className="form-grid">
        <FormGroup label="Project" full>
          <select value={form.project_id} onChange={set('project_id')}>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </FormGroup>
        <FormGroup label="Version number">
          <input type="number" value={form.version} onChange={set('version')} min={1} />
        </FormGroup>
        <FormGroup label="Status">
          <select value={form.status} onChange={set('status')}>
            {['Open','Approved','Revise','No Go'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </FormGroup>
        <FormGroup label="Scheduled date">
          <input type="date" value={form.scheduled_date} onChange={set('scheduled_date')} />
        </FormGroup>
        <FormGroup label="Proof copy" full>
          <textarea value={form.content} onChange={set('content')} rows={5}
            placeholder="Paste the social post copy, article draft, or description here…" />
        </FormGroup>
      </div>
    </Modal>
  )
}

function ProofStatusBadge({ status }) {
  const s = PROOF_STATUS_MAP[status] || PROOF_STATUS_MAP['Open']
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}
