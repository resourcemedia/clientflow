// RFC 9728 — OAuth 2.0 Protected Resource Metadata
// Tells OAuth clients which authorization server gates this resource.
// Served at /.well-known/oauth-protected-resource via vercel.json rewrite.
const BASE = 'https://clientflow-gules.vercel.app'

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).end()

  res.setHeader('Cache-Control', 'public, max-age=3600')
  return res.status(200).json({
    resource:             `${BASE}/api/mcp`,
    authorization_servers: [BASE],
  })
}
