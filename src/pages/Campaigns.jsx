import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { DEMO_CAMPAIGNS, DEMO_CLIENTS, CHANNEL_COLORS } from '../lib/demo-data'
import { Badge, Modal, EmptyState, StatCard, FormGroup, PillNav } from '../components/ui'

const isDemo = !import.meta.env.VITE_SUPABASE_URL

const CHANNELS = [
  { id: 'social', label: 'Social media',     color: 'var(--accent2)' },
  { id: 'email',  label: 'Email (MailChimp)',color: 'var(--green)'   },
  { id: 'print',  label: 'Postcard / print', color: 'var(--amber)'   },
  { id: 'web',    label: 'Website / blog',   color: 'var(--blue)'    },
]

const STATUS_TABS = [
  { id: 'all',      label: 'All'      },
  { id: 'active',   label: 'Active'   },
  { id: 'draft',    label: 'Drafts'   },
  { id: 'complete', label: 'Complete' },
]

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState([])
  const [clients, setClients]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [tab, setTab]             = useState('all')
  const [showBuilder, setShowBuilder] = useState(false)
  const [editCampaign, setEditCampaign] = useState(null)
  const [viewCampaign, setViewCampaign] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    if (isDemo) {
      setCampaigns(DEMO_CAMPAIGNS)
      setClients(DEMO_CLIENTS)
    } else {
      const [{ data: ca }, { data: cl }] = await Promise.all([
        supabase.from('campaigns').select('*, client:clients(company,alias)').order('created_at', { ascending: false }),
        supabase.from('clients').select('id,company,alias').eq('status','active').order('company'),
      ])
      setCampaigns(ca || [])
      setClients(cl || [])
    }
    setLoading(false)
  }

  const filtered = tab === 'all' ? campaigns : campaigns.filter(c => c.status === tab)

  const active   = campaigns.filter(c => c.status === 'active').length
  const draft    = campaigns.filter(c => c.status === 'draft').length
  const complete = campaigns.filter(c => c.status === 'complete').length

  return (
    <div className="fade-in">
      <div className="topbar">
        <div className="topbar-title">Campaigns</div>
        <PillNav tabs={STATUS_TABS} active={tab} onChange={setTab} />
        <button className="btn btn-primary" onClick={() => { setEditCampaign(null); setShowBuilder(true) }}>
          + New campaign
        </button>
      </div>

      <div className="page-content">
        {/* Stats */}
        <div className="stat-grid mb-24">
          <StatCard label="Total campaigns" value={campaigns.length} color="blue"   />
          <StatCard label="Active"           value={active}          color="green"  />
          <StatCard label="Drafts"           value={draft}           color="amber"  />
          <StatCard label="Complete"         value={complete}        color="accent" />
        </div>

        {/* Campaign cards */}
        {loading ? (
          <div className="card"><div className="empty-state text-dim">Loading…</div></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon="📣" title="No campaigns yet" sub="Build your first campaign to get started" action={
            <button className="btn btn-primary" onClick={() => { setEditCampaign(null); setShowBuilder(true) }}>+ New campaign</button>
          } />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
            {filtered.map(c => (
              <CampaignCard key={c.id} campaign={c}
                onView={() => setViewCampaign(c)}
                onEdit={() => { setEditCampaign(c); setShowBuilder(true) }}
              />
            ))}
          </div>
        )}
      </div>

      {showBuilder && (
        <CampaignBuilder
          campaign={editCampaign}
          clients={clients}
          onClose={() => setShowBuilder(false)}
          onSaved={() => { setShowBuilder(false); load() }}
        />
      )}

      {viewCampaign && (
        <CampaignDetail
          campaign={viewCampaign}
          onClose={() => setViewCampaign(null)}
          onEdit={() => { setEditCampaign(viewCampaign); setViewCampaign(null); setShowBuilder(true) }}
        />
      )}
    </div>
  )
}

// ── CAMPAIGN CARD ─────────────────────────────────────────────────────────────
function CampaignCard({ campaign: c, onView, onEdit }) {
  const pct = c.deliverable_count > 0
    ? Math.round((c.deliverables_done / c.deliverable_count) * 100)
    : 0
  const channels = c.channels || []

  return (
    <div className="card" style={{ cursor: 'pointer' }} onClick={onView}>
      {/* Header */}
      <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>{c.name}</div>
          <StatusChip status={c.status} />
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>{c.client?.company}</div>
      </div>

      {/* Message preview */}
      <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 4 }}>Core message</div>
        <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {c.benefit}
        </div>
      </div>

      {/* Footer — channels + progress */}
      <div style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {channels.map(ch => {
            const col = CHANNEL_COLORS[ch] || {}
            return (
              <span key={ch} style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: col.bg, color: col.text }}>
                {col.label || ch}
              </span>
            )
          })}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'DM Mono, monospace' }}>
            {c.deliverables_done}/{c.deliverable_count} deliverables
          </div>
          <div style={{ width: 100, height: 5, borderRadius: 3, background: 'var(--bg4)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 3,
              width: `${pct}%`,
              background: pct === 100 ? 'var(--green)' : pct > 50 ? 'var(--accent)' : 'var(--amber)',
              transition: 'width 0.3s',
            }} />
          </div>
        </div>
      </div>

      <div style={{ padding: '0 18px 14px', display: 'flex', justifyContent: 'flex-end', gap: 8 }} onClick={e => e.stopPropagation()}>
        <button className="btn btn-ghost btn-sm" onClick={onEdit}>Edit</button>
        <button className="btn btn-primary btn-sm" onClick={onView}>View detail</button>
      </div>
    </div>
  )
}

// ── CAMPAIGN DETAIL MODAL ────────────────────────────────────────────────────
function CampaignDetail({ campaign: c, onClose, onEdit }) {
  const channels = c.channels || []
  return (
    <Modal title={c.name} onClose={onClose} footer={
      <>
        <button className="btn btn-ghost" onClick={onClose}>Close</button>
        <button className="btn btn-primary" onClick={onEdit}>Edit campaign</button>
      </>
    }>
      <div style={{ padding: '0 24px 4px' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 4, marginTop: 16 }}>
          <StatusChip status={c.status} />
          {channels.map(ch => {
            const col = CHANNEL_COLORS[ch] || {}
            return <span key={ch} style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: col.bg, color: col.text }}>{col.label || ch}</span>
          })}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 20 }}>
          {c.client?.company} · {c.start_date} → {c.end_date || 'ongoing'}
        </div>
      </div>

      <div style={{ padding: '0 24px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <MessageSection label="Benefit" icon="✦" color="var(--accent2)" text={c.benefit} />
        <MessageSection label="Proof"   icon="✓" color="var(--green)"   text={c.proof} />
        <MessageSection label="CTA"     icon="→" color="var(--amber)"   text={c.cta} />
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 10 }}>Deliverables</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--bg4)', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 4, width: `${c.deliverable_count > 0 ? Math.round(c.deliverables_done/c.deliverable_count*100) : 0}%`, background: 'var(--accent)' }} />
            </div>
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: 'var(--text2)', flexShrink: 0 }}>
              {c.deliverables_done}/{c.deliverable_count}
            </span>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function MessageSection({ label, icon, color, text }) {
  return (
    <div style={{ display: 'flex', gap: 14 }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, background: `color-mix(in srgb, ${color} 15%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color, flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>{text || <span style={{ fontStyle: 'italic', opacity: 0.5 }}>Not set</span>}</div>
      </div>
    </div>
  )
}

// ── CAMPAIGN BUILDER MODAL ────────────────────────────────────────────────────
function CampaignBuilder({ campaign, clients, onClose, onSaved }) {
  const isEdit = !!campaign
  const [form, setForm] = useState({
    name: campaign?.name || '',
    client_id: campaign?.client_id || (clients[0]?.id || ''),
    benefit: campaign?.benefit || '',
    proof: campaign?.proof || '',
    cta: campaign?.cta || '',
    channels: campaign?.channels || [],
    status: campaign?.status || 'draft',
    start_date: campaign?.start_date || '',
    end_date: campaign?.end_date || '',
  })
  const [saving, setSaving] = useState(false)

  function set(field) { return e => setForm(f => ({ ...f, [field]: e.target.value })) }

  function toggleChannel(id) {
    setForm(f => ({
      ...f,
      channels: f.channels.includes(id)
        ? f.channels.filter(c => c !== id)
        : [...f.channels, id],
    }))
  }

  async function save() {
    if (!form.name.trim() || !form.client_id) return
    setSaving(true)
    if (isDemo) {
      setTimeout(() => { setSaving(false); onSaved() }, 400)
      return
    }
    const payload = { ...form }
    if (isEdit) {
      await supabase.from('campaigns').update(payload).eq('id', campaign.id)
    } else {
      await supabase.from('campaigns').insert(payload)
    }
    setSaving(false)
    onSaved()
  }

  return (
    <Modal
      title={isEdit ? `Edit — ${campaign.name}` : 'Build new campaign'}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create campaign'}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <FormGroup label="Client" full>
          <select value={form.client_id} onChange={set('client_id')}>
            {clients.map(c => <option key={c.id} value={c.id}>{c.company}</option>)}
          </select>
        </FormGroup>
        <FormGroup label="Campaign name" full>
          <input value={form.name} onChange={set('name')} placeholder="e.g. FB Posts 52 — Lifetime Warranty" />
        </FormGroup>

        <div style={{ gridColumn: '1/-1', borderTop: '1px solid var(--border)', margin: '0 -24px', padding: '16px 24px 0' }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 14 }}>Marketing message</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <FormGroup label="✦  Benefit — what the customer gets" full>
              <textarea value={form.benefit} onChange={set('benefit')} rows={3}
                placeholder="e.g. Fast, reliable windshield repair with a lifetime warranty — on your schedule." />
            </FormGroup>
            <FormGroup label="✓  Proof — why they should believe it" full>
              <textarea value={form.proof} onChange={set('proof')} rows={3}
                placeholder="e.g. Over 10,000 repairs completed. 5-star rated. BBB accredited." />
            </FormGroup>
            <FormGroup label="→  Call to action" full>
              <input value={form.cta} onChange={set('cta')}
                placeholder="e.g. Call 866-975-4527 or request a free quote at arrowautoglass.com" />
            </FormGroup>
          </div>
        </div>

        <div style={{ gridColumn: '1/-1', borderTop: '1px solid var(--border)', margin: '0 -24px', padding: '16px 24px 0' }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 12 }}>Delivery channels</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {CHANNELS.map(ch => (
              <div
                key={ch.id}
                onClick={() => toggleChannel(ch.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 14px', borderRadius: 20, cursor: 'pointer',
                  border: `1px solid ${form.channels.includes(ch.id) ? 'var(--accent)' : 'var(--border)'}`,
                  background: form.channels.includes(ch.id) ? 'var(--accent-glow)' : 'transparent',
                  color: form.channels.includes(ch.id) ? 'var(--accent2)' : 'var(--text2)',
                  fontSize: 13, fontWeight: 500, transition: 'all 0.15s',
                }}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: ch.color }} />
                {ch.label}
              </div>
            ))}
          </div>
        </div>

        <FormGroup label="Status">
          <select value={form.status} onChange={set('status')}>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="complete">Complete</option>
          </select>
        </FormGroup>
        <div />
        <FormGroup label="Start date"><input type="date" value={form.start_date} onChange={set('start_date')} /></FormGroup>
        <FormGroup label="End date">  <input type="date" value={form.end_date}   onChange={set('end_date')}   /></FormGroup>
      </div>
    </Modal>
  )
}

function StatusChip({ status }) {
  const map = {
    active:   { bg: 'var(--green-bg)',   color: 'var(--green)',   label: 'Active'   },
    draft:    { bg: 'var(--amber-bg)',   color: 'var(--amber)',   label: 'Draft'    },
    complete: { bg: 'var(--accent-glow)',color: 'var(--accent2)', label: 'Complete' },
  }
  const s = map[status] || { bg: 'var(--bg4)', color: 'var(--text2)', label: status }
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: s.bg, color: s.color, flexShrink: 0 }}>
      {s.label}
    </span>
  )
}
