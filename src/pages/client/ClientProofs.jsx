import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { StatusBadge, StatCard, PillNav, Breadcrumb } from '../../components/ui'

const FILTER_TABS = [
  { id: 'Open',     label: 'Open'     },
  { id: 'Review',   label: 'Review'   },
  { id: 'Approved', label: 'Approved' },
  { id: 'all',      label: 'All'      },
]

function versionLabel(itemNumber, version) {
  return `${itemNumber}${String.fromCharCode(64 + version)}`
}

export default function ClientProofs() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [proofs, setProofs]   = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState('Open')

  useEffect(() => {
    if (profile?.client_id) load()
  }, [profile?.client_id])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('proofs')
      .select(`
        id, version, status,
        item:project_items(
          item_number, name,
          project:projects(id, name, product_type, client_id)
        )
      `)
      .order('created_at', { ascending: false })
    const scoped = (data || []).filter(
      p => p.item?.project?.client_id === profile.client_id
    )
    setProofs(scoped)
    setLoading(false)
  }

  const filtered = filter === 'all' ? proofs : proofs.filter(p => p.status === filter)

  const openCount     = proofs.filter(p => p.status === 'Open').length
  const reviewCount   = proofs.filter(p => p.status === 'Review').length
  const approvedCount = proofs.filter(p => p.status === 'Approved').length

  return (
    <div className="fade-in">
      <div className="topbar">
        <Breadcrumb segments={[
          { label: 'Dashboard', onClick: () => navigate('/client') },
          { label: 'Proofs' },
        ]} />
        <PillNav tabs={FILTER_TABS} active={filter} onChange={setFilter} />
      </div>

      <div className="page-content">
        <div className="stat-grid mb-24">
          <StatCard label="Open"     value={loading ? '—' : openCount}     color="blue"  />
          <StatCard label="Review"   value={loading ? '—' : reviewCount}   color="amber" />
          <StatCard label="Approved" value={loading ? '—' : approvedCount} color="green" />
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Proofs</span>
            {!loading && <span style={{ fontSize: 12, color: 'var(--text3)' }}>{filtered.length} shown</span>}
          </div>
          <div className="table-wrap">
            {loading ? (
              <div className="empty-state text-dim">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="empty-state text-dim">
                No {filter === 'all' ? '' : filter.toLowerCase() + ' '}proofs found.
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Item</th>
                    <th>Proof ID</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(proof => {
                    const item    = proof.item
                    const project = item?.project
                    return (
                      <tr key={proof.id}>
                        <td className="td-main">{project?.name || '—'}</td>
                        <td style={{ color: 'var(--text2)', fontFamily: 'DM Mono, monospace', fontSize: 13 }}>
                          {item ? `${item.item_number} ${item.name}` : '—'}
                        </td>
                        <td className="text-mono" style={{ fontWeight: 600 }}>
                          {item
                            ? versionLabel(item.item_number, proof.version)
                            : `v${proof.version}`}
                        </td>
                        <td><StatusBadge status={proof.status} /></td>
                        <td>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => navigate(`/client/proofs/${proof.id}`)}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
