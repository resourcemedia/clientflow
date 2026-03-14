import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export default function LoginPage() {
  const { signIn }          = useAuth()
  const navigate            = useNavigate()
  const [email, setEmail]   = useState('')
  const [pass, setPass]     = useState('')
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, pass)
      navigate('/')
    } catch (err) {
      setError(err.message || 'Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
    }}>
      <div style={{
        width: 360,
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '2.5rem 2rem',
        boxShadow: 'var(--shadow-lg)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
          <div style={{
            width: 36, height: 36,
            background: 'var(--accent)',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Fraunces, serif',
            fontWeight: 600,
            fontSize: '1.1rem',
            color: '#fff',
          }}>C</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '1rem', letterSpacing: '-0.01em' }}>ClientFlow</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text2)' }}>Marketing OS</div>
          </div>
        </div>

        <h1 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.375rem' }}>Sign in</h1>
        <p style={{ fontSize: '0.82rem', color: 'var(--text2)', marginBottom: '1.75rem' }}>
          Enter your credentials to access the dashboard.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text2)', marginBottom: '0.4rem' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              placeholder="you@example.com"
              style={{
                width: '100%',
                background: 'var(--bg3)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '0.6rem 0.75rem',
                color: 'var(--text)',
                fontSize: '0.875rem',
                outline: 'none',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text2)', marginBottom: '0.4rem' }}>
              Password
            </label>
            <input
              type="password"
              value={pass}
              onChange={e => setPass(e.target.value)}
              required
              placeholder="••••••••"
              style={{
                width: '100%',
                background: 'var(--bg3)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '0.6rem 0.75rem',
                color: 'var(--text)',
                fontSize: '0.875rem',
                outline: 'none',
              }}
            />
          </div>

          {error && (
            <div style={{
              background: 'var(--red-bg)',
              border: '1px solid var(--red)',
              borderRadius: 'var(--radius)',
              padding: '0.6rem 0.75rem',
              fontSize: '0.82rem',
              color: 'var(--red)',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              background: loading ? 'var(--bg4)' : 'var(--accent)',
              color: loading ? 'var(--text2)' : '#fff',
              border: 'none',
              borderRadius: 'var(--radius)',
              padding: '0.65rem',
              fontFamily: 'inherit',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: '0.25rem',
            }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
