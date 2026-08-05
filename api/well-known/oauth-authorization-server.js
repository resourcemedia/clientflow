// RFC 8414 — OAuth 2.0 Authorization Server Metadata
// Advertises the AS endpoints implemented in api/oauth/*.
// Served at /.well-known/oauth-authorization-server via vercel.json rewrite.
const BASE = 'https://clientflow-gules.vercel.app'

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).end()

  res.setHeader('Cache-Control', 'public, max-age=3600')
  return res.status(200).json({
    issuer:                                BASE,
    authorization_endpoint:               `${BASE}/api/oauth/authorize`,
    token_endpoint:                        `${BASE}/api/oauth/token`,
    registration_endpoint:                 `${BASE}/api/oauth/register`,
    response_types_supported:             ['code'],
    grant_types_supported:                ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported:     ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
  })
}
