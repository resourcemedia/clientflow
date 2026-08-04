// api/oauth/register.ts
//
// RFC 7591 — OAuth 2.0 Dynamic Client Registration.
// Public clients only (the AS metadata advertises
// token_endpoint_auth_methods_supported: ['none']) — no client_secret is
// ever issued. Registration itself is intentionally open per spec; it only
// creates an identity a redirect_uri can later be checked against. The
// actual gate on the flow is the password step in /api/oauth/authorize.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

function isNonEmptyStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.length > 0 && v.every(x => typeof x === 'string' && x.length > 0)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'invalid_request', error_description: 'POST only.' })
    return
  }

  const body = req.body ?? {}
  const redirect_uris = body.redirect_uris

  if (!isNonEmptyStringArray(redirect_uris)) {
    res.status(400).json({ error: 'invalid_client_metadata', error_description: 'redirect_uris must be a non-empty array of strings.' })
    return
  }
  for (const uri of redirect_uris) {
    try {
      new URL(uri)
    } catch {
      res.status(400).json({ error: 'invalid_redirect_uri', error_description: `Not a valid URI: ${uri}` })
      return
    }
  }

  const client_id = randomBytes(24).toString('base64url')
  const client_name = typeof body.client_name === 'string' ? body.client_name.slice(0, 200) : null

  const { error } = await supabase.from('oauth_clients').insert({ client_id, redirect_uris, client_name })
  if (error) {
    console.error('[oauth/register] insert failed:', error)
    res.status(500).json({ error: 'server_error' })
    return
  }

  // grant_types/response_types/token_endpoint_auth_method are fixed by this
  // AS (see oauth-authorization-server.js) — echoed back, not taken from the
  // request, since we only ever support the one flow.
  res.status(201).json({
    client_id,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    redirect_uris,
    client_name,
    grant_types: ['authorization_code'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
  })
}
