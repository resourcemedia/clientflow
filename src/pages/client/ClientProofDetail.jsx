import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { StatusBadge, Breadcrumb } from '../../components/ui'

function versionLabel(itemNumber, version) {
  return `${itemNumber}${String.fromCharCode(64 + version)}`
}

function formatDate(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  let h = d.getHours()
  const ampm = h >= 12 ? 'pm' : 'am'
  h = h % 12 || 12
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} ${h}:${m} ${ampm}`
}

export default function ClientProofDetail() {
  const navigate = useNavigate()
  const { id }   = useParams()
  const { profile } = useAuth()

  const [proof, setProof]         = useState(null)
  const [comments, setComments]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [newComment, setNewComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [updating, setUpdating]   = useState(false)

  useEffect(() => {
    if (profile?.client_id) loadProof()
  }, [id, profile?.client_id])

  useEffect(() => {
    if (!loading && proof) {
      console.log('proof.item.project.client_id:', proof.item?.project?.client_id)
      console.log('profile.client_id:', profile?.client_id)
      if (proof.item?.project?.client_id !== profile?.client_id) {
        navigate('/client', { replace: true })
      }
    }
  }, [loading, proof])

  async function loadProof() {
    setLoading(true)
    const { data } = await supabase
      .from('proofs')
      .select(`
        id, version, status, image_url, proof_link, url,
        item:project_items(
          item_number, name,
          project:projects(id, name, client_id)
        )
      `)
      .eq('id', id)
      .single()

    setProof(data || null)
    if (data) await loadComments()
    setLoading(false)
  }

  async function loadComments() {
    const { data } = await supabase
      .from('proof_comments')
      .select('id, body, is_internal, created_at, profile_id')
      .eq('proof_id', id)
      .order('created_at', { ascending: true })
    setComments((data || []).filter(c => !c.is_internal))
  }

  async function updateStatus(status) {
    setUpdating(true)
    await supabase.from('proofs').update({ status }).eq('id', id)
    setProof(prev => ({ ...prev, status }))
    setUpdating(false)
  }

  async function submitComment() {
    if (!newComment.trim()) return
    setSubmitting(true)
    await supabase.from('proof_comments').insert({
      proof_id:    id,
      profile_id:  profile.id,
      body:        newComment.trim(),
      is_internal: false,
    })
    setNewComment('')
    await loadComments()
    setSubmitting(false)
  }

  if (loading) return (
    <div className="fade-in">
      <div className="topbar"><div className="topbar-title">Proof Detail</div></div>
      <div className="page-content">
        <div className="empty-state text-dim">Loading…</div>
      </div>
    </div>
  )

  if (!proof) return (
    <div className="fade-in">
      <div className="topbar"><div className="topbar-title">Proof Detail</div></div>
      <div className="page-content">
        <div className="card">
          <div className="empty-state text-dim">Proof not found.</div>
        </div>
      </div>
    </div>
  )

  const item      = proof?.item
  const project   = item?.project
  const proofId   = item ? versionLabel(item.item_number, proof.version) : `v${proof.version}`
  const isApproved = proof.status === 'Approved'

  return (
    <div className="fade-in">
      <div className="topbar">
        <Breadcrumb segments={[
          { label: 'Dashboard', onClick: () => navigate('/client') },
          { label: 'Proofs',    onClick: () => navigate('/client/proofs') },
          { label: proofId },
        ]} />
      </div>

      <div className="page-content">

        {/* Header card */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 22, fontWeight: 700, fontFamily: 'DM Mono, monospace' }}>
                {proofId}
              </span>
              <StatusBadge status={proof.status} />
            </div>
            <div style={{ fontSize: 14, color: 'var(--text2)' }}>
              {project?.name || '—'}
              {item?.name && (
                <span style={{ color: 'var(--text3)' }}> · {item.item_number} {item.name}</span>
              )}
            </div>
          </div>
        </div>

        {/* Proof image / links */}
        {(proof.image_url || proof.proof_link || proof.url) && (
          <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {proof.image_url && (
              <img
                src={proof.image_url}
                alt="Proof"
                style={{ maxWidth: '100%', borderRadius: 6, border: '1px solid var(--border)' }}
              />
            )}
            {proof.proof_link && (
              <a
                href={proof.proof_link}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost btn-sm"
                style={{ alignSelf: 'flex-start' }}
              >
                View Proof
              </a>
            )}
            {proof.url && (
              <a
                href={proof.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost btn-sm"
                style={{ alignSelf: 'flex-start' }}
              >
                View File
              </a>
            )}
          </div>
        )}

        {/* Status action bar */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ padding: '16px 24px' }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Proof Actions
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-primary btn-sm"
                disabled={isApproved || updating}
                style={{ opacity: isApproved ? 0.4 : 1 }}
                onClick={() => updateStatus('Approved')}
              >
                Approve
              </button>
              <button
                className="btn btn-ghost btn-sm"
                disabled={isApproved || updating}
                onClick={() => updateStatus('Revise')}
              >
                Request Changes
              </button>
              <button
                className="btn btn-ghost btn-sm"
                disabled={isApproved || updating}
                onClick={() => updateStatus('Review')}
              >
                In Review
              </button>
            </div>
          </div>
        </div>

        {/* Comment log */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Comments</span>
          </div>
          <div style={{ padding: '0 24px 24px' }}>

            {comments.length === 0 ? (
              <div style={{ padding: '20px 0', color: 'var(--text3)', fontSize: 14 }}>
                No comments yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 24 }}>
                {comments.map(c => {
                  const authorLabel = c.profile_id === profile?.id ? 'Client' : 'Resource Media'
                  return (
                    <div key={c.id}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{authorLabel}</span>
                        <span style={{ fontSize: 12, color: 'var(--text3)' }}>{formatDate(c.created_at)}</span>
                      </div>
                      <div style={{ fontSize: 14, color: 'var(--text2)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                        {c.body}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <textarea
                className="input"
                rows={3}
                placeholder="Add a comment…"
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: 14 }}
              />
              <div>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={submitting || !newComment.trim()}
                  onClick={submitComment}
                >
                  {submitting ? 'Submitting…' : 'Submit'}
                </button>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  )
}
