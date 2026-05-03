import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import type { ReactNode } from 'react'

const ROLE_DASHBOARD: Record<string, string> = {
  founder: '/dashboard',
  collaborator: '/collaborator/dashboard',
  investor: '/investor/dashboard',
  organisation: '/org/dashboard',
}

const ROLE_SETUP: Record<string, string> = {
  founder: '/founder/setup',
  collaborator: '/collaborator/setup',
  investor: '/investor/setup',
  organisation: '/org/setup',
}

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[color:var(--background)]">
      <div className="h-8 w-8 rounded-full border-2 border-[color:var(--primary)] border-t-transparent animate-spin" />
    </div>
  )
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export function SmartRedirect() {
  const { user, profile, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  if (!profile) return <Spinner />
  if (!profile.isOnboarded) {
    return <Navigate to={ROLE_SETUP[profile.role] ?? '/founder/setup'} replace />
  }
  return <Navigate to={ROLE_DASHBOARD[profile.role] ?? '/dashboard'} replace />
}

export { Spinner }
