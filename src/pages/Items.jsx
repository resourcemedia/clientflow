import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { StatusBadge, Breadcrumb } from '../components/ui'

const isDemo = !import.meta.env.VITE_SUPABASE_URL

export default function ItemsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [items, setItems]                 = useState([])
  const [loading, setLoading]             = useState(true)
  const [search, setSearch]               = useState('')
  const [clientFilter, setClientFilter]   = useState('')
  const [productFilter, setProductFilter] = useState('')
  const [projectFilter, setProjectFilter] = useState(searchParams.get('project') || '')
  const [dragIdx, setDragIdx]             = useState(null)
  const [dragOverIdx, setDragOverIdx]     = useState(null)
  const dragFrom = useRef(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    if (!isDemo) {
      const { data, error } = await supabase
        .from('project_items')
        .select(`
          id, item_number, name, scheduled_date, status, sort_order,
          project:projects(
            id, name, product_type,
            client:clients(id, company, alias)
          ),
          proofs(id)
        `)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('item_number')
      if (error) console.error('items load error:', error)
      setItems(data || [])
    }
    setLoading(false)
  }

  // ── Derived dropdown options ──────────────────────────────────────────
  const uniqueClients = Object.values(
    items.reduce((acc, item) => {
      const c = item.project?.client
      if (c && !acc[c.id]) acc[c.id] = { id: c.id, label: c.company || c.alias || c.id }
      return acc
    }, {})
  ).sort((a, b) => a.label.localeCompare(b.label))

  const uniqueProducts = [...new Set(
    items.map(i => i.project?.product_type).filter(Boolean)
  )].sort()

  // Project dropdown respects active client filter
  const uniqueProjects = Object.values(
    items.reduce((acc, item) => {
      const p = item.project
      if (!p) return acc
      if (clientFilter && p.client?.id !== clientFilter) return acc
      if (!acc[p.id]) acc[p.id] = { id: p.id, label: p.name || p.id }
      return acc
    }, {})
  ).sort((a, b) => a.label.localeCompare(b.label))

  // ── Filter ────────────────────────────────────────────────────────────
  const q = search.toLowerCase()
  const today = new Date().toISOString().slice(0, 10)

  const filtered = items.filter(item => {
    const p = item.project
    const c = p?.client
    if (clientFilter  && c?.id             !== clientFilter)  return false
    if (productFilter && p?.product_type   !== productFilter) return false
    if (projectFilter && p?.id             !== projectFilter) return false
    if (q) {
      const nameMatch    = (item.name  || '').toLowerCase().includes(q)
      const projMatch    = (p?.name    || '').toLowerCase().includes(q)
      const clientMatch  = (c?.company || c?.alias || '').toLowerCase().includes(q)
      if (!nameMatch && !projMatch && !clientMatch) return false
    }
    return true
  })

  // ── Drag and drop ─────────────────────────────────────────────────────
  function handleDragStart(e, idx) {
    e.dataTransfer.effectAllowed = 'move'
    dragFrom.current = idx
    setDragIdx(idx)
  }

  function handleDragOver(e, idx) {
    e.preventDefault()
    setDragOverIdx(idx)
  }

  function handleDrop(toIdx) {
    const fromIdx = dragFrom.current
    if (fromIdx === null || fromIdx === toIdx) { reset(); return }

    // Reorder within the filtered view, then merge back
    const reordered = [...filtered]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)

    const filteredIds = new Set(filtered.map(i => i.id))
    const rest = items.filter(i => !filteredIds.has(i.id))
    setItems([...reordered, ...rest])
    reset()

    reordered.forEach((item, i) => {
      supabase.from('project_items').update({ sort_order: i }).eq('id', item.id).then(() => {})
    })
  }

  function reset() {
    setDragIdx(null)
    setDragOverIdx(null)
    dragFrom.current = null
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="fade-in">
      <div className="topbar">
        <Breadcrumb segments={[
          { label: 'Dashboard', onClick: () => navigate('/') },
          { label: 'Items' },
        ]} />

        <input
          type="text"
          placeholder="Search items, projects, clients…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: 220 }}
        />

        <select
          value={clientFilter}
          onChange={e => { setClientFilter(e.target.value); setProjectFilter('') }}
          style={{ width: 150 }}
        >
          <option value="">All clients</option>
          {uniqueClients.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>

        <select
          value={productFilter}
          onChange={e => setProductFilter(e.target.value)}
          style={{ width: 120 }}
        >
          <option value="">All products</option>
          {uniqueProducts.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <select
          value={projectFilter}
          onChange={e => setProjectFilter(e.target.value)}
          style={{ width: 180 }}
        >
          <option value="">All projects</option>
          {uniqueProjects.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </div>

      <div className="page-content">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Items</span>
            {!loading && (
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                {filtered.length} item{filtered.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="table-wrap">
            {loading ? (
              <div className="empty-state text-dim">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="empty-state text-dim">No items found.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 24 }}></th>
                    <th>Client</th>
                    <th>Product</th>
                    <th>Project</th>
                    <th>Item</th>
                    <th style={{ width: 60 }}>Order</th>
                    <th style={{ width: 80 }}>Proofs</th>
                    <th style={{ width: 120 }}>Scheduled</th>
                    <th style={{ width: 110 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item, idx) => {
                    const project    = item.project
                    const client     = project?.client
                    const proofCount = item.proofs?.length ?? 0
                    const isPast     = item.scheduled_date && item.scheduled_date < today

                    return (
                      <tr
                        key={item.id}
                        draggable
                        onDragStart={e => handleDragStart(e, idx)}
                        onDragOver={e => handleDragOver(e, idx)}
                        onDrop={() => handleDrop(idx)}
                        onDragEnd={reset}
                        style={{
                          opacity: dragIdx === idx ? 0.4 : 1,
                          outline: dragOverIdx === idx && dragIdx !== idx
                            ? '2px solid var(--accent)' : undefined,
                          cursor: 'default',
                        }}
                      >
                        <td style={{ cursor: 'grab', color: 'var(--text3)', fontSize: 15, userSelect: 'none', paddingRight: 0 }}>
                          ⠿
                        </td>

                        <td className="td-main">
                          {client?.company || client?.alias || '—'}
                        </td>

                        <td>
                          <StatusBadge status={project?.product_type} />
                        </td>

                        <td style={{ color: 'var(--text2)' }}>
                          {project
                            ? <button
                                className="btn btn-ghost btn-sm"
                                style={{ padding: '2px 6px', fontSize: 12 }}
                                onClick={() => navigate(`/projects/${project.id}`)}
                              >
                                {project.name}
                              </button>
                            : '—'}
                        </td>

                        <td>
                          <span className="text-mono text-dim" style={{ marginRight: 6 }}>
                            {item.item_number}
                          </span>
                          {item.name}
                        </td>

                        <td className="text-mono text-dim" style={{ fontSize: 12 }}>
                          {item.sort_order ?? '—'}
                        </td>

                        <td>
                          {proofCount > 0 ? (
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                              onClick={() => navigate(`/proofs?item=${item.id}`)}
                            >
                              View
                              <span className="nav-badge" style={{ position: 'static', minWidth: 18 }}>
                                {proofCount}
                              </span>
                            </button>
                          ) : (
                            <span style={{ color: 'var(--text3)' }}>—</span>
                          )}
                        </td>

                        <td
                          className="text-mono"
                          style={{
                            fontSize: 13,
                            color: isPast ? 'var(--red)' : 'var(--text2)',
                            fontWeight: isPast ? 600 : 400,
                          }}
                        >
                          {item.scheduled_date?.slice(0, 10) || '—'}
                        </td>

                        <td>
                          <StatusBadge status={item.status} />
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
