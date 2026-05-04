import {
  createContext, useContext, useEffect, useRef,
  useState, useCallback, type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'

// ── Types ─────────────────────────────────────────────────────
export type Role = 'founder' | 'collaborator' | 'investor' | 'organisation'

export interface Profile {
  id: string
  email: string
  firstName: string
  lastName: string
  username: string | null
  phone: string
  country: string
  countryCode: string
  avatarUrl: string | null
  bio: string | null
  role: Role
  secondaryRoles: Role[]
  creditBalance: number
  credibilityScore: number
  isVerified: boolean
  isOnboarded: boolean
  startupStage: string | null
  industries: string[]
  experience: string | null
  skills: string[]
  weeklyHours: number | null
  riskTolerance: string | null
  investmentFocus: string[]
  ticketSize: string | null
  orgName: string | null
  orgType: string | null
  website: string | null
  linkedinUrl: string | null
  githubUrl: string | null
  portfolioUrl: string | null
  timezone: string | null
  certifications: Array<{
    id: string; name: string; issuer: string; verified: boolean; issued_at: string
  }>
  createdAt: string
  updatedAt: string
}

export interface User {
  id: string
  email: string
  user_metadata?: Record<string, unknown>
}

interface SignUpData {
  email: string
  password: string
  firstName: string
  lastName: string
  phone: string
  country: string
  countryCode: string
  role: Role
}

interface AuthContextType {
  user: User | null
  profile: Profile | null
  loading: boolean
  signUp: (data: SignUpData) => Promise<{ error: Error | null }>
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>
  refreshProfile: () => Promise<void>
}

// ── Storage helpers ───────────────────────────────────────────
const TOKEN_KEY = 'techit_token'
const USER_KEY  = 'techit_user'

const getStored = () => ({
  token: localStorage.getItem(TOKEN_KEY),
  user: (() => { try { const u = localStorage.getItem(USER_KEY); return u ? JSON.parse(u) : null } catch { return null } })(),
})
const saveToken = (t: string | null) => t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY)
const saveUser  = (u: User | null)   => u ? localStorage.setItem(USER_KEY, JSON.stringify(u)) : localStorage.removeItem(USER_KEY)

// ── API base URL ──────────────────────────────────────────────
const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

async function apiFetch(path: string, opts: RequestInit = {}) {
  const { token } = getStored() 
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${API}${path}`, { ...opts, headers: { ...headers, ...(opts.headers as Record<string, string> || {}) } })
  return res
}

// ── Context ───────────────────────────────────────────────────
const AuthContext = createContext<AuthContextType | null>(null)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user,    setUser]    = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const fetchingRef = useRef<string | null>(null)

  const navigate = useNavigate()

  // ── fetchProfile ─────────────────────────────────────────────
  const fetchProfile = useCallback(async (userId: string) => {
    if (fetchingRef.current === userId) return
    fetchingRef.current = userId
    try {
      const res = await apiFetch('/users/me')
      if (!res.ok) throw new Error('Failed to fetch profile')
      const data = await res.json()
      setProfile(data as Profile)
    } catch (err) {
      console.warn('[Auth] fetchProfile failed:', (err as Error).message)
      setProfile(null)
    } finally {
      fetchingRef.current = null
      setLoading(false)
    }
  }, [])

  // ── Bootstrap on mount ────────────────────────────────────────
  useEffect(() => {
    let mounted = true
    const bootstrap = async () => {
      const { token, user: storedUser } = getStored()
      if (!mounted) return
      if (!token || !storedUser) { setLoading(false); return }

      setUser(storedUser)
      try {
        const res = await apiFetch('/auth/session')
        if (!res.ok) throw new Error('Session invalid')
        const { user: freshUser } = await res.json()
        setUser(freshUser)
        await fetchProfile(freshUser.id)
      } catch {
        saveToken(null); saveUser(null)
        setUser(null); setProfile(null)
        setLoading(false)
      }
    }
    bootstrap()

    const onStorage = (e: StorageEvent) => {
      if (e.key === TOKEN_KEY || e.key === USER_KEY) {
        const { token, user: u } = getStored()
        setUser(u)
        if (token && u) fetchProfile(u.id)
        else { setProfile(null); setLoading(false) }
      }
    }
    window.addEventListener('storage', onStorage)
    return () => { mounted = false; window.removeEventListener('storage', onStorage) }
  }, [fetchProfile])

  // ── signUp ────────────────────────────────────────────────────
  const signUp = async (data: SignUpData): Promise<{ error: Error | null }> => {
    try {
      const res = await fetch(`${API}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Signup failed')
      // Auto sign in after signup
      if(res.ok == true || res.status === 201 || res.status === 200){
        const signInResult = await signIn(data.email, data.password)
        navigate('/founder/setup') // Redirect to dashboard after successful signup and signin
        return signInResult
      }
      else{
        return { error: new Error('Signup failed with status ' + res.status) }
      }
      
      const signInResult = await signIn(data.email, data.password)
      return signInResult
    } catch (e) {
      return { error: e instanceof Error ? e : new Error('Signup failed') }
    }
  }

  // ── signIn ────────────────────────────────────────────────────
  const signIn = async (email: string, password: string): Promise<{ error: Error | null }> => {
    try {
      const res = await fetch(`${API}/auth/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Sign in failed')

      const { token, user: u, profile: p } = json
      saveToken(token)
      saveUser(u)
      setUser(u)
      setProfile(p)
      return { error: null }
    } catch (e) {
      return { error: e instanceof Error ? e : new Error('Sign in failed') }
    }
  }

  // ── signOut ───────────────────────────────────────────────────
  const signOut = async () => {
    try { await apiFetch('/auth/signout', { method: 'POST' }) } catch {}
    saveToken(null); saveUser(null)
    setUser(null); setProfile(null)
  }

  // ── updateProfile ─────────────────────────────────────────────
  const updateProfile = async (updates: Partial<Profile>): Promise<{ error: Error | null }> => {
    if (!user) return { error: new Error('Not authenticated') }
    try {
      const res = await apiFetch('/users/me', {
        method: 'PATCH',
        body: JSON.stringify(updates),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Update failed')
      setProfile(prev => prev ? { ...prev, ...json } : json)
      return { error: null }
    } catch (e) {
      return { error: e instanceof Error ? e : new Error('Update failed') }
    }
  }

  // ── refreshProfile ────────────────────────────────────────────
  const refreshProfile = useCallback(async () => {
    if (!user) return
    fetchingRef.current = null
    await fetchProfile(user.id)
  }, [user, fetchProfile])

  return (
    <AuthContext.Provider value={{ user, profile, loading, signUp, signIn, signOut, updateProfile, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
