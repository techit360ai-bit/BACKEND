import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, UserPlus, UserCheck, MessageCircle, X, RefreshCw } from 'lucide-react'
import DashboardLayout from '../../components/shared/DashboardLayout'
import { Card, Button, Badge, Avatar } from '../../components/ui'
import { useAuth } from '../../contexts/AuthContext'
import { cn } from '../../lib/utils'

const MOCK_PEOPLE = [
  { id: 'p1', firstName: 'Amara', lastName: 'Okonkwo', role: 'founder', country: 'Nigeria', bio: 'Building AI-powered solutions for African businesses.', skills: ['React','Node.js','Python'], credibilityScore: 85, isVerified: true, weeklyHours: 30 },
  { id: 'p2', firstName: 'Kai', lastName: 'Nakamura', role: 'collaborator', country: 'Japan', bio: 'ML engineer focused on real-world AI applications.', skills: ['Python','TensorFlow','Data Science'], credibilityScore: 91, isVerified: true, weeklyHours: 20 },
  { id: 'p3', firstName: 'Zara', lastName: 'Mensah', role: 'collaborator', country: 'Ghana', bio: 'Design thinking advocate with B2B SaaS background.', skills: ['UI/UX Design','Figma','Product Management'], credibilityScore: 78, isVerified: false, weeklyHours: 25 },
  { id: 'p4', firstName: 'Luca', lastName: 'Romano', role: 'investor', country: 'Italy', bio: 'Angel investor focused on African tech startups.', skills: ['Venture Capital','Due Diligence'], credibilityScore: 88, isVerified: true, weeklyHours: 15 },
  { id: 'p5', firstName: 'Fatima', lastName: 'Al-Hassan', role: 'collaborator', country: 'UAE', bio: 'Growth marketer who has scaled 5 startups.', skills: ['Marketing','Growth','SEO'], credibilityScore: 74, isVerified: false, weeklyHours: 20 },
  { id: 'p6', firstName: 'Chen', lastName: 'Wei', role: 'collaborator', country: 'Singapore', bio: 'Web3 developer with DeFi protocol experience.', skills: ['Blockchain','Solidity','Web3'], credibilityScore: 88, isVerified: true, weeklyHours: 25 },
  { id: 'p7', firstName: 'Nia', lastName: 'Johansson', role: 'founder', country: 'Sweden', bio: 'Serial entrepreneur, 2 exits. Looking for technical partners.', skills: ['Business Development','Sales','Strategy'], credibilityScore: 83, isVerified: true, weeklyHours: 40 },
  { id: 'p8', firstName: 'Kwame', lastName: 'Asante', role: 'organisation', country: 'Ghana', bio: 'Running an accelerator program for African startups.', skills: ['Mentoring','Fundraising','Strategy'], credibilityScore: 79, isVerified: false, weeklyHours: 30 },
]

type ConnStatus = 'none' | 'pending' | 'connected'

export default function People() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [query, setQuery]       = useState(searchParams.get('q') ?? '')
  const [roleFilter, setRole]   = useState('All')
  const [connections, setConns] = useState<Record<string, ConnStatus>>({})

  const ROLES = ['All', 'founder', 'collaborator', 'investor', 'organisation']

  const filtered = MOCK_PEOPLE.filter(p => {
    if (p.id === profile?.id) return false
    if (roleFilter !== 'All' && p.role !== roleFilter) return false
    if (query) {
      const q = query.toLowerCase()
      return `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) || p.bio.toLowerCase().includes(q) || p.skills.some(s => s.toLowerCase().includes(q))
    }
    return true
  })

  const connect = (id: string) => setConns(p => ({ ...p, [id]: p[id] === 'connected' ? 'connected' : 'pending' }))
  const message = (id: string) => navigate('/messages')

  const roleVariant = (role: string): 'violet'|'cyan'|'teal'|'rose' => ({ founder:'violet', collaborator:'cyan', investor:'teal', organisation:'rose' } as any)[role] ?? 'violet'

  return (
    <DashboardLayout title="People">
      <div className="max-w-5xl mx-auto space-y-5 page-enter">
        {/* Search */}
        <div className="flex gap-3">
          <div className="flex-1 flex items-center gap-3 bg-[color:var(--card)] border border-[color:var(--border)] rounded-2xl px-4 py-3 focus-within:ring-2 focus-within:ring-[color:var(--ring)] transition-all">
            <Search className="h-5 w-5 text-[color:var(--muted-foreground)] flex-shrink-0" />
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search by name, skills, or bio…"
              className="flex-1 bg-transparent text-sm text-[color:var(--foreground)] outline-none placeholder:text-[color:var(--muted-foreground)]" />
            {query && (
              <button onClick={() => setQuery('')} className="text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition-colors">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Role filters */}
        <div className="flex gap-2 flex-wrap">
          {ROLES.map(r => (
            <button key={r} onClick={() => setRole(r)}
              className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-all capitalize', roleFilter === r ? 'bg-[color:var(--primary)] text-white border-[color:var(--primary)]' : 'border-[color:var(--border)] text-[color:var(--muted-foreground)] hover:border-[color:var(--primary)]/40')}>
              {r}
            </button>
          ))}
        </div>

        <p className="text-sm text-[color:var(--muted-foreground)]">{filtered.length} people found</p>

        {filtered.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="font-bold text-lg mb-1">No people found</p>
            <p className="text-sm text-[color:var(--muted-foreground)]">Try different keywords or clear filters.</p>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {filtered.map(p => {
              const name = `${p.firstName} ${p.lastName}`
              const status = connections[p.id] ?? 'none'
              return (
                <Card key={p.id} className="p-4 hover:border-[color:var(--primary)]/20 transition-all">
                  <div className="flex items-start gap-3 mb-3">
                    <Avatar name={name} size="lg" />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-0.5">
                        <span className="font-semibold text-sm">{name}</span>
                        <Badge variant={roleVariant(p.role)}>{p.role}</Badge>
                        {p.isVerified && <Badge variant="teal">Verified</Badge>}
                      </div>
                      <p className="text-xs text-[color:var(--muted-foreground)]">
                        {p.country} · Score: {Math.round(p.credibilityScore)} · {p.weeklyHours}h/wk
                      </p>
                    </div>
                  </div>

                  {p.bio && <p className="text-xs text-[color:var(--muted-foreground)] leading-relaxed mb-3 line-clamp-2">{p.bio}</p>}

                  {p.skills?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {p.skills.slice(0, 4).map(s => (
                        <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-[color:var(--secondary)]/15 text-[color:var(--secondary)] border border-[color:var(--secondary)]/20">{s}</span>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    {status === 'connected' ? (
                      <Button size="sm" variant="outline" className="gap-1.5 text-emerald-400 border-emerald-500/30" disabled>
                        <UserCheck className="h-4 w-4" /> Connected
                      </Button>
                    ) : status === 'pending' ? (
                      <Button size="sm" variant="outline" className="gap-1.5" disabled>
                        <UserPlus className="h-4 w-4" /> Requested
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => connect(p.id)}>
                        <UserPlus className="h-4 w-4" /> Connect
                      </Button>
                    )}
                    {status === 'connected' && (
                      <Button size="sm" className="flex-1 gap-1.5" onClick={() => message(p.id)}>
                        <MessageCircle className="h-4 w-4" /> Message
                      </Button>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
