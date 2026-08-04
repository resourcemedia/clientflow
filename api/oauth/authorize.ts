// api/oauth/authorize.ts
//
// Authorization endpoint. Since this wiki has exactly one user, "consent" is
// a plain password gate (WIKI_OAUTH_PASSWORD) instead of a real login
// system: GET renders a password form, POST checks it and — on success —
// issues a short-lived, single-use code bound to the PKCE code_challenge.
//
// Security note: client_id and redirect_uri are validated against the
// client's registration (from /api/oauth/register) BEFORE anything is
// rendered or redirected. If either doesn't check out, this serves a plain
// error page rather than redirecting anywhere — redirecting to an unverified
// redirect_uri is an open-redirect vector. Once redirect_uri is confirmed to
// be one this client actually registered, later validation errors (bad
// response_type, missing PKCE) are safe to report back to the client via
// redirect, per RFC 6749.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

const CODE_TTL_MS = 5 * 60 * 1000

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? ''
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB)
}

function errorPage(res: VercelResponse, status: number, message: string) {
  res
    .status(status)
    .setHeader('Content-Type', 'text/html; charset=utf-8')
    .end(
      `<!doctype html><html><body style="font-family:system-ui,sans-serif;max-width:480px;margin:80px auto;padding:0 16px">` +
        `<h2>Can't authorize this request</h2><p>${escapeHtml(message)}</p></body></html>`
    )
}

function renderForm(res: VercelResponse, fields: Record<string, string>, error?: string) {
  const hidden = Object.entries(fields)
    .filter(([, v]) => v)
    .map(([k, v]) => `<input type="hidden" name="${escapeHtml(k)}" value="${escapeHtml(v)}">`)
    .join('\n')
  res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8').end(`<!doctype html>
<html><head><meta charset="utf-8"><title>ClientFlow Wiki — Sign in</title>
<style>
body{font-family:system-ui,sans-serif;max-width:360px;margin:80px auto;padding:0 16px;color:#1a1a1a}
input[type=password]{width:100%;padding:8px;font-size:16px;box-sizing:border-box;margin:8px 0;border:1px solid #ccc;border-radius:4px}
button{width:100%;padding:8px;font-size:16px;border:none;border-radius:4px;background:#1a1a1a;color:#fff;cursor:pointer}
.error{color:#b91c1c;font-size:14px}
</style></head>
<body>
<h2>ClientFlow Wiki</h2>
<p>Authorize this app to access the wiki.</p>
${error ? `<p class="error">${escapeHtml(error)}</p>` : ''}
<form method="POST">
${hidden}
<input type="password" name="password" placeholder="Password" autofocus required>
<button type="submit">Authorize</button>
</form>
</body></html>`)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).end('Method not allowed')
    return
  }

  const src: Record<string, string | string[] | undefined> = req.method === 'GET' ? req.query : req.body ?? {}
  const response_type = first(src.response_type)
  const client_id = first(src.client_id)
  const redirect_uri = first(src.redirect_uri)
  const code_challenge = first(src.code_challenge)
  const code_challenge_method = first(src.code_challenge_method)
  const state = first(src.state)

  if (!client_id) {
    errorPage(res, 400, 'Missing client_id.')
    return
  }

  const { data: client, error: clientError } = await supabase
    .from('oauth_clients')
    .select('client_id, redirect_uris')
    .eq('client_id', client_id)
    .maybeSingle()
  if (clientError) {
    console.error('[oauth/authorize] client lookup failed:', clientError)
    errorPage(res, 500, 'Server error.')
    return
  }
  if (!client) {
    errorPage(res, 400, 'Unknown client_id.')
    return
  }

  const registeredUris: string[] = client.redirect_uris ?? []
  if (!redirect_uri || !registeredUris.includes(redirect_uri)) {
    errorPage(res, 400, "redirect_uri doesn't match this client's registration.")
    return
  }

  const redirectWithError = (errCode: string, description: string) => {
    const url = new URL(redirect_uri)
    url.searchParams.set('error', errCode)
    url.searchParams.set('error_description', description)
    if (state) url.searchParams.set('state', state)
    res.redirect(302, url.toString())
  }

  if (response_type !== 'code') {
    redirectWithError('unsupported_response_type', 'Only response_type=code is supported.')
    return
  }
  if (!code_challenge || code_challenge_method !== 'S256') {
    redirectWithError('invalid_request', 'PKCE code_challenge with method S256 is required.')
    return
  }

  const fields = { response_type, client_id, redirect_uri, code_challenge, code_challenge_method, state }

  if (req.method === 'GET') {
    renderForm(res, fields)
    return
  }

  const password = typeof req.body?.password === 'string' ? req.body.password : ''
  const expected = process.env.WIKI_OAUTH_PASSWORD ?? ''
  if (!expected || !safeEqual(password, expected)) {
    renderForm(res, fields, 'Incorrect password.')
    return
  }

  const code = randomBytes(32).toString('base64url')
  const { error: insertError } = await supabase.from('oauth_codes').insert({
    code,
    client_id,
    redirect_uri,
    code_challenge,
    code_challenge_method,
    expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
  })
  if (insertError) {
    console.error('[oauth/authorize] code insert failed:', insertError)
    errorPage(res, 500, 'Server error.')
    return
  }

  const url = new URL(redirect_uri)
  url.searchParams.set('code', code)
  if (state) url.searchParams.set('state', state)
  res.redirect(302, url.toString())
}
