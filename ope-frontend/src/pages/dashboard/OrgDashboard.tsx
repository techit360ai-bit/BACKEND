import { Link } from 'react-router-dom'
import DashboardLayout from '../../components/shared/DashboardLayout'
import { Card, Button, StatCard } from '../../components/ui'
import { Search, Building2, Zap, TrendingUp } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useCredits } from '../../contexts/CreditContext'

export default function OrgDashboard() {
  const { profile } = useAuth()
  const { balance } = useCredits()

  return (
    <DashboardLayout
      action={
        <Link to="/org/talent">
          <Button size="sm"><Search className="h-4 w-4" /> Find Talent</Button>
        </Link>
      }
    >
      <div className="max-w-7xl mx-auto space-y-6 page-enter">
        <div>
          <h1 className="font-bold text-2xl">
            Welcome, {profile?.orgName ?? profile?.firstName}
          </h1>
          <p className="text-sm text-[color:var(--muted-foreground)] mt-1">
            Find talent, post challenges, and engage with the builder community.
          </p>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard label="Credit Balance"   value={balance.toLocaleString()} icon={<Zap className="h-5 w-5" />} color="cyan" helper="available" />
          <StatCard label="Credibility Score" value={String(Math.round(profile?.credibilityScore ?? 0))} icon={<TrendingUp className="h-5 w-5" />} color="rose" helper="trust score" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card className="p-5">
            <h2 className="font-bold text-sm flex items-center gap-2 mb-4">
              <Building2 className="h-4 w-4 text-[color:var(--primary)]" /> Quick Actions
            </h2>
            <div className="space-y-2">
              {[
                { label: 'Post a Challenge', href: '/org/challenges' },
                { label: 'Search Talent',   href: '/org/talent' },
                { label: 'Social Feed',     href: '/feed' },
                { label: 'Buy Credits',     href: '/wallet' },
              ].map(item => (
                <Link key={item.href} to={item.href}
                  className="block p-2.5 rounded-xl hover:bg-[color:var(--muted)]/50 transition-colors text-sm font-medium">
                  {item.label}
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
