// /api/mcp — MCP server endpoint (Vercel serverless, Node.js)
//
// Auth model (Phase 1):
//   - Valid bearer token → pass through to MCP handler below
//   - Missing / wrong token → 401 + WWW-Authenticate pointing to protected-resource metadata
//
// Token validation:
//   If WIKI_MCP_TOKEN env var is set, the incoming token must match exactly.
//   If the env var is unset (e.g. during local dev), any non-empty bearer token is accepted.
//   This keeps existing Claude Code traffic working without a config change.
const BASE = 'https://clientflow-gules.vercel.app'
const RESOURCE_METADATA_URL = `${BASE}/.well-known/oauth-protected-resource`

export default async function handler(req, res) {
  // ── CORS (MCP clients may be browser-based) ──────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()

  // ── Bearer token extraction ───────────────────────────────────────────────
  const auth  = req.headers['authorization'] || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null

  const expected = process.env.WIKI_MCP_TOKEN
  const valid    = token && (!expected || token === expected)

  if (!valid) {
    res.setHeader(
      'WWW-Authenticate',
      `Bearer resource_metadata="${RESOURCE_METADATA_URL}"`,
    )
    return res.status(401).json({
      error:             'unauthorized',
      error_description: 'A valid Bearer token is required.',
    })
  }

  // ── Authenticated — MCP handler ───────────────────────────────────────────
  // TODO Phase 2: wire in full MCP JSON-RPC dispatch here.
  // For now, respond with a minimal server_info so callers can confirm auth works.
  return res.status(200).json({
    jsonrpc: '2.0',
    result: {
      protocolVersion: '2024-11-05',
      serverInfo:      { name: 'clientflow-mcp', version: '0.1.0' },
      capabilities:    {},
    },
    id: null,
  })
}
