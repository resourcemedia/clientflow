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

const INLINE_RE = /(`[^`]+`)|(\[\[[^\]]+\]\])|(\[[^\]]+\]\([^)]+\))|(\*\*[^*]+\*\*)|(\*[^*]+\*)/g

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
    }
    last = INLINE_RE.lastIndex
    i++
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

// Block-level render: headings, bullet lists, paragraphs. Dependency-free.
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
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '')
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

function fmtDate(ts) {
  if (!ts) return ''
  try { return new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) }
  catch { return '' }
}

// ── component ────────────────────────────────────────────────────────────────
export default function WikiPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [pages, setPages]     = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { document.title = 'Wiki' }, [])
  useEffect(() => { load() }, [])

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

  return (
    <div className="fade-in">
      <div className="topbar">
        <div className="topbar-title">Wiki</div>
      </div>
      <div className="page-content">
        {loading ? (
          <div className="card"><div style={{ padding: 32, color: 'var(--text2)' }}>Loading…</div></div>
        ) : slug ? (
          <div className="card">
            <div style={{ padding: '20px 24px' }}>
              <a href="/wiki" onClick={(e) => { e.preventDefault(); navigate('/wiki') }}
                 style={{ ...LINK_STYLE, fontSize: 13, display: 'inline-block', marginBottom: 16 }}>
                ← All pages
              </a>
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
          <div className="card">
            <div style={{ padding: '8px 0' }}>
              {pages.length === 0 ? (
                <div style={{ padding: 32, color: 'var(--text2)' }}>No pages yet.</div>
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
        )}
      </div>
    </div>
  )
}
