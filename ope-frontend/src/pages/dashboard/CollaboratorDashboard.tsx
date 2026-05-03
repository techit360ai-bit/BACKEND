import { Link } from 'react-router-dom'
import { Target, Briefcase, Zap, TrendingUp, Star } from 'lucide-react'
import DashboardLayout from '../../components/shared/DashboardLayout'
import { Card, Button, StatCard } from '../../components/ui'
import { useAuth } from '../../contexts/AuthContext'
import { useCredits } from '../../contexts/CreditContext'

export default function CollaboratorDashboard() {
  const { profile } = useAuth()
  const { balance } = useCredits()

  return (
    <DashboardLayout action={<Link to="/collaborator/opportunities"><Button size="sm" className="gap-2"><Target className="h-4 w-4" /> Find Work</Button></Link>}>
      <div className="max-w-7xl mx-auto space-y-6 page-enter">
        <div>
          <h1 className="font-bold text-2xl">Welcome back, {profile?.firstName ?? 'Builder'}</h1>
          <p className="text-sm text-[color:var(--muted-foreground)] mt-1">Your collaboration hub</p>
        </div>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard label="Credibility Score" value={String(Math.round(profile?.credibilityScore ?? 0))} icon={<Star className="h-5 w-5" />} color="violet" helper="trust score" />
          <StatCard label="Credit Balance" value={balance.toLocaleString()} icon={<Zap className="h-5 w-5" />} color="teal" helper="available" />
          <StatCard label="Skills Listed" value={String(profile?.skills?.length ?? 0)} icon={<TrendingUp className="h-5 w-5" />} color="rose" helper="on profile" />
          <StatCard label="Active Work" value="0" icon={<Briefcase className="h-5 w-5" />} color="cyan" helper="projects" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card className="p-5">
            <h2 className="font-bold text-sm flex items-center gap-2 mb-4"><Briefcase className="h-4 w-4 text-[color:var(--primary)]" /> Active Projects</h2>
            <div className="flex flex-col items-center py-10 text-center">
              <div className="h-12 w-12 rounded-2xl bg-[color:var(--muted)] flex items-center justify-center mb-3"><Briefcase className="h-6 w-6 text-[color:var(--muted-foreground)]/40" /></div>
              <p className="text-sm font-medium mb-1">No active projects</p>
              <p className="text-xs text-[color:var(--muted-foreground)] mb-4">Browse opportunities that match your skill set</p>
              <Link to="/collaborator/opportunities"><Button size="sm">Browse Opportunities</Button></Link>
            </div>
          </Card>
          <Card className="p-5">
            <h2 className="font-bold text-sm flex items-center gap-2 mb-4"><Target className="h-4 w-4 text-[color:var(--primary)]" /> Quick Actions</h2>
            <div className="space-y-2">
              {[
                { label: 'Browse Opportunities', href: '/collaborator/opportunities' },
                { label: 'My Work', href: '/collaborator/work' },
                { label: 'Performance', href: '/collaborator/performance' },
                { label: 'Earnings', href: '/collaborator/earnings' },
                { label: 'Social Feed', href: '/feed' },
              ].map(item => (
                <Link key={item.href} to={item.href} className="block w-full p-2.5 rounded-xl hover:bg-[color:var(--muted)]/50 transition-colors text-sm font-medium text-[color:var(--foreground)] hover:text-[color:var(--primary)]">{item.label}</Link>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
