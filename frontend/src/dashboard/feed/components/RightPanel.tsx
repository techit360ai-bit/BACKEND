import { ArrowUp } from 'lucide-react';

export function RightPanel() {
  return (
    <aside className="hidden xl:block w-[320px] h-[calc(100vh-56px)] sticky top-14 overflow-y-auto p-5">
      <div className="bg-bg-surface border border-border-default rounded-xl p-5">
        <h4 className="text-text-muted text-[11px] font-medium uppercase tracking-[1.5px] mb-4">
          YOUR MOMENTUM WALL
        </h4>
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-[15px] font-medium text-text-primary">MediConnect Africa</h3>
            <span className="text-[12px] px-2.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(79, 110, 247, 0.15)', color: 'var(--accent-primary)' }}>MVP</span>
          </div>
          <div className="text-center py-4">
            <p className="text-text-muted text-[11px] uppercase tracking-[1.5px] mb-2">GSIS</p>
            <div className="flex items-baseline justify-center gap-1">
              <span className="font-mono text-[32px] font-bold text-score-amber">68</span>
              <span className="text-text-muted text-lg">/100</span>
            </div>
            <p className="text-text-secondary text-xs mt-1">High Potential</p>
            <div className="relative w-32 h-16 mx-auto mt-4">
              <svg viewBox="0 0 120 60" className="w-full h-full">
                <path d="M 10 50 A 50 50 0 0 1 110 50" fill="none" stroke="var(--bg-elevated)" strokeWidth="8" strokeLinecap="round" />
                <path d="M 10 50 A 50 50 0 0 1 110 50" fill="none" stroke="var(--score-amber)" strokeWidth="8" strokeLinecap="round" strokeDasharray="157" strokeDashoffset={157 - (157 * 68) / 100} />
              </svg>
            </div>
          </div>
          <div className="flex items-center justify-between py-3 border-t border-border-default">
            <span className="text-text-secondary text-xs">Decay Factor</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-score-amber">0.91</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: 'var(--score-amber)' }}>−9%</span>
            </div>
          </div>
          <p className="text-text-muted text-[11px] mb-4">Last active 5 days ago</p>
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-text-secondary text-xs">Stage Progress</span>
              <span className="font-mono text-xs text-score-amber">42% to Beta</span>
            </div>
            <div className="relative h-1.5 bg-bg-elevated rounded-full overflow-hidden">
              <div className="h-full bg-accent-primary rounded-full" style={{ width: '42%' }}></div>
              <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-background rounded-full shadow-lg" style={{ left: '42%', transform: 'translate(-50%, -50%)' }}></div>
            </div>
          </div>
          <div className="mb-4">
            <h5 className="text-text-muted text-[11px] font-medium uppercase tracking-[1.5px] mb-2">30-DAY VELOCITY</h5>
            <div className="flex items-end justify-between gap-2 h-16">
              <div className="flex-1 flex flex-col justify-end"><div className="rounded-t bg-score-green" style={{ height: '48px' }}></div></div>
              <div className="flex-1 flex flex-col justify-end"><div className="rounded-t bg-score-amber" style={{ height: '12px' }}></div></div>
              <div className="flex-1 flex flex-col justify-end"><div className="rounded-t bg-score-red opacity-50" style={{ height: '8px' }}></div></div>
              <div className="flex-1 flex flex-col justify-end"><div className="rounded-t bg-score-green" style={{ height: '56px' }}></div></div>
            </div>
            <p className="text-text-secondary text-[11px] mt-2 flex items-center gap-1"><ArrowUp className="w-3 h-3 text-score-green" />Week 4 recovery +12 GSIS</p>
          </div>
          <div className="mb-4">
            <h5 className="text-text-muted text-[11px] font-medium uppercase tracking-[1.5px] mb-2">NEXT MILESTONE</h5>
            <div className="bg-bg-elevated rounded-lg p-3">
              <p className="text-text-primary text-xs font-medium mb-1">🎯 First paying customer</p>
              <p className="text-text-secondary text-[11px] mb-2">~14 days away</p>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-score-amber"></div>
                <p className="text-text-muted text-[10px]">Platform estimate based on velocity</p>
              </div>
            </div>
          </div>
          <button className="w-full h-10 border border-accent-primary rounded-lg text-accent-primary text-xs font-medium hover:bg-accent-glow transition-colors flex items-center justify-center gap-2">📤 Share My Build Log</button>
        </div>
      </div>
      <div className="bg-bg-surface border border-border-default rounded-xl p-5 mt-4">
        <h4 className="text-text-muted text-[11px] font-medium uppercase tracking-[1.5px] mb-3">TRENDING FOUNDERS</h4>
        <div className="space-y-3">
          <TrendingFounder name="David Osei" category="FinTech" stage="Beta" gsis={79} trending />
          <TrendingFounder name="Chioma Eze" category="AgriTech" stage="MVP" gsis={71} trending />
          <TrendingFounder name="Tunde Balogun" category="CleanTech" stage="Validation" gsis={65} />
        </div>
      </div>
      <div className="bg-bg-surface border border-border-default rounded-xl p-5 mt-4">
        <h4 className="text-text-muted text-[11px] font-medium uppercase tracking-[1.5px] mb-3">ACTIVE PROBLEMS</h4>
        <div className="space-y-3">
          <ActiveProblem title="Post-harvest cold storage" category="Agriculture · Africa" impact={78} priority="red" />
          <ActiveProblem title="Rural payment infrastructure" category="FinTech · W.Africa" impact={71} priority="amber" />
        </div>
      </div>
    </aside>
  );
}

function TrendingFounder({ name, category, stage, gsis, trending = false }: { name: string; category: string; stage: string; gsis: number; trending?: boolean }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-bg-elevated transition-colors">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-primary to-score-purple flex-shrink-0"></div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-text-primary truncate">{name}</p>
        <p className="text-[11px] text-text-secondary truncate">{category} · {stage}</p>
      </div>
      <div className="flex items-center gap-1">
        <span className="font-mono text-xs text-score-green">{gsis}</span>
        {trending && <ArrowUp className="w-3 h-3 text-score-green" />}
      </div>
    </div>
  );
}

function ActiveProblem({ title, category, impact, priority }: { title: string; category: string; impact: number; priority: 'red' | 'amber' }) {
  const color = priority === 'red' ? 'var(--score-red)' : 'var(--score-amber)';
  return (
    <div className="p-2 rounded-lg hover:bg-bg-elevated transition-colors cursor-pointer">
      <div className="flex items-start gap-2 mb-1">
        <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: color }}></div>
        <p className="text-xs font-medium text-text-primary leading-snug flex-1">{title}</p>
      </div>
      <p className="text-[11px] text-text-secondary ml-4">{category}</p>
      <p className="text-[11px] text-text-muted ml-4 mt-0.5">Impact: {impact}/100</p>
    </div>
  );
}