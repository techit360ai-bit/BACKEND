import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Zap, Search, AlertCircle, RefreshCw, Mail, MessageCircle } from 'lucide-react'
import DashboardLayout from '../../components/shared/DashboardLayout'
import { Card, Button, Badge, Avatar } from '../../components/ui'
import { useCredits, CREDIT_COSTS } from '../../contexts/CreditContext'
import { useAuth } from '../../contexts/AuthContext'
import { cn } from '../../lib/utils'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

export default function MatchResults() {
  const { profile } = useAuth()
  const { balance } = useCredits()
  const location = useLocation()
  const navigate = useNavigate()
  const { projectId: initProjectId } = (location.state ?? {}) as { projectId?: string }

  const [matches, setMatches]           = useState<any[]>([])
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')
  const [requestSent, setRequestSent]   = useState<Record<string, boolean>>({})
  const [filterRole, setFilterRole]     = useState('all')

  const COST = CREDIT_COSTS.AI_MATCH

  async function findMatches() {
    if (balance < COST) { setError(`Insufficient credits. Matching costs ${COST} credits.`); return }
    setLoading(true); setError('')
    try {
      const token = localStorage.getItem('techit_token')
      const res = await fetch(`${API}/matches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ projectId: initProjectId, filterRole }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Matching failed')
      setMatches(data.matches || [])
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }

  async function sendRequest(match: any) {
    setRequestSent(prev => ({ ...prev, [match.user_id]: true }))
    // Save collab request locally
    const requests = JSON.parse(localStorage.getItem('techit_collab_requests') || '[]')
    requests.push({ id: Date.now().toString(), from_id: profile?.id, to_id: match.user_id, type: 'free', message: `Hi ${match.profile?.firstName}! Your profile shows a ${match.score}% match. I'd love to discuss collaboration.`, status: 'pending', created_at: new Date().toISOString() })
    localStorage.setItem('techit_collab_requests', JSON.stringify(requests))
  }

  const filtered = filterRole === 'all' ? matches : matches.filter(m => m.profile?.role === filterRole)

  return (
    <DashboardLayout title="AI Collaborator Matching">
      <div className="max-w-5xl mx-auto space-y-6 page-enter">
        {/* Controls */}
        <Card className="p-5">
          <div className="flex flex-col sm:flex-row gap-4">
            <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
              className="h-10 rounded-xl border border-[color:var(--border)] bg-[color:var(--input)] px-4 text-sm text-[color:var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]">
              <option value="all">All Collaborators</option>
              <option value="collaborator">Collaborators</option>
              <option value="founder">Co-Founders</option>
            </select>
            <div className="flex items-center gap-2">
              <Button onClick={findMatches} loading={loading} className="gap-2"><Zap className="h-4 w-4" /> Find Matches ({COST} cr)</Button>
              {matches.length > 0 && <Button variant="ghost" size="icon" onClick={findMatches}><RefreshCw className="h-4 w-4" /></Button>}
            </div>
          </div>
          {error && <div className="mt-3 flex items-center gap-2 text-sm text-red-500 p-3 rounded-xl bg-red-500/10 border border-red-500/20"><AlertCircle className="h-4 w-4 flex-shrink-0" />{error}</div>}
          <p className="mt-3 text-xs text-[color:var(--muted-foreground)]">AI analyzes skill alignment, domain fit, availability, risk tolerance, and credibility. Balance: <span className="font-semibold">{balance} credits</span></p>
        </Card>

        {/* Empty state */}
        {matches.length === 0 && !loading && (
          <div className="text-center py-16">
            <div className="h-16 w-16 rounded-2xl bg-[color:var(--muted)]/50 flex items-center justify-center mx-auto mb-4">
              <Search className="h-8 w-8 text-[color:var(--muted-foreground)]/40" />
            </div>
            <h3 className="font-bold text-lg mb-2">No matches yet</h3>
            <p className="text-[color:var(--muted-foreground)] text-sm max-w-sm mx-auto">Click "Find Matches" to let AI surface the most compatible collaborators for your project.</p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            {[1,2,3].map(i => (
              <Card key={i} className="p-6 animate-pulse">
                <div className="flex gap-4">
                  <div className="h-16 w-16 rounded-full bg-[color:var(--muted)] flex-shrink-0" />
                  <div className="flex-1 space-y-3">
                    <div className="h-4 bg-[color:var(--muted)] rounded w-48" />
                    <div className="h-3 bg-[color:var(--muted)] rounded w-32" />
                    <div className="h-3 bg-[color:var(--muted)] rounded w-full" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Results */}
        {filtered.length > 0 && (
          <>
            <p className="text-sm text-[color:var(--muted-foreground)]">{filtered.length} match{filtered.length !== 1 ? 'es' : ''} found</p>
            <div className="space-y-4">
              {filtered.map((match) => {
                const p = match.profile
                if (!p) return null
                const name = `${p.firstName} ${p.lastName}`
                const sent = requestSent[match.user_id]
                return (
                  <Card key={match.user_id} className={cn('p-5 hover:border-[color:var(--primary)]/30 transition-all', sent && 'opacity-70')}>
                    <div className="flex flex-col sm:flex-row gap-5">
                      {/* Avatar + score */}
                      <div className="flex sm:flex-col items-center gap-4 sm:gap-2 flex-shrink-0">
                        <Avatar name={name} src={p.avatarUrl} size="lg" />
                        <div className="px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-sm font-bold font-mono text-emerald-400">{match.score}% match</div>
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="font-bold text-lg">{name}</h3>
                          <Badge variant="cyan">{p.role}</Badge>
                          {p.isVerified && <Badge variant="teal">Verified</Badge>}
                        </div>
                        <p className="text-xs text-[color:var(--muted-foreground)] mb-2 flex flex-wrap items-center gap-3">
                          {p.country && <span>{p.country}</span>}
                          {p.weeklyHours && <span>{p.weeklyHours}h/week</span>}
                          {p.riskTolerance && <span>{p.riskTolerance} risk</span>}
                          <span>Score: {Math.round(p.credibilityScore || 0)}</span>
                        </p>
                        {p.bio && <p className="text-sm text-[color:var(--muted-foreground)] leading-relaxed mb-3 line-clamp-2">{p.bio}</p>}

                        {/* Skills */}
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {(p.skills ?? []).slice(0, 6).map((s: string) => (
                            <span key={s} className="px-2 py-1 rounded-full bg-[color:var(--secondary)]/15 text-[color:var(--secondary)] text-xs font-medium border border-[color:var(--secondary)]/20">{s}</span>
                          ))}
                        </div>

                        {/* Breakdown bars */}
                        <div className="grid grid-cols-5 gap-2 mb-3">
                          {Object.entries(match.breakdown).map(([k, v]: any) => {
                            const labels: Record<string,string> = { skillAlignment:'Skills', domainFit:'Domain', availability:'Avail.', riskAlignment:'Risk', credibility:'Cred.' }
                            return (
                              <div key={k} className="text-center">
                                <div className="text-xs font-mono font-bold">{Math.round(v)}%</div>
                                <div className="text-[0.6rem] text-[color:var(--muted-foreground)]">{labels[k]}</div>
                              </div>
                            )
                          })}
                        </div>

                        {/* AI Insight */}
                        {match.aiInsight && (
                          <div className="p-2.5 rounded-xl bg-[color:var(--primary)]/5 border border-[color:var(--primary)]/15 mb-4">
                            <p className="text-xs text-[color:var(--muted-foreground)]">
                              <span className="text-[color:var(--primary)] font-semibold">AI: </span>{match.aiInsight}
                            </p>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" disabled={sent} onClick={() => sendRequest(match)}>
                            <Mail className="h-4 w-4" />{sent ? 'Request Sent' : 'Send Request'}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => navigate('/messages')}>
                            <MessageCircle className="h-4 w-4" /> Message
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
