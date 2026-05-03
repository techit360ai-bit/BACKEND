import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ArrowLeft, Zap, CheckCircle } from 'lucide-react'
import { Button, Input } from '../../components/ui'

export default function ForgotPassword() {
  const [email, setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]     = useState(false)
  const [error, setError]   = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.includes('@')) { setError('Enter a valid email'); return }
    setLoading(true); setError('')
    // In production: call your password reset API
    await new Promise(resolve => setTimeout(resolve, 1000))
    setSent(true); setLoading(false)
  }

  if (sent) return (
    <div className="min-h-screen bg-[color:var(--background)] flex items-center justify-center px-6">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="h-16 w-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center mx-auto">
          <CheckCircle className="h-8 w-8 text-emerald-400" />
        </div>
        <h1 className="font-bold text-2xl">Check your email</h1>
        <p className="text-[color:var(--muted-foreground)]">
          We sent a password reset link to <strong className="text-[color:var(--foreground)]">{email}</strong>
        </p>
        <Link to="/login"><Button variant="outline" className="w-full"><ArrowLeft className="h-4 w-4" /> Back to Sign In</Button></Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[color:var(--background)] flex items-center justify-center px-6">
      <div className="w-full max-w-md relative z-10 space-y-8">
        <div className="flex items-center gap-2.5 justify-center">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[color:var(--primary)] to-blue-400 flex items-center justify-center"><Zap className="h-5 w-5 text-white" /></div>
          <div><div className="font-bold leading-none">TECHIT</div><div className="font-mono text-[0.6rem] text-[color:var(--primary)] tracking-widest">NETWORK</div></div>
        </div>
        <div className="rounded-3xl bg-[color:var(--card)] border border-[color:var(--border)] p-8 space-y-6">
          <div className="text-center">
            <div className="h-14 w-14 rounded-2xl bg-[color:var(--primary)]/10 border border-[color:var(--primary)]/20 flex items-center justify-center mx-auto mb-4">
              <Mail className="h-7 w-7 text-[color:var(--primary)]" />
            </div>
            <h1 className="font-bold text-2xl">Reset your password</h1>
            <p className="text-sm text-[color:var(--muted-foreground)] mt-2">Enter your email and we'll send you a reset link.</p>
          </div>
          {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-500">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Email Address" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
            <Button type="submit" size="lg" className="w-full" loading={loading}>Send Reset Link</Button>
          </form>
          <div className="text-center">
            <Link to="/login" className="text-sm text-[color:var(--primary)] hover:underline flex items-center gap-1.5 justify-center">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
