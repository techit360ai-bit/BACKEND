import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Rocket, Users, TrendingUp, Star, Lightbulb, Zap, Target, ChevronRight, Plus, AlertCircle, UserPlus, Check, X, RefreshCw } from 'lucide-react'
import DashboardLayout from '../../components/shared/DashboardLayout'
import { Card, Button, Badge, Avatar, StatCard } from '../../components/ui'
import { useAuth } from '../../contexts/AuthContext'
import { useCredits } from '../../contexts/CreditContext'
import { cn, timeAgo } from '../../lib/utils'

// Storage helpers
const getLS = (key: string) => { try { return JSON.parse(localStorage.getItem(key) || '[]') } catch { return [] } }
const setLS = (key: string, val: unknown) => localStorage.setItem(key, JSON.stringify(val))

interface Project { id: string; title: string; pitch: string; industry: string; stage: string; ai_score?: number; status: string; created_at: string }
interface Notification { id: string; type: string; title: string; body: string; read: boolean; created_at: string }

export default function FounderDashboard() {
  const { profile } = useAuth()
  const { balance } = useCredits()
  const navigate = useNavigate()

  const [projects, setProjects]   = useState<Project[]>([])
  const [notifs, setNotifs]       = useState<Notification[]>([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => { load() }, [profile?.id])

  function load() {
    setLoading(true)
    const allProjects: Project[] = getLS('techit_projects')
    setProjects(allProjects.filter(p => p.status === 'active').slice(0, 5))

    const allNotifs: Notification[] = getLS('techit_notifications')
    setNotifs(allNotifs.slice(0, 6))
    setLoading(false)
  }

  const profilePct = Math.round(([profile?.bio, profile?.skills?.length, profile?.linkedinUrl, profile?.avatarUrl, profile?.githubUrl].filter(Boolean).length / 5) * 100)

  return (
    <DashboardLayout action={
      <Link to="/idea-submit"><Button size="sm" className="hidden sm:inline-flex gap-2"><Lightbulb className="h-4 w-4" /> New Idea</Button></Link>
    }>
      <div className="max-w-7xl mx-auto space-y-6 page-enter">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-bold text-2xl">Welcome back, {profile?.firstName ?? 'Founder'}</h1>
            <p className="text-sm text-[color:var(--muted-foreground)] mt-1">
              {projects.length > 0 ? `${projects.length} active project${projects.length !== 1 ? 's' : ''}` : 'Get started by submitting your first idea.'}
            </p>
          </div>
          <Link to="/idea-submit" className="sm:hidden"><Button size="sm" className="w-full gap-2"><Lightbulb className="h-4 w-4" /> New Idea</Button></Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard label="Active Projects" value={String(projects.length)} icon={<Target className="h-5 w-5" />} color="violet" helper="in progress" />
          <StatCard label="Credit Balance" value={balance.toLocaleString()} icon={<Star className="h-5 w-5" />} color="teal" helper="available" />
          <StatCard label="Credibility" value={String(Math.round(profile?.credibilityScore ?? 0))} icon={<TrendingUp className="h-5 w-5" />} color="rose" helper="trust score" />
          <StatCard label="Profile" value={`${profilePct}%`} icon={<Zap className="h-5 w-5" />} color="cyan" helper="complete" />
        </div>

        {/* Projects */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-sm flex items-center gap-2"><Rocket className="h-4 w-4 text-[color:var(--primary)]" /> Your Projects</h2>
              <Link to="/idea-submit"><Button variant="ghost" size="sm" className="gap-1 text-xs"><Plus className="h-3.5 w-3.5" /> New</Button></Link>
            </div>
            {projects.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <div className="h-12 w-12 rounded-2xl bg-[color:var(--muted)] flex items-center justify-center mb-3">
                  <Rocket className="h-6 w-6 text-[color:var(--muted-foreground)]/40" />
                </div>
                <p className="text-sm font-medium mb-1">No active projects</p>
                <p className="text-xs text-[color:var(--muted-foreground)] mb-4">Submit your first idea and let AI evaluate its potential</p>
                <Link to="/idea-submit"><Button size="sm">Submit an Idea</Button></Link>
              </div>
            ) : (
              <div className="space-y-3">
                {projects.map(project => (
                  <div key={project.id} className="flex items-start gap-3 p-3 rounded-xl bg-[color:var(--muted)]/30 hover:bg-[color:var(--muted)]/50 transition-colors">
                    <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[color:var(--primary)] to-blue-400 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {project.title.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{project.title}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <Badge variant="outline">{project.stage}</Badge>
                        <Badge>{project.industry}</Badge>
                        {project.ai_score != null && <span className="font-mono text-xs text-emerald-400 font-bold">AI: {project.ai_score}</span>}
                      </div>
                    </div>
                    <Link to={`/workspace/${project.id}`}><Button variant="ghost" size="icon-sm"><ChevronRight className="h-4 w-4" /></Button></Link>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Quick actions + profile strength */}
          <div className="space-y-4">
            <Card className="p-4">
              <p className="text-xs font-semibold text-[color:var(--muted-foreground)] uppercase tracking-widest mb-3">Quick Actions</p>
              <div className="space-y-0.5">
                {[
                  { label: 'Submit Idea', href: '/idea-submit', icon: <Lightbulb className="h-4 w-4" /> },
                  { label: 'Find Collaborators', href: '/matches', icon: <UserPlus className="h-4 w-4" /> },
                  { label: 'Browse Projects', href: '/projects', icon: <Rocket className="h-4 w-4" /> },
                  { label: 'Find People', href: '/people', icon: <Users className="h-4 w-4" /> },
                  { label: 'Incubation Hub', href: '/incubation-hub', icon: <Target className="h-4 w-4" /> },
                  { label: 'Social Feed', href: '/feed', icon: <Zap className="h-4 w-4" /> },
                  { label: 'Wallet', href: '/wallet', icon: <Star className="h-4 w-4" /> },
                ].map(item => (
                  <Link key={item.href} to={item.href} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-[color:var(--muted)]/50 transition-colors group">
                    <span className="text-[color:var(--primary)]">{item.icon}</span>
                    <span className="text-sm font-medium flex-1">{item.label}</span>
                    <ChevronRight className="h-4 w-4 text-[color:var(--muted-foreground)] group-hover:text-[color:var(--foreground)] transition-colors" />
                  </Link>
                ))}
              </div>
            </Card>

            <Card className="p-4 space-y-3">
              <p className="text-xs font-semibold text-[color:var(--muted-foreground)] uppercase tracking-widest">Profile Strength</p>
              <div className="h-1.5 w-full rounded-full bg-[color:var(--muted)] overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-[color:var(--primary)] to-blue-400 transition-all duration-700" style={{ width: `${profilePct}%` }} />
              </div>
              <p className="text-xs text-[color:var(--muted-foreground)]">{profilePct}% complete — add bio, skills, and social links</p>
              {profilePct < 100 && <Link to="/settings"><Button variant="outline" size="sm" className="w-full text-xs">Complete Profile</Button></Link>}
            </Card>
          </div>
        </div>

        {/* Notifications */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-sm">Recent Activity</h2>
            <Link to="/notifications" className="text-xs text-[color:var(--primary)] hover:underline">View all</Link>
          </div>
          {notifs.length === 0 ? (
            <p className="text-sm text-[color:var(--muted-foreground)] py-8 text-center">No recent activity yet. Submit an idea or connect with people to get started!</p>
          ) : (
            <div className="space-y-2">
              {notifs.map(n => (
                <div key={n.id} className={cn('flex items-start gap-3 p-3 rounded-xl transition-colors cursor-pointer', n.read ? 'bg-[color:var(--muted)]/20' : 'bg-[color:var(--primary)]/5 border border-[color:var(--primary)]/10')}>
                  <div className="h-8 w-8 rounded-xl bg-[color:var(--muted)] flex items-center justify-center flex-shrink-0">
                    <Zap className="h-4 w-4 text-[color:var(--primary)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-tight">{n.title}</p>
                    <p className="text-xs text-[color:var(--muted-foreground)]">{n.body}</p>
                    <p className="text-xs text-[color:var(--muted-foreground)] mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                  {!n.read && <span className="h-2 w-2 rounded-full bg-[color:var(--primary)] flex-shrink-0 mt-1.5" />}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  )
}
