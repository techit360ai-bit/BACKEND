import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lightbulb, ArrowRight, ArrowLeft, Sparkles, AlertCircle } from 'lucide-react'
import DashboardLayout from '../../components/shared/DashboardLayout'
import { Card, Button, Input } from '../../components/ui'
import { useCredits, CREDIT_COSTS } from '../../contexts/CreditContext'
import { useAuth } from '../../contexts/AuthContext'
import { cn } from '../../lib/utils'

const INDUSTRIES = ['AI/ML','FinTech','HealthTech','E-Commerce','SaaS','Edtech','CleanTech','Web3','Other']
const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

interface IdeaForm { title: string; pitch: string; problem: string; solution: string; target: string; industry: string; techStack: string; monetization: string }

function getLS(key: string) { try { return JSON.parse(localStorage.getItem(key) || '[]') } catch { return [] } }

export default function IdeaSubmit() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { balance, deduct } = useCredits()
  const [step, setStep]     = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  const [idea, setIdea] = useState<IdeaForm>({ title:'', pitch:'', problem:'', solution:'', target:'', industry:'', techStack:'', monetization:'' })
  const setF = (k: keyof IdeaForm, v: string) => setIdea(p => ({ ...p, [k]: v }))

  const filled = Object.values(idea).filter(x => x.length > 5).length
  const previewScore = { clarity: Math.min(95, filled * 12), market: Math.min(90, filled * 10), feasibility: Math.min(88, filled * 11) }

  const canNext = step === 1 ? idea.title.length > 2 && idea.pitch.length > 10 : idea.problem.length > 10 && idea.solution.length > 10
  const COST = CREDIT_COSTS.IDEA_EVAL

  async function handleSubmit() {
    if (balance < COST) { setError(`Insufficient credits. This costs ${COST} credits. You have ${balance}.`); return }
    if (!profile) { setError('Not authenticated.'); return }
    setLoading(true); setError('')
    try {
      const token = localStorage.getItem('techit_token')
      const res = await fetch(`${API}/matches/evaluate-idea`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(idea),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Evaluation failed')

      // Save project locally
      const project = { id: Date.now().toString(), founder_id: profile.id, title: idea.title, pitch: idea.pitch, problem: idea.problem, solution: idea.solution, industry: idea.industry || 'Other', tech_stack: idea.techStack ? idea.techStack.split(',').map((s: string) => s.trim()) : [], stage: 'Idea', monetization: idea.monetization || null, status: 'active', created_at: new Date().toISOString(), ai_score: data.evaluation.overallScore }
      const projects = getLS('techit_projects')
      projects.unshift(project)
      localStorage.setItem('techit_projects', JSON.stringify(projects))

      navigate('/idea-eval', { state: { idea, evaluation: data.evaluation, projectId: project.id } })
    } catch (e) { setError((e as Error).message || 'Something went wrong') }
    finally { setLoading(false) }
  }

  const ta = 'w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--input)] px-4 py-3 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)] resize-none'

  return (
    <DashboardLayout title="Submit Idea">
      <div className="max-w-4xl mx-auto page-enter">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br from-[color:var(--primary)] to-blue-400 mb-4 shadow-lg">
            <Lightbulb className="h-7 w-7 text-white" />
          </div>
          <h1 className="font-bold text-3xl mb-2">Submit Your Idea</h1>
          <p className="text-[color:var(--muted-foreground)] text-sm">AI evaluates across 5 dimensions · Costs {COST} credits · Balance: {balance}</p>
        </div>
        {/* Steps */}
        <div className="flex items-center justify-center gap-3 mb-8">
          {[1,2,3].map(n => (
            <div key={n} className="flex items-center gap-3">
              <div className={cn('h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold transition-all', n < step ? 'bg-gradient-to-br from-cyan-500 to-teal-500 text-white' : n === step ? 'bg-[color:var(--primary)] text-white shadow-lg' : 'bg-[color:var(--muted)] text-[color:var(--muted-foreground)] border border-[color:var(--border)]')}>
                {n < step ? '✓' : n}
              </div>
              {n < 3 && <div className={cn('w-12 h-0.5 rounded-full transition-all', n < step ? 'bg-teal-500' : 'bg-[color:var(--border)]')} />}
            </div>
          ))}
        </div>
        {error && <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-500 mb-6"><AlertCircle className="h-4 w-4 flex-shrink-0" />{error}</div>}

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card className="p-6">
              {step === 1 && (
                <div className="space-y-5">
                  <p className="font-mono text-xs text-[color:var(--primary)] uppercase tracking-widest">Step 01 — The Hook</p>
                  <Input label="Idea Title *" value={idea.title} onChange={e => setF('title', e.target.value)} placeholder="e.g., AI-Powered Legal Review for African SMEs" />
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">One-Line Pitch *</label>
                    <textarea value={idea.pitch} onChange={e => setF('pitch', e.target.value)} placeholder="Describe your idea in one compelling sentence..." rows={3} className={ta} />
                  </div>
                </div>
              )}
              {step === 2 && (
                <div className="space-y-5">
                  <p className="font-mono text-xs text-[color:var(--primary)] uppercase tracking-widest">Step 02 — Problem & Solution</p>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">Problem Statement *</label>
                    <textarea value={idea.problem} onChange={e => setF('problem', e.target.value)} placeholder="What specific pain point does this solve? Who suffers from it?" rows={4} className={ta} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">Your Solution *</label>
                    <textarea value={idea.solution} onChange={e => setF('solution', e.target.value)} placeholder="How does your idea solve this uniquely?" rows={4} className={ta} />
                  </div>
                  <Input label="Target Users" value={idea.target} onChange={e => setF('target', e.target.value)} placeholder="Who are your primary users?" />
                </div>
              )}
              {step === 3 && (
                <div className="space-y-5">
                  <p className="font-mono text-xs text-[color:var(--primary)] uppercase tracking-widest">Step 03 — Market & Technology</p>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">Industry</label>
                    <div className="flex flex-wrap gap-2">
                      {INDUSTRIES.map(ind => (
                        <button key={ind} onClick={() => setF('industry', ind)}
                          className={cn('px-3 py-1.5 rounded-full text-sm font-medium border transition-all', idea.industry === ind ? 'bg-[color:var(--primary)]/15 text-[color:var(--primary)] border-[color:var(--primary)]/40' : 'border-[color:var(--border)] text-[color:var(--muted-foreground)] hover:border-[color:var(--primary)]/30')}>{ind}</button>
                      ))}
                    </div>
                  </div>
                  <Input label="Tech Stack (optional)" value={idea.techStack} onChange={e => setF('techStack', e.target.value)} placeholder="e.g., React, Node.js, PostgreSQL, OpenAI API" />
                  <Input label="Monetization Strategy (optional)" value={idea.monetization} onChange={e => setF('monetization', e.target.value)} placeholder="e.g., SaaS subscription $29/month" />
                </div>
              )}
              <div className="flex gap-3 mt-6">
                {step > 1 && <Button variant="outline" onClick={() => setStep(s => s - 1)} className="w-12 flex-shrink-0 px-0 justify-center"><ArrowLeft className="h-4 w-4" /></Button>}
                {step < 3
                  ? <Button className="flex-1" disabled={!canNext} onClick={() => setStep(s => s + 1)}>Next <ArrowRight className="h-4 w-4" /></Button>
                  : <Button className="flex-1" onClick={handleSubmit} loading={loading} disabled={balance < COST || loading}><Sparkles className="h-4 w-4" />{loading ? 'Evaluating…' : `Evaluate with AI (${COST} credits)`}</Button>
                }
              </div>
            </Card>
          </div>

          {/* Preview panel */}
          <div className="lg:col-span-1">
            <Card className="p-5 sticky top-20">
              <div className="flex items-center gap-2 mb-5">
                <Sparkles className="h-4 w-4 text-[color:var(--primary)]" />
                <span className="text-sm font-semibold">Live AI Preview</span>
              </div>
              <div className="space-y-4 mb-5">
                {[{ label:'Idea Clarity',key:'clarity',color:'from-violet-500 to-[color:var(--primary)]' },{ label:'Market Potential',key:'market',color:'from-[color:var(--secondary)] to-cyan-400' },{ label:'Feasibility',key:'feasibility',color:'from-teal-500 to-emerald-400' }].map(m => (
                  <div key={m.key}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-[color:var(--muted-foreground)]">{m.label}</span>
                      <span className="font-mono font-semibold">{Math.round((previewScore as any)[m.key])}%</span>
                    </div>
                    <div className="h-1.5 bg-[color:var(--muted)] rounded-full overflow-hidden">
                      <div className={`h-full bg-gradient-to-r ${m.color} transition-all duration-700 rounded-full`} style={{ width: `${(previewScore as any)[m.key]}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-3 rounded-xl bg-[color:var(--muted)]/40 border border-[color:var(--border)] mb-4">
                <p className="text-xs font-semibold mb-2">Tips for a higher score:</p>
                <ul className="text-xs text-[color:var(--muted-foreground)] space-y-1">
                  <li>• Be specific about who suffers from the problem</li>
                  <li>• Explain what makes your solution unique</li>
                  <li>• Quantify the market size if possible</li>
                  <li>• Add a clear monetization strategy</li>
                </ul>
              </div>
              <div className="p-3 rounded-xl bg-[color:var(--primary)]/5 border border-[color:var(--primary)]/15">
                <p className="text-xs text-[color:var(--muted-foreground)]">Cost: <span className="text-[color:var(--primary)] font-semibold">{COST} credits</span> · Balance: <span className="font-semibold">{balance}</span></p>
                {balance < COST && <a href="/wallet" className="mt-1.5 block text-xs text-[color:var(--primary)] hover:underline font-medium">Buy more credits →</a>}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
