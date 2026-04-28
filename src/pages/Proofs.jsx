import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PillNav, Breadcrumb } from '../components/ui'

const STATUS_TABS = [
  { id: 'Review',   label: 'Review'   },
  { id: 'Revise',   label: 'Revise'   },
  { id: 'Approved', label: 'Approved' },
]

export default function ProofsPage() {
  const navigate      = useNavigate()
  const location      = useLocation()
  const [proofs,       setProofs]       = useState([])
  const [loading,      setLoading]      = useState(true)
  const [statusFilter, setStatusFilter] = useState('Review')

  useEffect(() => { setLoading(true); load() }, [location.pathname])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('proofs')
      .select(`
        id, proof_number, status, url,
        item:project_items(
          name,
          project:projects(
            name, client_id,
            client:clients(name)
          )
        )
      `)
      .order('created_at', { ascending: false })
    setProofs(data || [])
    setLoading(false)
  }

  // Apply status filter
  const filtered = proofs.filter(p => p.status === statusFilter)

  // Group by client, sort within each group by project name then proof_number
  const groupMap = filtered.reduce((acc, proof) => {
    const clientId   = proof.item?.project?.client_id || '__none__'
    const clientName = proof.item?.project?.client?.name || '—'
    if (!acc[clientId]) acc[clientId] = { clientId, clientName, rows: [] }
    acc[clientId].rows.push(proof)
    return acc
  }, {})

  const clientGroups = Object.values(groupMap)
  clientGroups.forEach(group => {
    group.rows.sort((a, b) => {
      const pa = a.item?.project?.name || ''
      const pb = b.item?.project?.name || ''
      if (pa !== pb) return pa.localeCompare(pb)
      return (a.proof_number || '').localeCompare(b.proof_number || '')
    })
  })
  clientGroups.sort((a, b) => a.clientName.localeCompare(b.clientName))

  return (
    <div className="fade-in">
      <div className="topbar">
        <Breadcrumb segments={[
          { label: 'Dashboard', onClick: () => navigate('/') },
          { label: 'Proofs' },
        ]} />
        <PillNav tabs={STATUS_TABS} active={statusFilter} onChange={setStatusFilter} />
      </div>

      <div className="page-content">
        {loading ? (
          <div className="empty-state text-dim">Loading…</div>
        ) : clientGroups.length === 0 ? (
          <div className="empty-state text-dim">
            No {statusFilter.toLowerCase()} proofs found.
          </div>
        ) : (
          clientGroups.map(group => (
            <div key={group.clientId} style={{ marginBottom: 32 }}>
              {/* TODO: client bar, table, and drawer */}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
