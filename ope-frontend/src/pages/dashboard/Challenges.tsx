import { useState } from 'react'
import DashboardLayout from '../../components/shared/DashboardLayout'
import { Card, Button } from '../../components/ui'
import { Trophy, Plus } from 'lucide-react'

interface Challenge {
  id: string; title: string; desc: string; prize: string; deadline: string; created_at: string
}

const inputCls = 'w-full h-10 rounded-xl border border-[color:var(--border)] bg-[color:var(--input)] px-3 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)] transition-all'

export default function Challenges() {
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [showForm, setShowForm]     = useState(false)
  const [form, setForm]             = useState({ title: '', desc: '', prize: '', deadline: '' })

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  const save = () => {
    if (!form.title.trim()) return
    setChallenges(prev => [{ id: Date.now().toString(), ...form, created_at: new Date().toISOString() }, ...prev])
    setForm({ title: '', desc: '', prize: '', deadline: '' })
    setShowForm(false)
  }

  return (
    <DashboardLayout title="Innovation Challenges">
      <div className="max-w-4xl mx-auto space-y-6 page-enter">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-xl">Your Challenges</h2>
            <p className="text-sm text-[color:var(--muted-foreground)]">Post challenges for the builder community.</p>
          </div>
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Post Challenge
          </Button>
        </div>

        {showForm && (
          <Card className="p-5 space-y-4 border border-[color:var(--primary)]/30">
            <h3 className="font-bold">New Challenge</h3>
            <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Challenge Title *" className={inputCls} />
            <textarea value={form.desc} onChange={e => set('desc', e.target.value)} placeholder="Description..." rows={3}
              className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--input)] px-3 py-2 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)] resize-none" />
            <div className="grid grid-cols-2 gap-4">
              <input value={form.prize} onChange={e => set('prize', e.target.value)} placeholder="Prize / Compensation" className={inputCls} />
              <input type="date" value={form.deadline} onChange={e => set('deadline', e.target.value)} className={inputCls} />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={save} disabled={!form.title.trim()}>Post Challenge</Button>
            </div>
          </Card>
        )}

        {challenges.length === 0 && !showForm ? (
          <Card className="p-12 text-center">
            <div className="h-14 w-14 rounded-2xl bg-[color:var(--muted)] flex items-center justify-center mx-auto mb-4">
              <Trophy className="h-7 w-7 text-[color:var(--muted-foreground)]/40" />
            </div>
            <h3 className="font-bold text-lg mb-2">No challenges yet</h3>
            <p className="text-sm text-[color:var(--muted-foreground)] mb-4">
              Post your first challenge and let the TechIT community solve it.
            </p>
            <Button onClick={() => setShowForm(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Post First Challenge
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {challenges.map(c => (
              <Card key={c.id} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold mb-1">{c.title}</h3>
                    {c.desc && <p className="text-sm text-[color:var(--muted-foreground)] mb-2 leading-relaxed">{c.desc}</p>}
                    <div className="flex flex-wrap gap-4 text-xs text-[color:var(--muted-foreground)]">
                      {c.prize    && <span>💰 {c.prize}</span>}
                      {c.deadline && <span>📅 Due {c.deadline}</span>}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
