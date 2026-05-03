import { Link } from 'react-router-dom'
import DashboardLayout from '../../components/shared/DashboardLayout'
import { Card, Button } from '../../components/ui'
import { TrendingUp, Zap, Star } from 'lucide-react'
import { useCredits } from '../../contexts/CreditContext'

export default function Earnings() {
  const { balance } = useCredits()

  return (
    <DashboardLayout title="Credits & Earnings">
      <div className="max-w-4xl mx-auto space-y-6 page-enter">
        {/* Balance hero */}
        <div className="rounded-2xl bg-gradient-to-br from-[color:var(--primary)]/15 via-blue-500/8 to-transparent border border-[color:var(--primary)]/20 p-8 relative overflow-hidden">
          <div className="relative z-10">
            <p className="font-mono text-xs text-[color:var(--muted-foreground)] uppercase mb-2">Credit Balance</p>
            <div className="font-bold text-6xl gradient-text mb-1">{balance.toLocaleString()}</div>
            <p className="text-sm text-[color:var(--muted-foreground)] mb-6">credits available</p>
            <Link to="/wallet"><Button className="gap-2"><Zap className="h-4 w-4" /> Buy Credits</Button></Link>
          </div>
        </div>

        {/* Ways to earn */}
        <Card className="p-5">
          <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
            <Star className="h-4 w-4 text-[color:var(--primary)]" /> Ways to Earn Credits
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { action: 'Complete a project milestone', earn: '+50', how: 'Mark projects as completed' },
              { action: 'Receive a 5-star review',       earn: '+30', how: 'Deliver great work' },
              { action: 'Refer a friend who joins',      earn: '+100',how: 'Share your referral link' },
              { action: 'Add a verified certification',  earn: '+40', how: 'Upload in Settings' },
              { action: '7-day platform login streak',   earn: '+25', how: 'Log in every day' },
              { action: 'Post gets 50+ likes',           earn: '+20', how: 'Share quality content' },
            ].map(item => (
              <div key={item.action}
                className="flex items-center gap-3 p-3 rounded-xl bg-[color:var(--muted)]/30 border border-[color:var(--border)]">
                <div className="h-7 w-7 rounded-lg bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{item.action}</p>
                  <p className="text-xs text-[color:var(--muted-foreground)]">{item.how}</p>
                </div>
                <span className="font-mono text-sm text-emerald-400 font-bold flex-shrink-0">{item.earn}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </DashboardLayout>
  )
}
