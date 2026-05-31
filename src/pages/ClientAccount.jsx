import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Breadcrumb, initials } from '../components/ui'

const EDGE_URL = 'https://ondbfkiaiabdcfamtjsp.supabase.co/functions/v1/manage-client-user'

const labelStyle = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.08em',
  color: 'var(--text3)',
  marginBottom: 4,
}

const inputStyle = {
  width: '100%',
  padding: '7px 10px',
  border: '1px solid var(--border)',
  borderRadius: 6,
  background: 'var(--bg)',
  color: 'var(--text)',
  fontSize: 14,
  boxSizing: 'border-box',
}

function AdminAvatar({ name }) {
  return (
    <div style={{
      width: 36, height: 36, borderRadius: '50%',
      background: '#d5b6dd',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 13, fontWeight: 600, color: '#fff',
      flexShrink: 0,
    }}>
      {initials(name || '?')}
    </div>
  )
}

function splitName(fullName) {
  const parts = (fullName || '').trim().split(' ')
  return { first: parts[0] || '', last: parts.slice(1).join(' ') || '' }
}

export default function ClientAccount() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [client, setClient]           = useState(null)
  const [company, setCompany]         = useState('')
  const [alias, setAlias]             = useState('')
  const [savingClient, setSavingClient] = useState(false)

  const [profiles, setProfiles]         = useState([])
  const [profileEdits, setProfileEdits] = useState({})
  const [passwords, setPasswords]       = useState({})
  const [updatingPw, setUpdatingPw]     = useState({})
  const [pwUpdated, setPwUpdated]       = useState({})
  const [pwError, setPwError]           = useState({})

  const [addingAdmin, setAddingAdmin] = useState(false)
  const [newAdmin, setNewAdmin]       = useState({ first: '', last: '', email: '', password: '' })
  const [savingNew, setSavingNew]     = useState(false)
  const [newAdminError, setNewAdminError] = useState('')

  useEffect(() => {
    loadClient()
    loadProfiles()
  }, [id])

  async function loadClient() {
    const { data } = await supabase.from('clients').select('*').eq('id', id).single()
    if (data) {
      setClient(data)
      setCompany(data.company || '')
      setAlias(data.alias || '')
    }
  }

  async function loadProfiles() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'client_admin')
      .eq('client_id', id)
      .order('created_at', { ascending: true })
    if (data) {
      setProfiles(data)
      const edits = {}
      data.forEach(p => { edits[p.id] = splitName(p.name) })
      setProfileEdits(edits)
    }
  }

  async function saveClient() {
    setSavingClient(true)
    await supabase.from('clients').update({ company: company.trim(), alias: alias.trim() || null }).eq('id', id)
    setClient(c => ({ ...c, company: company.trim(), alias: alias.trim() || null }))
    setSavingClient(false)
  }

  async function saveProfileName(profileId) {
    const edit = profileEdits[profileId]
    if (!edit) return
    const fullName = `${edit.first} ${edit.last}`.trim()
    await supabase.from('profiles').update({ name: fullName }).eq('id', profileId)
    setProfiles(ps => ps.map(p => p.id === profileId ? { ...p, name: fullName } : p))
  }

  function setEdit(profileId, field, value) {
    setProfileEdits(prev => ({ ...prev, [profileId]: { ...prev[profileId], [field]: value } }))
  }

  async function updatePassword(profileId) {
    const pw = passwords[profileId] || ''
    if (!pw) return
    setUpdatingPw(u => ({ ...u, [profileId]: true }))
    setPwError(e => ({ ...e, [profileId]: '' }))
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(EDGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ action: 'update_password', userId: profileId, password: pw }),
    })
    const result = await res.json()
    setUpdatingPw(u => ({ ...u, [profileId]: false }))
    if (result.success) {
      setPasswords(p => ({ ...p, [profileId]: '' }))
      setPwUpdated(u => ({ ...u, [profileId]: true }))
      setTimeout(() => setPwUpdated(u => ({ ...u, [profileId]: false })), 2000)
    } else {
      setPwError(e => ({ ...e, [profileId]: result.error || 'Update failed' }))
    }
  }

  async function addAdmin() {
    if (!newAdmin.email || !newAdmin.password) return
    setSavingNew(true)
    setNewAdminError('')
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(EDGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({
        action:    'create',
        email:     newAdmin.email,
        password:  newAdmin.password,
        firstName: newAdmin.first,
        lastName:  newAdmin.last,
        clientId:  id,
      }),
    })
    const result = await res.json()
    if (result.id) {
      const fullName = `${newAdmin.first} ${newAdmin.last}`.trim()
      const created = { id: result.id, name: fullName, email: newAdmin.email, role: 'client_admin', client_id: id }
      setProfiles(ps => [...ps, created])
      setProfileEdits(e => ({ ...e, [result.id]: { first: newAdmin.first, last: newAdmin.last } }))
      setNewAdmin({ first: '', last: '', email: '', password: '' })
      setAddingAdmin(false)
    } else {
      setNewAdminError(result.error || 'Failed to create admin')
    }
    setSavingNew(false)
  }

  if (!client) return <div className="page-content text-dim">Loading…</div>

  return (
    <div className="fade-in">
      {/* Topbar */}
      <div className="topbar">
        <Breadcrumb segments={[
          { label: 'Dashboard', onClick: () => navigate('/') },
          { label: 'Clients',   onClick: () => navigate('/clients') },
          { label: client.company },
        ]} />
      </div>

      <div className="page-content" style={{ maxWidth: 680 }}>
        {/* Back link */}
        <button
          className="btn btn-ghost btn-sm"
          style={{ padding: 0, marginBottom: 16, color: 'var(--text3)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}
          onClick={() => navigate('/clients')}
        >
          ← Back to Clients
        </button>

        {/* Page title */}
        <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 28, fontWeight: 700, margin: '0 0 24px' }}>
          {client.company}
        </h1>

        {/* Company Name + Alias */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 32 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>COMPANY NAME</label>
            <input style={inputStyle} value={company} onChange={e => setCompany(e.target.value)} />
          </div>
          <div style={{ width: 90 }}>
            <label style={labelStyle}>ALIAS</label>
            <input style={inputStyle} value={alias} onChange={e => setAlias(e.target.value)} />
          </div>
          <button className="btn btn-primary btn-sm" onClick={saveClient} disabled={savingClient}>
            {savingClient ? 'Saving…' : 'Save'}
          </button>
        </div>

        {/* Admin section */}
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '20px 24px' }}>
          <div style={labelStyle}>ADMIN</div>

          {profiles.map((profile, idx) => {
            const edit = profileEdits[profile.id] || { first: '', last: '' }
            return (
              <div key={profile.id}>
                {idx > 0 && <div style={{ borderTop: '1px solid var(--border)', margin: '24px 0' }} />}
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  <div style={{ paddingTop: 22 }}>
                    <AdminAvatar name={profile.name} />
                  </div>
                  <div style={{ flex: 1 }}>
                    {/* First + Last */}
                    <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                      <div style={{ flex: 1 }}>
                        <label style={labelStyle}>FIRST</label>
                        <input
                          style={inputStyle}
                          value={edit.first}
                          onChange={e => setEdit(profile.id, 'first', e.target.value)}
                          onBlur={() => saveProfileName(profile.id)}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={labelStyle}>LAST</label>
                        <input
                          style={inputStyle}
                          value={edit.last}
                          onChange={e => setEdit(profile.id, 'last', e.target.value)}
                          onBlur={() => saveProfileName(profile.id)}
                        />
                      </div>
                    </div>

                    {/* Email */}
                    <div style={{ marginBottom: 12 }}>
                      <label style={labelStyle}>EMAIL/LOGIN</label>
                      <input
                        style={{ ...inputStyle, background: 'var(--bg2)', color: 'var(--text3)' }}
                        value={profile.email || ''}
                        readOnly
                      />
                    </div>

                    {/* Password */}
                    <div>
                      <label style={labelStyle}>PASSWORD</label>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          style={{ ...inputStyle, flex: 1, width: 'auto' }}
                          type="password"
                          placeholder="••••••••••"
                          value={passwords[profile.id] || ''}
                          onChange={e => setPasswords(p => ({ ...p, [profile.id]: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') updatePassword(profile.id) }}
                        />
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => updatePassword(profile.id)}
                          disabled={updatingPw[profile.id]}
                        >
                          {updatingPw[profile.id] ? '…' : 'Update'}
                        </button>
                        {pwUpdated[profile.id] && (
                          <span style={{ fontSize: 13, color: '#22C55E', whiteSpace: 'nowrap' }}>Updated ✓</span>
                        )}
                      </div>
                      {pwError[profile.id] && (
                        <div style={{ fontSize: 12, color: '#EF4444', marginTop: 4 }}>{pwError[profile.id]}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          {/* +Add Admin form */}
          {addingAdmin && (
            <div>
              <div style={{ borderTop: '1px solid var(--border)', margin: '24px 0' }} />
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ paddingTop: 22 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: '#d5b6dd', opacity: 0.35, flexShrink: 0,
                  }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>FIRST</label>
                      <input style={inputStyle} value={newAdmin.first} onChange={e => setNewAdmin(a => ({ ...a, first: e.target.value }))} autoFocus />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>LAST</label>
                      <input style={inputStyle} value={newAdmin.last} onChange={e => setNewAdmin(a => ({ ...a, last: e.target.value }))} />
                    </div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={labelStyle}>EMAIL/LOGIN</label>
                    <input style={inputStyle} value={newAdmin.email} onChange={e => setNewAdmin(a => ({ ...a, email: e.target.value }))} />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={labelStyle}>PASSWORD</label>
                    <input style={inputStyle} type="password" value={newAdmin.password} onChange={e => setNewAdmin(a => ({ ...a, password: e.target.value }))} />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary btn-sm" onClick={addAdmin} disabled={savingNew}>
                      {savingNew ? 'Saving…' : 'Save Admin'}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setAddingAdmin(false); setNewAdmin({ first: '', last: '', email: '', password: '' }); setNewAdminError('') }}>
                      Cancel
                    </button>
                  </div>
                  {newAdminError && (
                    <div style={{ fontSize: 12, color: '#EF4444', marginTop: 8 }}>{newAdminError}</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* +Add Admin button */}
          {!addingAdmin && (
            <div style={{ borderTop: profiles.length > 0 ? '1px solid var(--border)' : 'none', marginTop: profiles.length > 0 ? 20 : 4, paddingTop: profiles.length > 0 ? 16 : 0 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setAddingAdmin(true)}>
                +Add Admin
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
