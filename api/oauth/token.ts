// api/oauth/token.ts
//
// Token endpoint: exchanges a single-use authorization code (issued by
// /api/oauth/authorize) for a signed JWT access token, after verifying the
// PKCE code_verifier against the code_challenge stored with the code.
//
// One-time use is enforced with an atomic UPDATE ... WHERE used_at IS NULL
// RETURNING *, not a SELECT-then-UPDATE — the latter would let two
// concurrent exchange attempts for the same code both slip through.
//
// Phase 3 will make /api/mcp actually verify these tokens; this endpoint
// just mints them.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { SignJWT } from 'jose'

const BASE = 'https://clientflow-gules.vercel.app'
const ACCESS_TOKEN_TTL = '1h'
const ACCESS_TOKEN_TTL_SECONDS = 3600

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
)
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!)

function challengeFromVerifier(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Pragma', 'no-cache')

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'invalid_request', error_description: 'POST only.' })
    return
  }

  const body = (req.body ?? {}) as Record<string, unknown>
  const { grant_type, code, redirect_uri, client_id, code_verifier } = body

  if (grant_type !== 'authorization_code') {
    res.status(400).json({ error: 'unsupported_grant_type' })
    return
  }
  if (
    typeof code !== 'string' ||
    typeof code_verifier !== 'string' ||
    typeof redirect_uri !== 'string' ||
    typeof client_id !== 'string'
  ) {
    res.status(400).json({
      error: 'invalid_request',
      error_description: 'code, redirect_uri, client_id, and code_verifier are required.',
    })
    return
  }

  const { data: claimed, error: claimError } = await supabase
    .from('oauth_codes')
    .update({ used_at: new Date().toISOString() })
    .eq('code', code)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .select()
    .maybeSingle()

  if (claimError) {
    console.error('[oauth/token] claim failed:', claimError)
    res.status(500).json({ error: 'server_error' })
    return
  }
  if (!claimed) {
    res.status(400).json({ error: 'invalid_grant', error_description: 'Code is invalid, expired, or already used.' })
    return
  }
  if (claimed.client_id !== client_id || claimed.redirect_uri !== redirect_uri) {
    res.status(400).json({
      error: 'invalid_grant',
      error_description: 'client_id or redirect_uri does not match the authorization request.',
    })
    return
  }
  if (challengeFromVerifier(code_verifier) !== claimed.code_challenge) {
    res.status(400).json({ error: 'invalid_grant', error_description: 'code_verifier does not match code_challenge.' })
    return
  }

  const access_token = await new SignJWT({ client_id })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(BASE)
    .setAudience(`${BASE}/api/mcp`)
    .setSubject('owner')
    .setExpirationTime(ACCESS_TOKEN_TTL)
    .sign(JWT_SECRET)

  res.status(200).json({
    access_token,
    token_type: 'Bearer',
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
  })
}
