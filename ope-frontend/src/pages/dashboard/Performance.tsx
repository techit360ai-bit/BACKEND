import { Link } from 'react-router-dom'
import DashboardLayout from '../../components/shared/DashboardLayout'
import { Card, StatCard } from '../../components/ui'
import { Star, TrendingUp, Zap } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

export default function Performance() {
  const { profile } = useAuth()
  const score = Math.round(profile?.credibilityScore ?? 0)

  return (
    <DashboardLayout title="Performance">
      <div className="max-w-4xl mx-auto space-y-6 page-enter">
        <Card className="p-8 text-center bg-gradient-to-br from-[color:var(--primary)]/10 to-transparent border border-[color:var(--primary)]/20">
          <p className="font-mono text-xs text-[color:var(--muted-foreground)] uppercase mb-2">Your Credibility Score</p>
          <div className="font-bold text-7xl gradient-text mb-2">{score}</div>
          <div className="text-lg text-[color:var(--muted-foreground)]">/ 100</div>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <StatCard label="Credibility" value={String(score)} icon={<Star className="h-5 w-5" />} color="violet" helper="trust score" />
          <StatCard label="Skills" value={String(profile?.skills?.length ?? 0)} icon={<TrendingUp className="h-5 w-5" />} color="cyan" helper="listed" />
        </div>

        <Card className="p-5">
          <h3 className="font-bold text-sm mb-4">How to Improve Your Score</h3>
          <div className="space-y-2">
            {[
              { action: 'Complete active collaborations', points: '+15 pts each', href: '/collaborator/work' },
              { action: 'Add verified certifications', points: '+8 pts each', href: '/settings' },
              { action: 'Post to the social feed', points: '+1.5 pts each', href: '/feed' },
              { action: 'List more skills on your profile', points: '+1 pt each', href: '/settings' },
            ].map(item => (
              <Link key={item.action} to={item.href}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-[color:var(--muted)]/50 transition-colors group">
                <div className="h-7 w-7 rounded-lg bg-[color:var(--primary)]/10 flex items-center justify-center flex-shrink-0">
                  <Zap className="h-3.5 w-3.5 text-[color:var(--primary)]" />
                </div>
                <span className="text-sm flex-1">{item.action}</span>
                <span className="text-xs font-mono text-emerald-400">{item.points}</span>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </DashboardLayout>
  )
}
