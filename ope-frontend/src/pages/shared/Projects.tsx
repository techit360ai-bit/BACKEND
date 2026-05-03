import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, Rocket, UserPlus, Check, X, Filter } from 'lucide-react'
import DashboardLayout from '../../components/shared/DashboardLayout'
import { Card, Button, Badge, Avatar } from '../../components/ui'
import { useAuth } from '../../contexts/AuthContext'
import { cn, timeAgo } from '../../lib/utils'

const MOCK_PROJECTS = [
  { id: 'mp1', founder_id: 'ext1', title: 'AI-Powered Analytics Platform', pitch: 'Revolutionary analytics using ML to help businesses make data-driven decisions.', industry: 'AI/ML', stage: 'MVP', ai_score: 85, status: 'active', created_at: new Date(Date.now() - 14*86400000).toISOString(), tech_stack: ['React','Python','TensorFlow'], founder: { firstName: 'John', lastName: 'Doe', country: 'Nigeria', credibilityScore: 85 } },
  { id: 'mp2', founder_id: 'ext2', title: 'Sustainable Fashion Marketplace', pitch: 'Eco-friendly marketplace connecting conscious consumers with sustainable fashion brands.', industry: 'E-Commerce', stage: 'Idea', ai_score: 92, status: 'active', created_at: new Date(Date.now() - 7*86400000).toISOString(), tech_stack: ['Next.js','Node.js','MongoDB'], founder: { firstName: 'Jane', lastName: 'Smith', country: 'Kenya', credibilityScore: 78 } },
  { id: 'mp3', founder_id: 'ext3', title: 'HealthTech Telemedicine Platform', pitch: 'Connecting patients with doctors via video consultations and AI symptom checker.', industry: 'HealthTech', stage: 'Launch', ai_score: 88, status: 'active', created_at: new Date(Date.now() - 21*86400000).toISOString(), tech_stack: ['React Native','Node.js','AWS'], founder: { firstName: 'Alice', lastName: 'Johnson', country: 'South Africa', credibilityScore: 92 } },
  { id: 'mp4', founder_id: 'ext4', title: 'DeFi Lending Protocol', pitch: 'Decentralized lending protocol enabling permissionless borrowing on EVM chains.', industry: 'Web3', stage: 'MVP', ai_score: 79, status: 'active', created_at: new Date(Date.now() - 5*86400000).toISOString(), tech_stack: ['Solidity','React','Ethers.js'], founder: { firstName: 'Chen', lastName: 'Wei', country: 'Singapore', credibilityScore: 83 } },
]

const STAGES = ['All', 'Idea', 'MVP', 'Launch', 'Growth']
const INDUSTRIES = ['All', 'AI/ML', 'FinTech', 'HealthTech', 'E-Commerce', 'SaaS', 'Web3', 'Other']

export default function Projects() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [query,    setQuery]    = useState('')
  const [stage,    setStage]    = useState('All')
  const [industry, setIndustry] = useState('All')
  const [joinStatus, setJS]     = useState<Record<string, 'none'|'pending'|'member'>>({})
  const [modal,    setModal]    = useState<typeof MOCK_PROJECTS[0] | null>(null)
  const [joinMsg,  setJoinMsg]  = useState('')

  // Also show user's own projects from localStorage
  const localProjects = (() => { try { return JSON.parse(localStorage.getItem('techit_projects') || '[]') } catch { return [] } })()
  const allProjects = [...localProjects.filter((p: any) => p.founder_id !== profile?.id && p.status === 'active'), ...MOCK_PROJECTS]

  const filtered = allProjects.filter((p: any) => {
    if (stage !== 'All' && p.stage !== stage) return false
    if (industry !== 'All' && p.industry !== industry) return false
    if (query) { const q = query.toLowerCase(); return p.title.toLowerCase().includes(q) || p.pitch.toLowerCase().includes(q) }
    return true
  })

  const sendJoinRequest = (project: any) => {
    if (!profile) return
    setJS(prev => ({ ...prev, [project.id]: 'pending' }))
    const requests = JSON.parse(localStorage.getItem('techit_join_requests') || '[]')
    requests.push({ id: Date.now().toString(), project_id: project.id, user_id: profile.id, message: joinMsg || `I'd love to join ${project.title}!`, status: 'pending', created_at: new Date().toISOString() })
    localStorage.setItem('techit_join_requests', JSON.stringify(requests))
    setModal(null); setJoinMsg('')
  }

  return (
    <DashboardLayout title="Discover Projects">
      <div className="max-w-5xl mx-auto space-y-5 page-enter">
        {/* Search */}
        <div className="flex gap-3">
          <div className="flex-1 flex items-center gap-3 bg-[color:var(--card)] border border-[color:var(--border)] rounded-2xl px-4 py-3 focus-within:ring-2 focus-within:ring-[color:var(--ring)] transition-all">
            <Search className="h-5 w-5 text-[color:var(--muted-foreground)] flex-shrink-0" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search projects by name, pitch, or industry…"
              className="flex-1 bg-transparent text-sm text-[color:var(--foreground)] outline-none placeholder:text-[color:var(--muted-foreground)]" />
            {query && <button onClick={() => setQuery('')} className="text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"><X className="h-4 w-4" /></button>}
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-4 flex-wrap">
          <div className="flex gap-2 flex-wrap">
            {STAGES.map(s => (
              <button key={s} onClick={() => setStage(s)}
                className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-all', stage === s ? 'bg-[color:var(--primary)] text-white border-[color:var(--primary)]' : 'border-[color:var(--border)] text-[color:var(--muted-foreground)] hover:border-[color:var(--primary)]/40')}>
                {s}
              </button>
            ))}
          </div>
          <select value={industry} onChange={e => setIndustry(e.target.value)}
            className="h-8 rounded-xl border border-[color:var(--border)] bg-[color:var(--input)] px-3 text-xs text-[color:var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]">
            {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
          </select>
        </div>

        <p className="text-sm text-[color:var(--muted-foreground)]">{filtered.length} projects found</p>

        {filtered.length === 0 ? (
          <Card className="p-12 text-center">
            <Rocket className="h-12 w-12 text-[color:var(--muted-foreground)]/30 mx-auto mb-4" />
            <p className="font-bold text-lg mb-1">No projects found</p>
            <p className="text-sm text-[color:var(--muted-foreground)] mb-4">Try different filters or submit your own idea.</p>
            <Link to="/idea-submit"><Button>Submit an Idea</Button></Link>
          </Card>
        ) : (
          <div className="space-y-4">
            {filtered.map((project: any) => {
              const founder = project.founder
              const founderName = founder ? `${founder.firstName} ${founder.lastName}` : 'Founder'
              const status = joinStatus[project.id] ?? 'none'
              const score = project.ai_score

              return (
                <Card key={project.id} className="p-5 hover:border-[color:var(--primary)]/20 transition-all">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[color:var(--primary)] to-blue-400 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                        {project.title.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-bold">{project.title}</span>
                          <Badge variant="outline">{project.stage}</Badge>
                          <Badge>{project.industry}</Badge>
                          {score != null && <span className={cn('font-mono text-xs font-bold', score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-rose-400')}>AI: {score}</span>}
                        </div>
                        <p className="text-sm text-[color:var(--muted-foreground)] leading-relaxed mb-2 line-clamp-2">{project.pitch}</p>
                        {founder && (
                          <p className="text-xs text-[color:var(--muted-foreground)]">{founderName} · {founder.country}</p>
                        )}
                        {project.tech_stack?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {project.tech_stack.slice(0, 4).map((t: string) => (
                              <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-[color:var(--muted)] text-[color:var(--muted-foreground)] border border-[color:var(--border)]">{t}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end gap-3 flex-shrink-0">
                      {status === 'member' ? (
                        <Button size="sm" onClick={() => navigate(`/workspace/${project.id}`)}>Open Workspace</Button>
                      ) : status === 'pending' ? (
                        <Button size="sm" variant="outline" disabled><UserPlus className="h-4 w-4" /> Requested</Button>
                      ) : (
                        <Button size="sm" onClick={() => setModal(project)}><UserPlus className="h-4 w-4" /> Request to Join</Button>
                      )}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Join request modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[color:var(--card)] border border-[color:var(--border)] rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="font-bold text-lg mb-2">Request to Join</h3>
            <p className="text-sm text-[color:var(--muted-foreground)] mb-4">
              Send a message to <span className="font-semibold text-[color:var(--foreground)]">{modal.title}</span>'s founder.
            </p>
            <textarea value={joinMsg} onChange={e => setJoinMsg(e.target.value)}
              placeholder="Explain your relevant skills and how you can contribute…"
              rows={4}
              className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--input)] px-4 py-3 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)] resize-none mb-4" />
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => { setModal(null); setJoinMsg('') }}>Cancel</Button>
              <Button className="flex-1" onClick={() => sendJoinRequest(modal)}>Send Request</Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
