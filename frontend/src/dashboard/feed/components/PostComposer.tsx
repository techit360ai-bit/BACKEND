import { ChevronDown } from 'lucide-react';

export function PostComposer({ expanded, setExpanded, selectedType, setSelectedType }: { expanded: boolean; setExpanded: (v: boolean) => void; selectedType: string; setSelectedType: (v: string) => void }) {
  const postTypes = [
    { id: 'milestone', label: '🏆 Milestone Hit', color: 'score-green' },
    { id: 'insight', label: '💡 Insight', color: 'accent-primary' },
    { id: 'build', label: '📊 Build Update', color: 'score-amber' },
    { id: 'question', label: '❓ Question', color: 'post-question' },
    { id: 'collab', label: '🤝 Collab Call', color: 'score-purple' },
    { id: 'problem', label: '🌍 Problem Signal', color: 'score-red' },
  ];

  return (
    <div className="bg-bg-surface border border-border-default rounded-xl p-4 mb-4">
      {expanded && (
        <div className="mb-3 flex gap-2 overflow-x-auto pb-2">
          {postTypes.map((type) => (
            <button key={type.id} onClick={() => setSelectedType(type.id)} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${selectedType === type.id ? `bg-${type.color}/10 border-${type.color} text-${type.color}` : 'bg-transparent border-border-default text-text-secondary hover:border-border-active'}`} style={selectedType === type.id ? { backgroundColor: `var(--${type.color})15`, borderColor: `var(--${type.color})`, color: `var(--${type.color})` } : undefined}>
              {type.label}
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent-primary to-score-purple flex-shrink-0"></div>
        <div className="flex-1">
          {expanded ? (
            <textarea className="w-full min-h-[120px] bg-bg-elevated rounded-lg px-4 py-3 text-sm text-text-primary placeholder-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-accent-primary" placeholder="What did you build, ship, or learn today?" autoFocus />
          ) : (
            <button onClick={() => setExpanded(true)} className="w-full h-11 bg-bg-elevated rounded-lg px-4 text-left text-sm text-text-muted hover:bg-bg-overlay transition-colors">What did you build, ship, or learn today?</button>
          )}
        </div>
        {!expanded && (
          <button className="flex items-center gap-1.5 bg-bg-elevated rounded-lg px-3 py-2 text-xs text-text-secondary hover:bg-bg-overlay transition-colors">📌 Milestone<ChevronDown className="w-3 h-3" /></button>
        )}
      </div>
      {expanded && (
        <>
          <div className="mt-3 text-xs text-text-muted">Sharing as: <span className="inline-block bg-bg-elevated text-accent-primary px-2 py-0.5 rounded-full ml-1">MVP</span></div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="text-xs bg-bg-elevated border border-border-default text-text-secondary px-2 py-1 rounded">#healthtech</span>
            <span className="text-xs bg-bg-elevated border border-border-default text-text-secondary px-2 py-1 rounded">#mvp</span>
            <span className="text-xs bg-bg-elevated border border-border-default text-text-secondary px-2 py-1 rounded">#saas</span>
            <button className="text-xs bg-transparent border border-dashed border-border-default text-text-muted px-2 py-1 rounded hover:border-accent-primary hover:text-accent-primary transition-colors">+ Add tag</button>
          </div>
          <div className="mt-4 bg-bg-elevated rounded-lg p-3">
            <div className="flex items-center justify-between mb-1"><span className="text-text-muted text-xs">Post quality</span><span className="font-mono text-xs text-score-amber">72/100</span></div>
            <div className="h-1 bg-bg-base rounded-full overflow-hidden"><div className="h-full bg-score-amber rounded-full" style={{ width: '72%' }}></div></div>
            <p className="text-text-muted text-[11px] italic mt-2">Add specific metrics to increase reach to ~180 founders</p>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <div className="flex gap-3">
              <button className="text-text-muted hover:text-text-primary transition-colors"><span className="text-lg">📎</span></button>
              <button className="text-text-muted hover:text-text-primary transition-colors"><span className="text-lg">📷</span></button>
            </div>
            <div className="flex items-end gap-3">
              <div className="text-right">
                <button onClick={() => setExpanded(false)} className="text-text-secondary hover:text-text-primary text-sm mr-3 transition-colors">Cancel</button>
                <button className="bg-accent-primary text-text-primary text-sm font-medium px-5 py-2 rounded-lg hover:opacity-90 transition-opacity">Post to Tribe</button>
                <p className="text-text-muted text-[11px] mt-1">Estimated reach: ~140 founders in healthtech/MVP stage</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
