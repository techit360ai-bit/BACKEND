import { useEffect } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { TrendingUp, AlertTriangle, Users, ArrowRight, Sparkles, CheckCircle, XCircle } from 'lucide-react'
import DashboardLayout from '../../components/shared/DashboardLayout'
import { Card, Button, Badge } from '../../components/ui'
import { cn } from '../../lib/utils'

export default function AIEvaluation() {
  const location = useLocation()
  const navigate = useNavigate()
  const { idea, evaluation, projectId } = (location.state ?? {}) as any

  useEffect(() => { if (!idea || !evaluation) navigate('/idea-submit') }, [])
  if (!idea || !evaluation) return null

  const scoreColor = evaluation.overallScore >= 80 ? 'text-emerald-400' : evaluation.overallScore >= 60 ? 'text-amber-400' : 'text-rose-400'
  const scoreBg    = evaluation.overallScore >= 80 ? 'bg-emerald-500/10 border-emerald-500/25' : evaluation.overallScore >= 60 ? 'bg-amber-500/10 border-amber-500/25' : 'bg-rose-500/10 border-rose-500/25'

  return (
    <DashboardLayout title="AI Evaluation Results">
      <div className="max-w-4xl mx-auto space-y-6 page-enter">
        {/* Header */}
        <div className="text-center py-6">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-500 mb-4 shadow-xl"><Sparkles className="h-7 w-7 text-white" /></div>
          <h1 className="font-bold text-3xl mb-2">Evaluation Complete</h1>
          <p className="text-[color:var(--muted-foreground)]">Idea: <span className="font-semibold text-[color:var(--primary)]">{idea.title}</span></p>
        </div>

        {/* Overall score */}
        <Card className={cn('p-8 text-center bg-gradient-to-br border-2', scoreBg)}>
          <div className={cn('font-bold text-7xl mb-2', scoreColor)}>{evaluation.overallScore}</div>
          <div className="text-lg mb-3">Market Readiness Score</div>
          <div className={cn('inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border', scoreBg, scoreColor)}>
            <TrendingUp className="h-4 w-4" />{evaluation.readinessLevel}
          </div>
        </Card>

        {/* Breakdown */}
        <Card className="p-5">
          <h3 className="font-bold text-sm mb-4 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-[color:var(--primary)]" /> Score Breakdown</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {Object.entries(evaluation.breakdown ?? {}).map(([key, val]: any) => {
              const labels: Record<string,string> = { problemClarity:'Problem Clarity', marketSize:'Market Size', technicalFeasibility:'Technical Feasibility', monetizationViability:'Monetization', competitiveAdvantage:'Competitive Advantage' }
              const color = val >= 70 ? 'from-emerald-500 to-teal-500' : val >= 50 ? 'from-amber-500 to-yellow-500' : 'from-rose-500 to-red-500'
              return (
                <div key={key}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-[color:var(--muted-foreground)]">{labels[key] ?? key}</span>
                    <span className="font-mono font-semibold">{Math.round(val)}%</span>
                  </div>
                  <div className="h-2 bg-[color:var(--muted)] rounded-full overflow-hidden">
                    <div className={`h-full bg-gradient-to-r ${color} rounded-full transition-all duration-700`} style={{ width: `${val}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Strengths & Improvements */}
        <div className="grid sm:grid-cols-2 gap-5">
          <Card className="p-5">
            <h3 className="font-bold text-sm mb-4 flex items-center gap-2"><CheckCircle className="h-4 w-4 text-emerald-400" /> Strengths</h3>
            <ul className="space-y-2">
              {(evaluation.strengths ?? []).map((s: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="h-4 w-4 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center text-xs flex-shrink-0 mt-0.5 font-bold">+</span>
                  <span className="text-[color:var(--muted-foreground)] leading-relaxed">{s}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-5">
            <h3 className="font-bold text-sm mb-4 flex items-center gap-2"><XCircle className="h-4 w-4 text-amber-400" /> Areas to Improve</h3>
            <ul className="space-y-2">
              {(evaluation.improvements ?? []).map((s: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="h-4 w-4 rounded-full bg-amber-500/15 text-amber-400 flex items-center justify-center text-xs flex-shrink-0 mt-0.5 font-bold">!</span>
                  <span className="text-[color:var(--muted-foreground)] leading-relaxed">{s}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* Risks */}
        <Card className="p-5">
          <h3 className="font-bold text-sm mb-4 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-400" /> Risk Analysis</h3>
          <div className="space-y-3">
            {(evaluation.risks ?? []).map((risk: any, i: number) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-[color:var(--muted)]/30">
                <Badge variant={risk.level === 'Low' ? 'emerald' : risk.level === 'Medium' ? 'amber' : 'rose'}>{risk.level}</Badge>
                <div>
                  <p className="text-sm font-medium">{risk.risk}</p>
                  <p className="text-xs text-[color:var(--muted-foreground)] mt-0.5">{risk.description}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Roadmap */}
        <Card className="p-5">
          <h3 className="font-bold text-sm mb-4">AI-Generated Roadmap</h3>
          <div className="space-y-3">
            {(evaluation.roadmap ?? []).map((step: any, i: number) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[color:var(--primary)] to-blue-400 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{i + 1}</div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{step.task}</p>
                  <p className="text-xs text-[color:var(--muted-foreground)]">{step.phase} · {step.weeks}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Team composition */}
        <Card className="p-5 bg-gradient-to-br from-[color:var(--primary)]/5 to-blue-500/5 border-[color:var(--primary)]/15">
          <h3 className="font-bold text-sm mb-4 flex items-center gap-2"><Users className="h-4 w-4 text-[color:var(--primary)]" /> Recommended Team Composition</h3>
          <div className="grid sm:grid-cols-3 gap-3">
            {(evaluation.teamComposition ?? []).map((m: any, i: number) => (
              <div key={i} className="p-3 rounded-xl bg-[color:var(--card)] border border-[color:var(--border)]">
                <p className="text-sm font-semibold">{m.role}</p>
                <p className="text-xs text-[color:var(--muted-foreground)] mt-1">{m.skills}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Actions */}
        <div className="flex gap-4">
          <Button variant="outline" className="flex-1" onClick={() => navigate('/idea-submit')}>Revise Idea</Button>
          <Button className="flex-1" onClick={() => navigate('/matches', { state: { projectId } })}>
            Find Collaborators <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </DashboardLayout>
  )
}
