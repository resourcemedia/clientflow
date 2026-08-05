// api/oauth/token.ts
//
// Token endpoint. Two grant types:
//  - authorization_code: exchanges a single-use code (from /api/oauth/authorize)
//    for an access token + refresh token, after verifying PKCE.
//  - refresh_token: rotates a refresh token for a new access token + refresh
//    token pair, so the connection doesn't need the password re-entered every
//    time the 1h access token expires.
//
// Rotation means reuse of an already-exchanged refresh token fails closed —
// the old row is atomically revoked on first use (UPDATE ... WHERE
// revoked_at IS NULL RETURNING, not SELECT-then-UPDATE, which would race
// under concurrent exchange attempts). That's how a public client gets
// refresh tokens without proof-of-possession: theft is detectable because
// the legitimate client's next refresh attempt will fail.
//
// Refresh tokens are stored as a SHA-256 hash, not the raw value — unlike
// the 5-minute auth code, a refresh token lives for months, so it deserves
// the same care as an API key: a DB leak alone shouldn't hand out live
// sessions.
//
// Phase 3 will make /api/mcp actually verify these tokens; this endpoint
// just mints them.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHash, randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { SignJWT } from 'jose'

const BASE = 'https://clientflow-gules.vercel.app'
const ACCESS_TOKEN_TTL = '1h'
const ACCESS_TOKEN_TTL_SECONDS = 3600
const REFRESH_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000 // 90 days

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
)
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!)

function challengeFromVerifier(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

async function issueTokens(res: VercelResponse, client_id: string): Promise<void> {
  const access_token = await new SignJWT({ client_id })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(BASE)
    .setAudience(`${BASE}/api/mcp`)
    .setSubject('owner')
    .setExpirationTime(ACCESS_TOKEN_TTL)
    .sign(JWT_SECRET)

  const refresh_token = randomBytes(32).toString('base64url')
  const { error } = await supabase.from('oauth_refresh_tokens').insert({
    token_hash: hashToken(refresh_token),
    client_id,
    expires_at: new Date(Date.now() + REFRESH_TOKEN_TTL_MS).toISOString(),
  })
  if (error) {
    console.error('[oauth/token] refresh token insert failed:', error)
    res.status(500).json({ error: 'server_error' })
    return
  }

  res.status(200).json({
    access_token,
    refresh_token,
    token_type: 'Bearer',
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Pragma', 'no-cache')

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'invalid_request', error_description: 'POST only.' })
    return
  }

  const body = (req.body ?? {}) as Record<string, unknown>
  const { grant_type } = body

  if (grant_type === 'authorization_code') {
    const { code, redirect_uri, client_id, code_verifier } = body
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
      console.error('[oauth/token] code claim failed:', claimError)
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

    await issueTokens(res, client_id)
    return
  }

  if (grant_type === 'refresh_token') {
    const { refresh_token, client_id } = body
    if (typeof refresh_token !== 'string') {
      res.status(400).json({ error: 'invalid_request', error_description: 'refresh_token is required.' })
      return
    }

    const { data: claimed, error: claimError } = await supabase
      .from('oauth_refresh_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('token_hash', hashToken(refresh_token))
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .select()
      .maybeSingle()

    if (claimError) {
      console.error('[oauth/token] refresh claim failed:', claimError)
      res.status(500).json({ error: 'server_error' })
      return
    }
    if (!claimed) {
      res.status(400).json({
        error: 'invalid_grant',
        error_description: 'Refresh token is invalid, expired, or already used.',
      })
      return
    }
    if (typeof client_id === 'string' && claimed.client_id !== client_id) {
      res.status(400).json({ error: 'invalid_grant', error_description: 'client_id does not match this refresh token.' })
      return
    }

    await issueTokens(res, claimed.client_id)
    return
  }

  res.status(400).json({ error: 'unsupported_grant_type' })
}
