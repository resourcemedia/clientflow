import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Modal, FormGroup, Breadcrumb } from '../components/ui'

export default function ProductsPage() {
  const [products, setProducts]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [editProduct, setEditProduct] = useState(null)
  const [addingRow, setAddingRow] = useState(null) // null | { category: '', name: '' }
  const [dragIdx, setDragIdx]     = useState(null)
  const [dragOverIdx, setDragOverIdx] = useState(null)
  const addInputRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => { loadProducts() }, [])

  useEffect(() => {
    if (addingRow !== null) addInputRef.current?.focus()
  }, [addingRow])

  async function loadProducts() {
    setLoading(true)
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('name')
    if (error) console.error('products load error:', error)
    setProducts(data || [])
    setLoading(false)
  }

  // ── inline add ──────────────────────────────────────────────────────────
  function startAdd() {
    setAddingRow({ category: '', name: '' })
  }

  async function handleAddSave() {
    const name = addingRow?.name?.trim()
    if (!name) { setAddingRow(null); return }
    const { data } = await supabase
      .from('products')
      .insert({ category: addingRow.category?.trim() || null, name })
      .select()
      .single()
    if (data) setProducts(prev => [...prev, data])
    setAddingRow(null)
  }

  function handleAddKeyDown(e) {
    if (e.key === 'Enter')  handleAddSave()
    if (e.key === 'Escape') setAddingRow(null)
  }

  // ── drag-and-drop ───────────────────────────────────────────────────────
  function handleDragStart(e, idx) {
    e.dataTransfer.effectAllowed = 'move'
    setDragIdx(idx)
  }

  function handleDragOver(e, idx) {
    e.preventDefault()
    setDragOverIdx(idx)
  }

  async function handleDrop(toIdx) {
    if (dragIdx === null || dragIdx === toIdx) { reset(); return }
    const reordered = [...products]
    const [moved] = reordered.splice(dragIdx, 1)
    reordered.splice(toIdx, 0, moved)
    setProducts(reordered)
    reset()
    reordered.forEach((p, i) => {
      supabase.from('products').update({ sort_order: i }).eq('id', p.id).then(() => {})
    })
  }

  function reset() { setDragIdx(null); setDragOverIdx(null) }

  // ── render ───────────────────────────────────────────────────────────────
  return (
    <div className="fade-in">
      <div className="topbar">
        <Breadcrumb segments={[
          { label: 'Dashboard', onClick: () => navigate('/') },
          { label: 'Products' },
        ]} />
        <button className="btn btn-ghost" onClick={startAdd}>+ Add product</button>
      </div>

      <div className="page-content">
        <div className="card">
          <div className="table-wrap">
            {loading ? (
              <div className="empty-state"><div className="text-dim">Loading…</div></div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 24 }}></th>
                    <th style={{ width: 80 }}>Category</th>
                    <th>Name</th>
                    <th style={{ width: 80 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product, idx) => (
                    <tr
                      key={product.id}
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
                      <td style={{
                        cursor: 'grab', color: 'var(--text3)',
                        fontSize: 15, userSelect: 'none', paddingRight: 0,
                      }}>
                        ⠿
                      </td>
                      <td>
                        <span style={{
                          fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                          color: 'var(--text2)', textTransform: 'uppercase',
                        }}>
                          {product.category || '—'}
                        </span>
                      </td>
                      <td className="td-main">{product.name}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ marginRight: 4 }}
                          onClick={startAdd}
                          title="Add new product"
                        >
                          +
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setEditProduct(product)}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}

                  {/* Inline add row */}
                  {addingRow !== null && (
                    <tr style={{ background: 'var(--accent-glow)' }}>
                      <td></td>
                      <td>
                        <input
                          ref={addInputRef}
                          value={addingRow.category}
                          onChange={e => setAddingRow(r => ({ ...r, category: e.target.value }))}
                          placeholder="e.g. ST"
                          onKeyDown={handleAddKeyDown}
                          style={{ width: 64 }}
                        />
                      </td>
                      <td>
                        <input
                          value={addingRow.name}
                          onChange={e => setAddingRow(r => ({ ...r, name: e.target.value }))}
                          placeholder="Product name…"
                          onKeyDown={handleAddKeyDown}
                          style={{ width: '100%' }}
                        />
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="btn btn-primary btn-sm" style={{ marginRight: 4 }} onClick={handleAddSave}>
                          Save
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setAddingRow(null)}>
                          Cancel
                        </button>
                      </td>
                    </tr>
                  )}

                  {/* Empty state */}
                  {products.length === 0 && addingRow === null && (
                    <tr>
                      <td colSpan={4} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text3)' }}>
                        No products yet.{' '}
                        <button className="btn btn-ghost btn-sm" onClick={startAdd}>
                          + Add first product
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Edit modal */}
      {editProduct && (
        <ProductModal
          product={editProduct}
          onClose={() => setEditProduct(null)}
          onSaved={() => { setEditProduct(null); loadProducts() }}
        />
      )}
    </div>
  )
}

// ── PRODUCT EDIT MODAL ────────────────────────────────────────────────────
function ProductModal({ product, onClose, onSaved }) {
  const [form, setForm] = useState({
    category: product?.category || '',
    name:     product?.name     || '',
  })
  const [saving, setSaving] = useState(false)

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function save() {
    if (!form.name.trim()) return
    setSaving(true)
    await supabase.from('products').update({
      category: form.category.trim() || null,
      name:     form.name.trim(),
    }).eq('id', product.id)
    setSaving(false)
    onSaved()
  }

  return (
    <Modal
      title={`Edit — ${product.name}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <FormGroup label="Category">
          <input value={form.category} onChange={set('category')} placeholder="e.g. ST" />
        </FormGroup>
        <FormGroup label="Product name" full>
          <input value={form.name} onChange={set('name')} placeholder="e.g. Social Media" />
        </FormGroup>
      </div>
    </Modal>
  )
}
