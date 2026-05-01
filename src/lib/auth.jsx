import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)
const DEFAULT_PROFILE = { id: null, role: 'manager', client_id: null, name: null }

async function fetchProfile(userId, attempt = 1) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, client_id, name')
    .eq('id', userId)
    .single()
  if (error) {
    if (attempt < 3) {
      await new Promise(r => setTimeout(r, 500 * attempt))
      return fetchProfile(userId, attempt + 1)
    }
    return { ...DEFAULT_PROFILE, id: userId }
  }
  return data
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const initialized   = useRef(false)
  const fetchedUserId = useRef(null)

  useEffect(() => {
    let cancelled = false
    initialized.current   = false
    fetchedUserId.current = null

    const timeout = setTimeout(() => {
      if (!cancelled) setLoading(false)
    }, 5000)

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (cancelled) return
      const u = session?.user ?? null
      setUser(u)
      fetchedUserId.current = u?.id ?? null
      setProfile(u ? await fetchProfile(u.id) : null)
      setLoading(false)
      clearTimeout(timeout)
      initialized.current = true
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (cancelled) return
      if (!initialized.current) return
      const u = session?.user ?? null
      setUser(u)
      if (u?.id !== fetchedUserId.current) {
        fetchedUserId.current = u?.id ?? null
        setProfile(u ? await fetchProfile(u.id) : null)
      }
      setLoading(false)
    })

    return () => {
      cancelled = true
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
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
