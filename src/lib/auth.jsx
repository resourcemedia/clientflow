import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)
const DEFAULT_PROFILE = { id: null, role: 'manager', client_id: null, full_name: null }

async function fetchProfile(userId) {
  console.log('fetchProfile called with userId:', userId)
  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, client_id, full_name')
    .eq('id', userId)
    .single()
  console.log('fetchProfile result:', { data, error })
  if (error) return { ...DEFAULT_PROFILE, id: userId }
  return data
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null
      setUser(u)
      setProfile(u ? await fetchProfile(u.id) : null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user ?? null
      setUser(u)
      setProfile(u ? await fetchProfile(u.id) : null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
