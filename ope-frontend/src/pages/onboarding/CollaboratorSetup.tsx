import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowRight, Zap, Search } from 'lucide-react'
import { Button } from '../../components/ui'
import { useAuth } from '../../contexts/AuthContext'
import { cn } from '../../lib/utils'

const ALL_SKILLS = [
  'React','Next.js','Vue','Angular','Svelte','HTML','CSS','Tailwind CSS',
  'Node.js','Express','NestJS','Django','Flask','FastAPI','Spring Boot',
  'JavaScript','TypeScript','Python','Java','C','C++','C#','Go','Rust','Kotlin','Swift',
  'Flutter','React Native','Android','iOS','SwiftUI',
  'AWS','GCP','Azure','Firebase','Supabase','Vercel','Docker','Kubernetes',
  'PostgreSQL','MySQL','MongoDB','Redis','SQLite',
  'Machine Learning','Deep Learning','Data Science','TensorFlow','PyTorch','LLMs',
  'UI/UX Design','Figma','Adobe XD','Photoshop','Design Systems',
  'Product Management','Growth','Marketing','SEO','Sales','Analytics',
  'Blockchain','Solidity','Web3','Smart Contracts','Ethereum','DeFi',
  'Cybersecurity','DevOps','Git','GitHub','Linux',
]

export function CollaboratorSetup() {
  const { updateProfile } = useAuth()
  const navigate = useNavigate()
  const [skills, setSkills]   = useState<string[]>([])
  const [hours, setHours]     = useState(20)
  const [risk, setRisk]       = useState<'Low'|'Medium'|'High'>('Medium')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [search, setSearch]   = useState('')

  const toggle = (s: string) => setSkills(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s])
  const filtered = ALL_SKILLS.filter(s => s.toLowerCase().includes(search.toLowerCase()))
  const pct = (skills.length > 0 ? 40 : 0) + (hours >= 5 ? 30 : 0) + (risk ? 30 : 0)

  async function save() {
    if (!skills.length) { setError('Select at least one skill.'); return }
    setLoading(true); setError('')
    const { error: err } = await updateProfile({ skills, weeklyHours: hours, riskTolerance: risk, isOnboarded: true } as any)
    if (err) { setError(err.message); setLoading(false); return }
    navigate('/collaborator/dashboard')
  }

  return (
    <div className="min-h-screen bg-[color:var(--background)] flex flex-col">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-[color:var(--border)]">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center"><Zap className="h-4 w-4 text-white" /></div>
          <span className="font-bold text-sm">TECHIT NETWORK</span>
        </Link>
        <span className="text-xs text-[color:var(--muted-foreground)] font-mono">Collaborator Onboarding</span>
      </nav>
      <div className="flex-1 flex justify-center px-6 py-12">
        <div className="w-full max-w-4xl space-y-8">
          <div>
            <div className="font-mono text-xs text-cyan-400 uppercase tracking-widest mb-2">Collaborator Profile Setup</div>
            <h1 className="font-bold text-3xl">Define your skills and availability</h1>
            <p className="text-sm text-[color:var(--muted-foreground)] mt-2">The AI matching engine uses this to connect you with projects that need exactly what you bring.</p>
          </div>
          {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-500">{error}</div>}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
            <div className="space-y-5">
              <div className="rounded-2xl bg-[color:var(--card)] border border-[color:var(--border)] p-6">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-semibold text-[color:var(--muted-foreground)] uppercase tracking-widest">Your Skills</p>
                  {skills.length > 0 && <span className="text-xs font-mono text-[color:var(--primary)]">{skills.length} selected</span>}
                </div>
                <div className="flex items-center gap-2 bg-[color:var(--muted)]/40 border border-[color:var(--border)] rounded-xl px-3 py-2 mb-4">
                  <Search className="h-4 w-4 text-[color:var(--muted-foreground)] flex-shrink-0" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search skills..." className="flex-1 bg-transparent text-sm outline-none text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)]" />
                </div>
                <div className="flex flex-wrap gap-2 max-h-52 overflow-y-auto">
                  {filtered.map(s => (
                    <button key={s} onClick={() => toggle(s)}
                      className={cn('rounded-full border px-3 py-1.5 text-sm transition-all flex-shrink-0', skills.includes(s) ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400' : 'border-[color:var(--border)] hover:border-cyan-500/40 text-[color:var(--muted-foreground)]')}>{s}</button>
                  ))}
                </div>
                {skills.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-[color:var(--border)]">
                    <p className="text-xs text-[color:var(--muted-foreground)] mb-2 font-medium">Selected skills:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {skills.map(s => <span key={s} className="text-xs px-2.5 py-1 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/25">{s}</span>)}
                    </div>
                  </div>
                )}
              </div>
              <div className="rounded-2xl bg-[color:var(--card)] border border-[color:var(--border)] p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-xs font-semibold text-[color:var(--muted-foreground)] uppercase tracking-widest">Weekly Availability</p>
                  <span className="text-sm font-bold text-cyan-400 font-mono">{hours}h / week</span>
                </div>
                <input type="range" min={5} max={60} value={hours} onChange={e => setHours(+e.target.value)} className="w-full accent-cyan-500" />
                <div className="flex justify-between text-xs text-[color:var(--muted-foreground)]"><span>Part-time (5h)</span><span>Full-time (60h)</span></div>
              </div>
              <div className="rounded-2xl bg-[color:var(--card)] border border-[color:var(--border)] p-6">
                <p className="text-xs font-semibold text-[color:var(--muted-foreground)] uppercase tracking-widest mb-1">Risk Tolerance</p>
                <p className="text-xs text-[color:var(--muted-foreground)] mb-4">Low — stable equity deals. High — early-stage startups with greater upside.</p>
                <div className="grid grid-cols-3 gap-3">
                  {(['Low','Medium','High'] as const).map(r => (
                    <button key={r} onClick={() => setRisk(r)}
                      className={cn('rounded-xl border py-3 text-sm font-medium transition-all', risk === r ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400' : 'border-[color:var(--border)] hover:border-cyan-500/40 text-[color:var(--muted-foreground)]')}>{r}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="rounded-2xl bg-[color:var(--card)] border border-[color:var(--border)] p-5 h-fit sticky top-6 space-y-4">
              <p className="text-xs font-semibold text-[color:var(--muted-foreground)] uppercase tracking-widest">Profile Strength</p>
              <div className="text-3xl font-bold gradient-text">{pct}%</div>
              <div className="h-2 rounded-full bg-[color:var(--muted)] overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-400 transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-xs text-[color:var(--muted-foreground)]">More skills = better project matches.</p>
              <Button className="w-full" onClick={save} loading={loading} disabled={!skills.length}>
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function InvestorSetup() {
  const { updateProfile } = useAuth()
  const navigate = useNavigate()
  const FOCUSES = ['AI/ML','FinTech','HealthTech','E-Commerce','SaaS','Edtech','CleanTech','Web3','Other']
  const STAGES_INV = ['Pre-Seed','Seed','Series A','Series B+','Any Stage']
  const SIZES = ['Under $10K','$10K – $50K','$50K – $150K','$150K – $500K','$500K+']

  const [focuses, setFocuses]     = useState<string[]>([])
  const [stage, setStage]         = useState('Seed')
  const [ticketSize, setTicket]   = useState('$50K – $150K')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  const toggle = (f: string) => setFocuses(p => p.includes(f) ? p.filter(x => x !== f) : [...p, f])

  async function save() {
    if (!focuses.length) { setError('Select at least one focus.'); return }
    setLoading(true); setError('')
    const { error: err } = await updateProfile({ investmentFocus: focuses, ticketSize, isOnboarded: true } as any)
    if (err) { setError(err.message); setLoading(false); return }
    navigate('/investor/dashboard')
  }

  return (
    <div className="min-h-screen bg-[color:var(--background)] flex flex-col">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-[color:var(--border)]">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center"><Zap className="h-4 w-4 text-white" /></div>
          <span className="font-bold text-sm">TECHIT NETWORK</span>
        </Link>
        <span className="text-xs text-[color:var(--muted-foreground)] font-mono">Investor Onboarding</span>
      </nav>
      <div className="flex-1 flex justify-center px-6 py-12">
        <div className="w-full max-w-2xl space-y-8">
          <div>
            <div className="font-mono text-xs text-teal-400 uppercase tracking-widest mb-2">Investor Profile Setup</div>
            <h1 className="font-bold text-3xl">Define your investment thesis</h1>
          </div>
          {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-500">{error}</div>}
          <div className="space-y-5">
            <div className="rounded-2xl bg-[color:var(--card)] border border-[color:var(--border)] p-6">
              <p className="text-xs font-semibold text-[color:var(--muted-foreground)] uppercase tracking-widest mb-4">Investment Focus Areas</p>
              <div className="flex flex-wrap gap-2">
                {FOCUSES.map(f => <button key={f} onClick={() => toggle(f)}
                  className={cn('rounded-full border px-4 py-2 text-sm transition-all', focuses.includes(f) ? 'border-teal-500 bg-teal-500/10 text-teal-400' : 'border-[color:var(--border)] hover:border-teal-500/40 text-[color:var(--muted-foreground)]')}>{f}</button>)}
              </div>
            </div>
            <div className="rounded-2xl bg-[color:var(--card)] border border-[color:var(--border)] p-6">
              <p className="text-xs font-semibold text-[color:var(--muted-foreground)] uppercase tracking-widest mb-4">Preferred Startup Stage</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {STAGES_INV.map(s => <button key={s} onClick={() => setStage(s)}
                  className={cn('rounded-xl border py-3 text-sm font-medium transition-all', stage === s ? 'border-teal-500 bg-teal-500/10 text-teal-400' : 'border-[color:var(--border)] hover:border-teal-500/40 text-[color:var(--muted-foreground)]')}>{s}</button>)}
              </div>
            </div>
            <div className="rounded-2xl bg-[color:var(--card)] border border-[color:var(--border)] p-6">
              <p className="text-xs font-semibold text-[color:var(--muted-foreground)] uppercase tracking-widest mb-4">Typical Ticket Size</p>
              <div className="grid grid-cols-2 gap-3">
                {SIZES.map(s => <button key={s} onClick={() => setTicket(s)}
                  className={cn('rounded-xl border py-3 text-sm font-medium transition-all', ticketSize === s ? 'border-teal-500 bg-teal-500/10 text-teal-400' : 'border-[color:var(--border)] hover:border-teal-500/40 text-[color:var(--muted-foreground)]')}>{s}</button>)}
              </div>
            </div>
            <Button className="w-full" onClick={save} loading={loading} disabled={!focuses.length}>
              Go to Dashboard <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function OrgSetup() {
  const { updateProfile } = useAuth()
  const navigate = useNavigate()
  const ORG_TYPES = ['Startup Accelerator','Corporate Innovation','University','Government Body','NGO','Research Institute','Venture Capital','Other']

  const [orgName, setOrgName]   = useState('')
  const [orgType, setOrgType]   = useState('Corporate Innovation')
  const [website, setWebsite]   = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function save() {
    if (!orgName.trim()) { setError('Organisation name required.'); return }
    setLoading(true); setError('')
    const { error: err } = await updateProfile({ orgName, orgType, website: website || null, isOnboarded: true } as any)
    if (err) { setError(err.message); setLoading(false); return }
    navigate('/org/dashboard')
  }

  const inputCls = 'w-full h-10 rounded-xl border border-[color:var(--border)] bg-[color:var(--input)] px-3 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)] transition-all'

  return (
    <div className="min-h-screen bg-[color:var(--background)] flex flex-col">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-[color:var(--border)]">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center"><Zap className="h-4 w-4 text-white" /></div>
          <span className="font-bold text-sm">TECHIT NETWORK</span>
        </Link>
        <span className="text-xs text-[color:var(--muted-foreground)] font-mono">Organisation Onboarding</span>
      </nav>
      <div className="flex-1 flex justify-center px-6 py-12">
        <div className="w-full max-w-xl space-y-8">
          <div>
            <div className="font-mono text-xs text-rose-400 uppercase tracking-widest mb-2">Organisation Profile Setup</div>
            <h1 className="font-bold text-3xl">Tell us about your organisation</h1>
          </div>
          {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-500">{error}</div>}
          <div className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">Organisation Name</label>
              <input value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="Acme Innovation Lab" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">Organisation Type</label>
              <div className="grid grid-cols-2 gap-2">
                {ORG_TYPES.map(t => <button key={t} onClick={() => setOrgType(t)}
                  className={cn('rounded-xl border py-2.5 px-4 text-sm font-medium text-left transition-all', orgType === t ? 'border-rose-500 bg-rose-500/10 text-rose-400' : 'border-[color:var(--border)] hover:border-rose-500/40 text-[color:var(--muted-foreground)]')}>{t}</button>)}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">Website (optional)</label>
              <input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://yourorganisation.com" className={inputCls} />
            </div>
            <Button className="w-full" onClick={save} loading={loading} disabled={!orgName.trim()}>
              Go to Dashboard <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CollaboratorSetup
