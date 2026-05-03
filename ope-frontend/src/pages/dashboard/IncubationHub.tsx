// IncubationHub.tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Trophy, Lightbulb, Users, Rocket, Star, Target, Zap, Lock, CheckCircle } from 'lucide-react'
import DashboardLayout from '../../components/shared/DashboardLayout'
import { Card, Button, Badge } from '../../components/ui'
import { useCredits } from '../../contexts/CreditContext'
import { cn } from '../../lib/utils'

const STAGES = [
  { id: 1, title: 'Idea Validation', desc: 'Validate your problem-solution fit with AI analysis.', tasks: ['AI idea evaluation','Problem clarity review','Target market analysis','Competitor mapping'], credits: 75, icon: Lightbulb },
  { id: 2, title: 'Team Building', desc: 'Find and onboard the right collaborators.', tasks: ['Workspace setup','AI collaborator matching','Define roles & equity','Team agreements'], credits: 50, icon: Users },
  { id: 3, title: 'MVP Planning', desc: 'Build your roadmap and define the minimum viable product.', tasks: ['Feature prioritization','Tech stack selection','Sprint planning','Launch timeline'], credits: 0, icon: Target },
  { id: 4, title: 'Build & Ship', desc: 'Execute your MVP in the collaborative workspace.', tasks: ['Active workspace','Weekly milestones','Beta user testing','Rapid iteration'], credits: 0, icon: Zap },
  { id: 5, title: 'Investor Ready', desc: 'Prepare your pitch and connect with investors.', tasks: ['Pitch deck creation','Investor introductions','Demo day prep','Term sheet basics'], credits: 100, icon: Star },
]

export default function IncubationHub() {
  const { balance } = useCredits()
  const [activeStage, setActiveStage] = useState(1)
  const stage = STAGES.find(s => s.id === activeStage)!

  return (
    <DashboardLayout title="Incubation Hub">
      <div className="max-w-6xl mx-auto space-y-6 page-enter">
        {/* Hero */}
        <div className="rounded-2xl bg-gradient-to-br from-violet-500/15 via-[color:var(--primary)]/8 to-transparent border border-[color:var(--primary)]/20 p-6 relative overflow-hidden">
          <div className="orb orb-violet w-48 h-48 -top-10 -right-10 absolute opacity-30" />
          <div className="relative z-10">
            <div className="font-mono text-xs text-[color:var(--primary)] uppercase tracking-widest mb-2">TechIT Incubation Program</div>
            <h1 className="font-bold text-2xl mb-1">Turn Your Idea Into a Funded Startup</h1>
            <p className="text-sm text-[color:var(--muted-foreground)]">A 5-stage structured program with AI tools, team matching, and direct investor access.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
          {/* Stage list */}
          <div className="space-y-2">
            {STAGES.map(s => (
              <button key={s.id} onClick={() => setActiveStage(s.id)}
                className={cn('w-full flex items-center gap-3 p-4 rounded-2xl border text-left transition-all', activeStage === s.id ? 'border-[color:var(--primary)] bg-[color:var(--primary)]/8' : 'border-[color:var(--border)] bg-[color:var(--card)] hover:border-[color:var(--primary)]/20')}>
                <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0', activeStage === s.id ? 'bg-[color:var(--primary)]/20' : 'bg-[color:var(--muted)]')}>
                  <s.icon className={cn('h-5 w-5', activeStage === s.id ? 'text-[color:var(--primary)]' : 'text-[color:var(--muted-foreground)]')} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2"><span className="font-semibold text-sm">{s.title}</span></div>
                  <p className="text-xs text-[color:var(--muted-foreground)] truncate">{s.desc}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Stage detail */}
          <Card className="p-6 space-y-6">
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[color:var(--primary)]/20 to-blue-500/20 border border-[color:var(--primary)]/20 flex items-center justify-center flex-shrink-0">
                <stage.icon className="h-7 w-7 text-[color:var(--primary)]" />
              </div>
              <div>
                <h2 className="font-bold text-xl mb-1">Stage {stage.id}: {stage.title}</h2>
                <p className="text-[color:var(--muted-foreground)] text-sm leading-relaxed">{stage.desc}</p>
              </div>
            </div>

            <div>
              <h3 className="font-bold text-sm mb-3">Stage Checklist</h3>
              <div className="space-y-2">
                {stage.tasks.map((task, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/20">
                    <div className="h-5 w-5 rounded-full border border-[color:var(--muted-foreground)]/30 flex items-center justify-center flex-shrink-0" />
                    <span className="text-sm">{task}</span>
                  </div>
                ))}
              </div>
            </div>

            {stage.credits > 0 && (
              <div className="p-4 rounded-xl bg-amber-500/8 border border-amber-500/20">
                <p className="text-sm text-[color:var(--muted-foreground)]">
                  <span className="text-amber-400 font-semibold">{stage.credits} credits</span> required for AI features in this stage.
                  {balance < stage.credits && <Link to="/wallet" className="text-[color:var(--primary)] underline font-medium ml-1">Buy more credits.</Link>}
                </p>
              </div>
            )}

            <div className="flex gap-3">
              {stage.id === 1 && <Link to="/idea-submit" className="flex-1"><Button className="w-full"><Lightbulb className="h-4 w-4" /> Evaluate Idea</Button></Link>}
              {stage.id === 2 && <Link to="/matches" className="flex-1"><Button className="w-full"><Users className="h-4 w-4" /> Find Collaborators</Button></Link>}
              {stage.id >= 3 && <Link to="/workspaces" className="flex-1"><Button className="w-full"><Rocket className="h-4 w-4" /> Open Workspace</Button></Link>}
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
