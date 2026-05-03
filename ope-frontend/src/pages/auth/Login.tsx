import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Eye, EyeOff, Zap, ArrowRight, Mail, Lock } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../../components/ui'

const ROLE_ROUTES: Record<string, string> = {
  founder: '/dashboard', collaborator: '/collaborator/dashboard',
  investor: '/investor/dashboard', organisation: '/org/dashboard',
}
const ROLE_SETUP: Record<string, string> = {
  founder: '/founder/setup', collaborator: '/collaborator/setup',
  investor: '/investor/setup', organisation: '/org/setup',
}

export default function Login() {
  const { signIn, profile, user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string })?.from

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd]   = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => {
    if (user && !authLoading) {
      const dest = from ?? (!profile?.isOnboarded
        ? (ROLE_SETUP[profile?.role || 'founder'] ?? '/founder/setup')
        : (ROLE_ROUTES[profile?.role || 'founder'] ?? '/dashboard'))
      navigate(dest, { replace: true })
    }
  }, [user, profile, authLoading, navigate, from])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) { setError('Email is required'); return }
    if (!password.trim()) { setError('Password is required'); return }
    setError(''); setLoading(true)
    const { error: err } = await signIn(email, password)
    if (err) {
      setError(err.message.includes('Invalid') ? 'Invalid email or password' : err.message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[color:var(--background)] flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-[color:var(--primary)]/20 via-blue-500/10 to-[color:var(--background)] overflow-hidden flex-col justify-between p-12">
        <div className="orb orb-violet w-[400px] h-[400px] -top-20 -left-20 absolute" />
        <div className="orb orb-cyan w-[300px] h-[300px] bottom-0 right-0 absolute" />
        <div className="relative z-10">
          <Link to="/" className="flex items-center gap-2.5 mb-16">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[color:var(--primary)] to-blue-400 flex items-center justify-center shadow-lg">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="font-bold leading-none">TECHIT</div>
              <div className="font-mono text-[0.6rem] text-[color:var(--primary)] tracking-widest">NETWORK</div>
            </div>
          </Link>
          <h2 className="font-bold text-4xl leading-tight tracking-tight mb-4">Welcome<br/>Back.</h2>
          <p className="text-[color:var(--muted-foreground)] text-base leading-relaxed max-w-sm">
            Your projects, your team, your investors — all waiting for you.
          </p>
        </div>
        <div className="relative z-10 space-y-4">
          {[{ value: '94%', label: 'AI Match Success Rate' }, { value: '12K+', label: 'Active Builders' }, { value: '60+', label: 'Countries' }].map(s => (
            <div key={s.label} className="flex items-center gap-4 p-4 rounded-xl bg-[color:var(--card)]/50 border border-[color:var(--border)] backdrop-blur-sm">
              <div className="font-bold text-2xl gradient-text">{s.value}</div>
              <div className="text-sm text-[color:var(--muted-foreground)]">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <Link to="/" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[color:var(--primary)] to-blue-400 flex items-center justify-center">
                <Zap className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold text-sm">TECHIT NETWORK</span>
            </Link>
          </div>

          <div className="mb-8">
            <h1 className="font-bold text-3xl tracking-tight">Sign In</h1>
            <p className="text-[color:var(--muted-foreground)] text-sm mt-2">
              Don't have an account?{' '}
              <Link to="/signup" className="text-[color:var(--primary)] font-medium hover:underline">Create one free</Link>
            </p>
          </div>

          {error && (
            <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-500">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">Email Address</label>
              <div className="relative">
                <Mail className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--muted-foreground)]" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" required autoComplete="email"
                  className="w-full h-11 rounded-xl border border-[color:var(--border)] bg-[color:var(--input)] pl-10 pr-4 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)] transition-all" />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">Password</label>
                <Link to="/forgot-password" className="text-xs text-[color:var(--primary)] hover:underline">Forgot password?</Link>
              </div>
              <div className="relative">
                <Lock className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--muted-foreground)]" />
                <input type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Your password" required autoComplete="current-password"
                  className="w-full h-11 rounded-xl border border-[color:var(--border)] bg-[color:var(--input)] pl-10 pr-10 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)] transition-all" />
                <button type="button" onClick={() => setShowPwd(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition-colors">
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" size="lg" className="w-full" loading={loading}>
              Sign In <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
