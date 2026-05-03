// FounderSetup.tsx
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowRight, Zap } from 'lucide-react'
import { Button } from '../../components/ui'
import { useAuth } from '../../contexts/AuthContext'
import { cn } from '../../lib/utils'

const STAGES = ['Idea', 'MVP', 'Launch', 'Growth']
const INDUSTRIES = ['AI/ML','FinTech','HealthTech','E-Commerce','SaaS','Edtech','CleanTech','Web3','Other']
const EXPERIENCE = ['First Time Founder', 'Some Experience', 'Serial Entrepreneur']

export default function FounderSetup() {
  const { updateProfile } = useAuth()
  const navigate = useNavigate()
  const [stage, setStage]       = useState('Idea')
  const [industries, setInds]   = useState<string[]>([])
  const [experience, setExp]    = useState('First Time Founder')
  const [hours, setHours]       = useState(30)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const toggle = (ind: string) => setInds(p => p.includes(ind) ? p.filter(x => x !== ind) : [...p, ind])
  const pct = (stage ? 25 : 0) + (industries.length > 0 ? 25 : 0) + (experience ? 25 : 0) + (hours >= 5 ? 25 : 0)

  async function save() {
    if (!industries.length) { setError('Select at least one industry.'); return }
    setLoading(true); setError('')
    const { error: err } = await updateProfile({ startupStage: stage, industries, experience, weeklyHours: hours, isOnboarded: true } as any)
    if (err) { setError(err.message); setLoading(false); return }
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-[color:var(--background)] flex flex-col">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-[color:var(--border)]">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[color:var(--primary)] to-blue-400 flex items-center justify-center"><Zap className="h-4 w-4 text-white" /></div>
          <span className="font-bold text-sm">TECHIT NETWORK</span>
        </Link>
        <span className="text-xs text-[color:var(--muted-foreground)] font-mono">Founder Onboarding</span>
      </nav>
      <div className="flex-1 flex justify-center px-6 py-12">
        <div className="w-full max-w-4xl space-y-8">
          <div>
            <div className="font-mono text-xs text-[color:var(--primary)] uppercase tracking-widest mb-2">Founder Profile Setup</div>
            <h1 className="font-bold text-3xl">Tell us about your startup journey</h1>
            <p className="text-sm text-[color:var(--muted-foreground)] mt-2">This powers the AI matching engine to find you the best collaborators and investors.</p>
          </div>
          {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-500">{error}</div>}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
            <div className="space-y-5">
              <div className="rounded-2xl bg-[color:var(--card)] border border-[color:var(--border)] p-6">
                <p className="text-xs font-semibold text-[color:var(--muted-foreground)] uppercase tracking-widest mb-4">Current Stage</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {STAGES.map(s => (
                    <button key={s} onClick={() => setStage(s)}
                      className={cn('rounded-xl border py-3 text-sm font-medium transition-all text-center', stage === s ? 'border-[color:var(--primary)] bg-[color:var(--primary)]/10 text-[color:var(--primary)]' : 'border-[color:var(--border)] hover:border-[color:var(--primary)]/40 text-[color:var(--foreground)]')}>{s}</button>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl bg-[color:var(--card)] border border-[color:var(--border)] p-6">
                <p className="text-xs font-semibold text-[color:var(--muted-foreground)] uppercase tracking-widest mb-1">Industry Focus</p>
                <p className="text-xs text-[color:var(--muted-foreground)] mb-4">Select all that apply</p>
                <div className="flex flex-wrap gap-2">
                  {INDUSTRIES.map(ind => (
                    <button key={ind} onClick={() => toggle(ind)}
                      className={cn('rounded-full border px-4 py-2 text-sm transition-all', industries.includes(ind) ? 'border-[color:var(--secondary)] bg-[color:var(--secondary)]/10 text-[color:var(--secondary)]' : 'border-[color:var(--border)] hover:border-[color:var(--secondary)]/40 text-[color:var(--muted-foreground)]')}>{ind}</button>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl bg-[color:var(--card)] border border-[color:var(--border)] p-6 space-y-3">
                <p className="text-xs font-semibold text-[color:var(--muted-foreground)] uppercase tracking-widest">Founder Experience</p>
                {EXPERIENCE.map(e => (
                  <label key={e} className={cn('flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-all', experience === e ? 'border-[color:var(--primary)] bg-[color:var(--primary)]/5' : 'border-[color:var(--border)] hover:border-[color:var(--primary)]/40')}>
                    <input type="radio" checked={experience === e} onChange={() => setExp(e)} className="accent-[color:var(--primary)]" />
                    <span className="text-sm">{e}</span>
                  </label>
                ))}
              </div>
              <div className="rounded-2xl bg-[color:var(--card)] border border-[color:var(--border)] p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-xs font-semibold text-[color:var(--muted-foreground)] uppercase tracking-widest">Weekly Time Commitment</p>
                  <span className="text-sm font-bold text-[color:var(--primary)] font-mono">{hours}h / week</span>
                </div>
                <input type="range" min={5} max={60} value={hours} onChange={e => setHours(+e.target.value)} className="w-full accent-[color:var(--primary)]" />
                <div className="flex justify-between text-xs text-[color:var(--muted-foreground)]"><span>Part-time (5h)</span><span>Full-time (60h)</span></div>
              </div>
            </div>
            <div className="rounded-2xl bg-[color:var(--card)] border border-[color:var(--border)] p-5 h-fit sticky top-6 space-y-4">
              <p className="text-xs font-semibold text-[color:var(--muted-foreground)] uppercase tracking-widest">Profile Strength</p>
              <div className="text-3xl font-bold gradient-text">{pct}%</div>
              <div className="h-2 rounded-full bg-[color:var(--muted)] overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-[color:var(--primary)] to-blue-400 transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-xs text-[color:var(--muted-foreground)]">A complete profile increases your match quality by 3x.</p>
              <Button className="w-full" onClick={save} loading={loading} disabled={!industries.length}>
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
