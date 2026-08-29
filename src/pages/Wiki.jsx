import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// ── helpers ────────────────────────────────────────────────────────────────
function slugify(s) {
  return String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

// Resolve a [[wikilink]] target to a loaded page: exact slug, then title
// (case-insensitive), then slugified target. Returns the page row or null.
function makeResolver(pages) {
  const bySlug = new Map(pages.map(p => [p.slug, p]))
  const byTitle = new Map(pages.map(p => [String(p.title).toLowerCase(), p]))
  return (target) => {
    const t = String(target).trim()
    return bySlug.get(t) || byTitle.get(t.toLowerCase()) || bySlug.get(slugify(t)) || null
  }
}

const INLINE_RE = /(`[^`]+`)|(\[\[[^\]]+\]\])|(\[[^\]]+\]\([^)]+\))|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(!\[[^\]]*\]\([^)]+\))/g

// Parse inline markdown + [[wikilinks]] into an array of React nodes.
function parseInline(text, resolve, navigate, keyBase) {
  const nodes = []
  let last = 0, i = 0, m
  INLINE_RE.lastIndex = 0
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    const tok = m[0]
    const key = keyBase + '-' + i
    if (m[1]) {
      nodes.push(<code key={key} style={CODE_STYLE}>{tok.slice(1, -1)}</code>)
    } else if (m[2]) {
      const inner = tok.slice(2, -2)
      const bar = inner.indexOf('|')
      const target = (bar === -1 ? inner : inner.slice(0, bar)).trim()
      const label = (bar === -1 ? inner : inner.slice(bar + 1)).trim()
      const page = resolve(target)
      if (page) {
        nodes.push(
          <a key={key} href={'/wiki/' + page.slug} style={LINK_STYLE}
             onClick={(e) => { e.preventDefault(); navigate('/wiki/' + page.slug) }}>
            {label}
          </a>
        )
      } else {
        nodes.push(<span key={key} style={BROKEN_STYLE} title="No page with this name yet">{label}</span>)
      }
    } else if (m[3]) {
      const mm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok)
      nodes.push(
        <a key={key} href={mm[2]} target="_blank" rel="noopener noreferrer" style={LINK_STYLE}>
          {mm[1]}
        </a>
      )
    } else if (m[4]) {
      nodes.push(<strong key={key}>{tok.slice(2, -2)}</strong>)
    } else if (m[5]) {
      nodes.push(<em key={key}>{tok.slice(1, -1)}</em>)
    } else if (m[6]) {
      const im = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(tok)
      nodes.push(
        <img key={key} src={im[2]} alt={im[1]}
             style={{ maxWidth: '100%', height: 'auto', borderRadius: 6, display: 'block', margin: '10px 0' }} />
      )
    }
    last = INLINE_RE.lastIndex
    i++
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

// GFM pipe-table helpers (dependency-free).
const TABLE_DELIM_RE = /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/
function splitTableRow(line) {
  let s = line.trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|')) s = s.slice(0, -1)
  return s.split('|').map(c => c.trim())
}
function tableAlign(cell) {
  const c = cell.trim()
  const l = c.startsWith(':'), r = c.endsWith(':')
  if (l && r) return 'center'
  if (r) return 'right'
  return 'left'
}

// Block-level render: headings, bullet lists, paragraphs, tables. Dependency-free.
function renderBody(body, resolve, navigate) {
  const lines = String(body || '').replace(/\r\n/g, '\n').split('\n')
  const blocks = []
  let para = []
  let list = []
  const flushPara = () => {
    if (para.length) {
      const key = 'p' + blocks.length
      const inner = []
      para.forEach((ln, idx) => {
        if (idx > 0) inner.push(<br key={key + '-br' + idx} />)
        inner.push(...parseInline(ln, resolve, navigate, key + '-' + idx))
      })
      blocks.push(<p key={key} style={{ margin: '0 0 14px', lineHeight: 1.7 }}>{inner}</p>)
      para = []
    }
  }
  const flushList = () => {
    if (list.length) {
      const key = 'ul' + blocks.length
      blocks.push(
        <ul key={key} style={{ margin: '0 0 14px 20px', lineHeight: 1.7 }}>
          {list.map((item, idx) => (
            <li key={key + '-' + idx}>{parseInline(item, resolve, navigate, key + '-' + idx)}</li>
          ))}
        </ul>
      )
      list = []
    }
  }
  for (let bi = 0; bi < lines.length; bi++) {
    const raw = lines[bi]
    const line = raw.replace(/\s+$/, '')
    // GFM pipe table: a header row + delimiter row, then pipe rows.
    if (line.includes('|') && bi + 1 < lines.length &&
        lines[bi + 1].includes('|') && TABLE_DELIM_RE.test(lines[bi + 1])) {
      flushPara(); flushList()
      const key = 't' + blocks.length
      const headers = splitTableRow(line)
      const aligns = splitTableRow(lines[bi + 1]).map(tableAlign)
      const rows = []
      let j = bi + 2
      while (j < lines.length && lines[j].includes('|') && lines[j].trim() !== '') {
        rows.push(splitTableRow(lines[j])); j++
      }
      blocks.push(
        <div key={key} style={{ overflowX: 'auto', margin: '0 0 14px' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 14 }}>
            <thead>
              <tr>
                {headers.map((c, ci) => (
                  <th key={ci} style={{ border: '1px solid var(--border)', padding: '6px 10px', textAlign: aligns[ci] || 'left', background: 'var(--bg)', fontWeight: 600 }}>
                    {parseInline(c, resolve, navigate, key + '-h' + ci)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>
                  {headers.map((_, ci) => (
                    <td key={ci} style={{ border: '1px solid var(--border)', padding: '6px 10px', textAlign: aligns[ci] || 'left', verticalAlign: 'top' }}>
                      {parseInline(r[ci] || '', resolve, navigate, key + '-r' + ri + '-' + ci)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      bi = j - 1
      continue
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line)
    const li = /^\s*[-*]\s+(.*)$/.exec(line)
    if (h) {
      flushPara(); flushList()
      const level = h[1].length
      const size = level === 1 ? 22 : level === 2 ? 18 : 15
      const key = 'h' + blocks.length
      blocks.push(
        <div key={key} style={{ fontFamily: 'Fraunces, serif', fontWeight: 600, fontSize: size, color: 'var(--text)', margin: '18px 0 10px' }}>
          {parseInline(h[2], resolve, navigate, key)}
        </div>
      )
    } else if (li) {
      flushPara()
      list.push(li[1])
    } else if (line.trim() === '') {
      flushPara(); flushList()
    } else {
      flushList()
      para.push(line)
    }
  }
  flushPara(); flushList()
  return blocks
}

const LINK_STYLE   = { color: 'var(--accent)', textDecoration: 'none', cursor: 'pointer', fontWeight: 500 }
const BROKEN_STYLE = { color: 'var(--text2)', borderBottom: '1px dashed var(--border)', cursor: 'help' }
const CODE_STYLE   = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.88em', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 5px' }

const PRIMARY_BTN   = { background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const SECONDARY_BTN = { background: 'transparent', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }
const DANGER_BTN    = { background: 'transparent', color: '#dc2626', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }
const INPUT_STYLE   = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontSize: 15, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', color: 'var(--text)' }

function fmtDate(ts) {
  if (!ts) return ''
  try { return new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) }
  catch { return '' }
}

const byUpdatedDesc = (a, b) => (String(a.updated_at) < String(b.updated_at) ? 1 : -1)

// ── component ────────────────────────────────────────────────────────────────
export default function WikiPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [pages, setPages]     = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null) // null | { slug?, title, body, isNew }
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => { document.title = 'Wiki' }, [])
  useEffect(() => { load() }, [])
  // Leaving edit mode whenever the route changes keeps state predictable.
  useEffect(() => { setEditing(null); setError('') }, [slug])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('pages')
      .select('*')
      .order('updated_at', { ascending: false })
    if (error) console.error('wiki load error:', error)
    setPages(data || [])
    setLoading(false)
  }

  const resolve = useMemo(() => makeResolver(pages), [pages])
  const current = slug ? pages.find(p => p.slug === slug) : null

  function startCreate() { setError(''); setEditing({ title: '', body: '', isNew: true }) }
  function startEdit(p)  { setError(''); setEditing({ slug: p.slug, title: p.title, body: p.body || '', isNew: false }) }
  function cancelEdit()  { setError(''); setEditing(null) }

  async function save() {
    const title = (editing.title || '').trim()
    if (!title) { setError('Please enter a title.'); return }
    setSaving(true); setError('')
    const now = new Date().toISOString()

    if (editing.isNew) {
      const newSlug = slugify(title)
      if (!newSlug) { setError('Title needs at least one letter or number.'); setSaving(false); return }
      if (pages.some(p => p.slug === newSlug)) { setError('A page already exists at /' + newSlug + '.'); setSaving(false); return }
      const { data, error } = await supabase
        .from('pages')
        .insert({ slug: newSlug, title, body: editing.body || '', created_at: now, updated_at: now })
        .select()
        .single()
      if (error) {
        setError(error.code === '23505' ? ('A page already exists at /' + newSlug + '.') : ('Could not save: ' + error.message))
        setSaving(false); return
      }
      setPages(prev => [data, ...prev.filter(p => p.id !== data.id)].sort(byUpdatedDesc))
      setEditing(null); setSaving(false)
      navigate('/wiki/' + data.slug)
    } else {
      const { data, error } = await supabase
        .from('pages')
        .update({ title, body: editing.body || '', updated_at: now })
        .eq('slug', editing.slug)
        .select()
        .single()
      if (error) { setError('Could not save: ' + error.message); setSaving(false); return }
      setPages(prev => [...prev.filter(p => p.id !== data.id), data].sort(byUpdatedDesc))
      setEditing(null); setSaving(false)
    }
  }

  async function handleDelete(p) {
    if (!window.confirm('Delete "' + p.title + '"? This cannot be undone.')) return
    const { error } = await supabase.from('pages').delete().eq('id', p.id)
    if (error) { window.alert('Could not delete: ' + error.message); return }
    setPages(prev => prev.filter(x => x.id !== p.id))
    navigate('/wiki')
  }

  // ── editor ──────────────────────────────────────────────────────────────
  function renderEditor() {
    return (
      <div className="card">
        <div style={{ padding: '20px 24px' }}>
          <div style={{ fontFamily: 'Fraunces, serif', fontWeight: 600, fontSize: 20, color: 'var(--text)', marginBottom: 16 }}>
            {editing.isNew ? 'New page' : 'Editing: ' + editing.title}
          </div>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>Title</label>
          <input
            autoFocus
            style={{ ...INPUT_STYLE, marginBottom: 16 }}
            value={editing.title}
            onChange={(e) => setEditing({ ...editing, title: e.target.value })}
            placeholder="Page title"
          />
          {editing.isNew && (
            <div style={{ fontSize: 12, color: 'var(--text2)', margin: '-10px 0 16px' }}>
              URL will be <code style={CODE_STYLE}>/{slugify(editing.title) || '…'}</code>
            </div>
          )}
          <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>Body</label>
          <textarea
            style={{ ...INPUT_STYLE, minHeight: 280, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13, lineHeight: 1.6, resize: 'vertical' }}
            value={editing.body}
            onChange={(e) => setEditing({ ...editing, body: e.target.value })}
            placeholder="Write in markdown…"
          />
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 8 }}>
            Supports <code style={CODE_STYLE}>[[Page Name]]</code> wikilinks, <code style={CODE_STYLE}>**bold**</code>, <code style={CODE_STYLE}>*italic*</code>, <code style={CODE_STYLE}>`code`</code>, <code style={CODE_STYLE}># headings</code>, <code style={CODE_STYLE}>- lists</code>, and <code style={CODE_STYLE}>[text](url)</code>.
          </div>
          {error && (
            <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 6, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)', color: '#dc2626', fontSize: 13 }}>
              {error}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            <button style={{ ...PRIMARY_BTN, opacity: saving ? 0.6 : 1 }} disabled={saving} onClick={save}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button style={SECONDARY_BTN} disabled={saving} onClick={cancelEdit}>Cancel</button>
          </div>
        </div>
      </div>
    )
  }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="fade-in">
      <div className="topbar">
        <div className="topbar-title">Wiki</div>
      </div>
      <div className="page-content">
        {loading ? (
          <div className="card"><div style={{ padding: 32, color: 'var(--text2)' }}>Loading…</div></div>
        ) : editing ? (
          renderEditor()
        ) : slug ? (
          <div className="card">
            <div style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
                <a href="/wiki" onClick={(e) => { e.preventDefault(); navigate('/wiki') }}
                   style={{ ...LINK_STYLE, fontSize: 13 }}>
                  ← All pages
                </a>
                {current && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={SECONDARY_BTN} onClick={() => startEdit(current)}>Edit</button>
                    <button style={DANGER_BTN} onClick={() => handleDelete(current)}>Delete</button>
                  </div>
                )}
              </div>
              {current ? (
                <>
                  <div style={{ fontFamily: 'Fraunces, serif', fontWeight: 600, fontSize: 26, color: 'var(--text)', marginBottom: 4 }}>
                    {current.title}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 20 }}>
                    /{current.slug} · updated {fmtDate(current.updated_at)}
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--text)' }}>
                    {current.body && current.body.trim()
                      ? renderBody(current.body, resolve, navigate)
                      : <div style={{ color: 'var(--text2)', fontStyle: 'italic' }}>This page is empty.</div>}
                  </div>
                </>
              ) : (
                <div style={{ padding: '32px 0', color: 'var(--text2)' }}>
                  No page found at <code style={CODE_STYLE}>/{slug}</code>.
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button style={PRIMARY_BTN} onClick={startCreate}>+ New page</button>
            </div>
            <div className="card">
              <div style={{ padding: '8px 0' }}>
                {pages.length === 0 ? (
                  <div style={{ padding: 32, color: 'var(--text2)' }}>No pages yet. Create your first with “New page”.</div>
                ) : pages.map((p, idx) => (
                  <a key={p.id} href={'/wiki/' + p.slug}
                     onClick={(e) => { e.preventDefault(); navigate('/wiki/' + p.slug) }}
                     style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16,
                              padding: '12px 24px', textDecoration: 'none', color: 'inherit',
                              borderTop: idx === 0 ? 'none' : '1px solid var(--border)', cursor: 'pointer' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: 'Fraunces, serif', fontWeight: 600, fontSize: 16, color: 'var(--text)' }}>
                        {p.title}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>/{p.slug}</div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text2)', whiteSpace: 'nowrap' }}>{fmtDate(p.updated_at)}</div>
                  </a>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
