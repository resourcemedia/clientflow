// api/mcp.ts
//
// MCP Streamable-HTTP endpoint exposing the wiki's five tools to Claude.
// This is a native Vercel Node serverless function (not a Next.js route —
// ClientFlow is a Vite SPA) because the MCP SDK's Node transport needs
// Node's IncomingMessage/ServerResponse, which the Edge runtime doesn't have.
//
// Ported from wiki-starter/mcp-route.ts: Prisma -> supabase-js (service role,
// bypasses RLS), camelCase fields -> snake_case columns. Stateless mode
// (sessionIdGenerator: undefined) — a fresh McpServer + transport per
// request, per the SDK's own simpleStatelessStreamableHttp example, since
// serverless functions can't hold session state between invocations.
//
// AUTH (MVP): a single bearer token, checked before the SDK ever sees the
// request. Claude sends it via the connector's "Request headers" field.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

const WIKI_TOKEN = process.env.WIKI_MCP_TOKEN!
const RESOURCE_METADATA_URL = 'https://clientflow-gules.vercel.app/.well-known/oauth-protected-resource'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

// Pull [[wikilinks]] out of a body so the graph stays queryable.
function parseLinks(body: string): string[] {
  const slugs = new Set<string>()
  for (const m of body.matchAll(/\[\[([^\]]+)\]\]/g)) {
    slugs.add(m[1].trim().toLowerCase().replace(/\s+/g, '-'))
  }
  return [...slugs]
}

async function syncLinks(sourceId: string, body: string) {
  const targets = parseLinks(body)
  const { error: delError } = await supabase.from('links').delete().eq('source_id', sourceId)
  if (delError) throw delError
  if (targets.length) {
    const { error: insError } = await supabase
      .from('links')
      .insert(targets.map(target_slug => ({ source_id: sourceId, target_slug })))
    if (insError) throw insError
  }
}

function buildServer() {
  const server = new McpServer({ name: 'clientflow-wiki', version: '1.0.0' })

  server.registerTool(
    'list_pages',
    {
      description: 'List all wiki pages (slug + title), most recently updated first.',
      inputSchema: { limit: z.number().max(200).default(50) },
      annotations: { readOnlyHint: true },
    },
    async ({ limit }) => {
      const { data, error } = await supabase
        .from('pages')
        .select('slug, title, updated_at')
        .order('updated_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.registerTool(
    'search_pages',
    {
      description: 'Case-insensitive search across page titles and bodies.',
      inputSchema: { query: z.string() },
      annotations: { readOnlyHint: true },
    },
    async ({ query }) => {
      // Two separate ilike queries + merge, rather than interpolating `query`
      // into a single .or() filter string — the PostgREST filter DSL treats
      // commas/parens as syntax, so raw interpolation there would let a
      // crafted query string inject extra filter clauses.
      const [byTitle, byBody] = await Promise.all([
        supabase.from('pages').select('slug, title').ilike('title', `%${query}%`).limit(20),
        supabase.from('pages').select('slug, title').ilike('body', `%${query}%`).limit(20),
      ])
      if (byTitle.error) throw byTitle.error
      if (byBody.error) throw byBody.error
      const bySlug = new Map<string, { slug: string; title: string }>()
      for (const p of [...byTitle.data, ...byBody.data]) bySlug.set(p.slug, p)
      const pages = [...bySlug.values()].slice(0, 20)
      return { content: [{ type: 'text', text: JSON.stringify(pages, null, 2) }] }
    }
  )

  server.registerTool(
    'get_page',
    {
      description: "Get one page's full content by slug, including its outgoing links.",
      inputSchema: { slug: z.string() },
      annotations: { readOnlyHint: true },
    },
    async ({ slug }) => {
      const { data: page, error } = await supabase.from('pages').select('*').eq('slug', slug).maybeSingle()
      if (error) throw error
      if (!page) return { content: [{ type: 'text', text: `No page: ${slug}` }] }
      const { data: linksOut, error: linksError } = await supabase
        .from('links')
        .select('target_slug')
        .eq('source_id', page.id)
      if (linksError) throw linksError
      return { content: [{ type: 'text', text: JSON.stringify({ ...page, linksOut }, null, 2) }] }
    }
  )

  server.registerTool(
    'create_page',
    {
      description: 'Create a new wiki page. Body is markdown and may use [[wikilinks]].',
      inputSchema: { slug: z.string(), title: z.string(), body: z.string().default('') },
    },
    async ({ slug, title, body }) => {
      const { data: page, error } = await supabase.from('pages').insert({ slug, title, body }).select().single()
      if (error) throw error
      await syncLinks(page.id, body)
      return { content: [{ type: 'text', text: `Created ${slug}` }] }
    }
  )

  server.registerTool(
    'update_page',
    {
      description: 'Replace the title and/or body of an existing page by slug.',
      inputSchema: { slug: z.string(), title: z.string().optional(), body: z.string().optional() },
    },
    async ({ slug, title, body }) => {
      const updates: Record<string, string> = {}
      if (title !== undefined) updates.title = title
      if (body !== undefined) updates.body = body
      if (Object.keys(updates).length === 0) {
        return { content: [{ type: 'text', text: 'Nothing to update — provide title and/or body.' }] }
      }
      const { data: page, error } = await supabase.from('pages').update(updates).eq('slug', slug).select().single()
      if (error) throw error
      if (body !== undefined) await syncLinks(page.id, body)
      return { content: [{ type: 'text', text: `Updated ${slug}` }] }
    }
  )

  return server
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.headers['authorization'] !== `Bearer ${WIKI_TOKEN}`) {
    res.setHeader('WWW-Authenticate', `Bearer resource_metadata="${RESOURCE_METADATA_URL}"`)
    res.status(401).json({ error: 'unauthorized', error_description: 'A valid Bearer token is required.' })
    return
  }

  // Stateless mode only supports request/response — no session to stream
  // server-initiated notifications or terminate over GET/DELETE.
  if (req.method !== 'POST') {
    res.status(405).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method not allowed.' },
      id: null,
    })
    return
  }

  const server = buildServer()
  try {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
    res.on('close', () => {
      transport.close()
      server.close()
    })
    await server.connect(transport)
    await transport.handleRequest(req, res, req.body)
  } catch (err) {
    console.error('[mcp] request failed:', err)
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      })
    }
  }
}
