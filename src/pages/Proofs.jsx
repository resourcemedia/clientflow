import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { StatusBadge, StatCard, PillNav, Breadcrumb } from '../components/ui'

const isDemo = !import.meta.env.VITE_SUPABASE_URL

const FILTER_TABS = [
  { id: 'Review',   label: 'Review'   },
  { id: 'Revise',   label: 'Revise'   },
  { id: 'Approved', label: 'Approved' },
  { id: 'all',      label: 'All'      },
]

function versionLabel(itemNumber, version) {
  return `${itemNumber}${String.fromCharCode(64 + version)}`
}

export default function ProofsPage() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const [proofs, setProofs]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('Review')

  useEffect(() => { setLoading(true); load() }, [location.pathname])

  async function load() {
    setLoading(true)
    if (!isDemo) {
      const { data } = await supabase
        .from('proofs')
        .select(`
          id, version, status,
          item:project_items(
            item_number, name,
            project:projects(id, name, product_type, client:clients(company, alias))
          )
        `)
        .order('created_at', { ascending: false })
      setProofs(data || [])
    }
    setLoading(false)
  }

  const filtered = filter === 'all' ? proofs : proofs.filter(p => p.status === filter)

  const reviewCount   = proofs.filter(p => p.status === 'Review').length
  const reviseCount   = proofs.filter(p => p.status === 'Revise').length
  const approvedCount = proofs.filter(p => p.status === 'Approved').length

  return (
    <div className="fade-in">
      <div className="topbar">
        <Breadcrumb segments={[
          { label: 'Dashboard', onClick: () => navigate('/') },
          { label: 'Proofs' },
        ]} />
        <PillNav tabs={FILTER_TABS} active={filter} onChange={setFilter} />
      </div>

      <div className="page-content">
        <div className="stat-grid mb-24">
          <StatCard label="Review"   value={loading ? '—' : reviewCount}   color="amber" />
          <StatCard label="Revise"   value={loading ? '—' : reviseCount}   color="red"   />
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
                    <th>Client</th>
                    <th>Product</th>
                    <th>Project</th>
                    <th>Item</th>
                    <th>Proof</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(proof => {
                    const item    = proof.item
                    const project = item?.project
                    const client  = project?.client
                    return (
                      <tr key={proof.id}>
                        <td className="td-main">{client?.company || client?.alias || '—'}</td>
                        <td><StatusBadge status={project?.product_type} /></td>
                        <td style={{ color: 'var(--text2)' }}>{project?.name || '—'}</td>
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
                            disabled={!project?.id}
                            onClick={() => project?.id && navigate(`/projects/${project.id}`)}
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
