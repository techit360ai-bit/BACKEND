import { useState } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, TrendingDown, Plus, Star, CreditCard, Gift, RefreshCw, Zap, Rocket } from 'lucide-react'
import DashboardLayout from '../../components/shared/DashboardLayout'
import { Card, Button } from '../../components/ui'
import { useAuth } from '../../contexts/AuthContext'
import { useCredits } from '../../contexts/CreditContext'
import { cn } from '../../lib/utils'

const PKGS = [
  { id: 'starter', credits: 500,   priceNGN: 1000,  priceUSD: 1.00,  label: 'Starter' },
  { id: 'builder', credits: 1500,  priceNGN: 2500,  priceUSD: 2.50,  label: 'Builder', popular: true },
  { id: 'pro',     credits: 5000,  priceNGN: 5000,  priceUSD: 5.00,  label: 'Pro' },
  { id: 'elite',   credits: 15000, priceNGN: 10000, priceUSD: 10.00, label: 'Elite' },
]

const EARN_WAYS = [
  { action: 'Complete a project milestone', earn: '+50',  how: 'Mark projects as completed' },
  { action: 'Receive a 5-star review',      earn: '+30',  how: 'Deliver great work' },
  { action: 'Refer a friend who joins',     earn: '+100', how: 'Share your referral link' },
  { action: 'Add verified certification',   earn: '+40',  how: 'Upload in Settings' },
  { action: '7-day login streak',           earn: '+25',  how: 'Log in every day' },
  { action: 'Post gets 50+ likes',          earn: '+20',  how: 'Share quality content' },
]

export default function Wallet() {
  const { profile } = useAuth()
  const { balance, refresh } = useCredits()

  const [tab,          setTab]     = useState<'overview'|'buy'|'earn'>('overview')
  const [selectedPkg,  setPkg]     = useState(1)
  const [currency,     setCur]     = useState<'NGN'|'USD'>('NGN')
  const [purchasing,   setPurch]   = useState(false)

  const pkg = PKGS[selectedPkg]

  const purchase = async () => {
    setPurch(true)
    // In production: redirect to payment provider
    await new Promise(r => setTimeout(r, 800))
    alert(`In production this would open the ${currency} payment gateway for ${pkg.label} (${pkg.credits} credits).`)
    setPurch(false)
  }

  return (
    <DashboardLayout title="Wallet & Credits">
      <div className="max-w-4xl mx-auto space-y-6 page-enter">
        {/* Balance hero */}
        <div className="rounded-2xl bg-gradient-to-br from-[color:var(--primary)]/20 via-blue-500/8 to-transparent border border-[color:var(--primary)]/20 p-8 relative overflow-hidden">
          <div className="relative z-10">
            <p className="font-mono text-xs text-[color:var(--muted-foreground)] uppercase mb-2">Your Credit Balance</p>
            <div className="font-bold text-6xl gradient-text">{balance.toLocaleString()}</div>
            <p className="text-sm text-[color:var(--muted-foreground)] mb-6">credits available</p>
            <div className="flex gap-3 flex-wrap">
              <Button onClick={() => setTab('buy')} className="gap-2"><Plus className="h-4 w-4" /> Buy Credits</Button>
              <Button variant="outline" onClick={() => setTab('earn')} className="gap-2"><Gift className="h-4 w-4" /> Earn Credits</Button>
              <Button variant="ghost" onClick={() => refresh()} className="gap-2"><RefreshCw className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-[color:var(--muted)] p-1 rounded-xl">
          {(['overview','buy','earn'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn('flex-1 py-2 rounded-lg capitalize transition-colors font-medium text-sm', tab === t && 'bg-[color:var(--card)] shadow-sm text-[color:var(--foreground)]', tab !== t && 'text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]')}>
              {t}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {tab === 'overview' && (
          <Card className="p-5">
            <h3 className="font-bold mb-4 flex items-center gap-2"><Zap className="h-4 w-4 text-[color:var(--primary)]" /> Credit Overview</h3>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center p-4 rounded-xl bg-[color:var(--muted)]/30 border border-[color:var(--border)]">
                <div className="font-bold text-2xl gradient-text">{balance}</div>
                <div className="text-xs text-[color:var(--muted-foreground)] mt-1">Available</div>
              </div>
              <div className="text-center p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                <div className="font-bold text-2xl text-emerald-400">250</div>
                <div className="text-xs text-[color:var(--muted-foreground)] mt-1">Earned (welcome)</div>
              </div>
              <div className="text-center p-4 rounded-xl bg-[color:var(--muted)]/30 border border-[color:var(--border)]">
                <div className="font-bold text-2xl">0</div>
                <div className="text-xs text-[color:var(--muted-foreground)] mt-1">Spent</div>
              </div>
            </div>
            <div className="space-y-2">
              {[['AI Collaborator Matching','50 cr'],['Idea AI Evaluation','75 cr'],['Incubation Hub / month','200 cr'],['Paid Collab Request','25 cr'],['Priority Profile Boost','100 cr']].map(([action, cost]) => (
                <div key={action} className="flex justify-between items-center py-2 border-b border-[color:var(--border)]/50 last:border-0">
                  <span className="text-sm text-[color:var(--muted-foreground)]">{action}</span>
                  <span className="font-mono text-xs text-[color:var(--primary)] font-medium">{cost}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Buy Tab */}
        {tab === 'buy' && (
          <div className="space-y-5">
            {/* Currency toggle */}
            <div className="flex items-center justify-between bg-[color:var(--card)] p-4 rounded-xl border border-[color:var(--border)]">
              <span className="text-sm font-medium">Select Currency</span>
              <div className="flex bg-[color:var(--muted)] p-1 rounded-lg">
                {(['NGN','USD'] as const).map(c => (
                  <button key={c} onClick={() => setCur(c)}
                    className={cn('px-4 py-1.5 rounded-md text-sm font-bold transition-all', currency === c && 'bg-[color:var(--background)] shadow text-[color:var(--primary)]', currency !== c && 'text-[color:var(--muted-foreground)]')}>
                    {c === 'NGN' ? '₦' : '$'} {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Package grid */}
            <div className="grid grid-cols-2 gap-4">
              {PKGS.map((p, i) => (
                <button key={p.id} onClick={() => setPkg(i)}
                  className={cn('relative border p-5 rounded-xl text-left transition-all', selectedPkg === i ? 'border-[color:var(--primary)] bg-[color:var(--primary)]/5 ring-1 ring-[color:var(--primary)] shadow-md' : 'hover:border-[color:var(--primary)]/50 bg-[color:var(--card)] border-[color:var(--border)]')}>
                  {p.popular && (
                    <div className="absolute top-0 right-0 bg-[color:var(--primary)] text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg uppercase">Popular</div>
                  )}
                  <div className="font-bold text-lg mb-1">{p.label}</div>
                  <div className="text-[color:var(--muted-foreground)] text-sm mb-3 font-medium">{p.credits.toLocaleString()} credits</div>
                  <div className="font-bold text-2xl">
                    {currency === 'NGN' ? `₦${p.priceNGN.toLocaleString()}` : `$${p.priceUSD.toFixed(2)}`}
                  </div>
                </button>
              ))}
            </div>

            <Card className="p-5">
              <Button className="w-full font-bold text-lg h-12" onClick={purchase} loading={purchasing}>
                <CreditCard className="h-5 w-5" /> Proceed to Payment
              </Button>
              <p className="text-xs text-center text-[color:var(--muted-foreground)] mt-3">Credits are added instantly after payment confirmation</p>
            </Card>
          </div>
        )}

        {/* Earn Tab */}
        {tab === 'earn' && (
          <Card className="p-5 space-y-4">
            <h3 className="font-bold flex items-center gap-2 mb-4">
              <Star className="h-4 w-4 text-amber-400" /> Ways to Earn Free Credits
            </h3>
            {EARN_WAYS.map(e => (
              <div key={e.action} className="flex items-center gap-3 p-3 rounded-xl bg-[color:var(--muted)]/30 border border-[color:var(--border)]">
                <div className="h-8 w-8 rounded-lg bg-[color:var(--primary)]/10 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="h-4 w-4 text-[color:var(--primary)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{e.action}</p>
                  <p className="text-xs text-[color:var(--muted-foreground)]">{e.how}</p>
                </div>
                <span className="font-mono text-sm text-emerald-400 font-bold flex-shrink-0">{e.earn}</span>
              </div>
            ))}
            <div className="mt-4 p-4 rounded-xl bg-[color:var(--primary)]/5 border border-[color:var(--primary)]/15">
              <p className="text-xs text-[color:var(--muted-foreground)] text-center">Complete these actions to earn free credits and boost your credibility score!</p>
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}
