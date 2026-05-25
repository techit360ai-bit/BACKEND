import { ArrowUp, Eye, Share2 } from 'lucide-react';

export function BuildLogPage() {
  const timelineEntries = [
    {
      id: '1',
      type: 'joined',
      title: 'Joined TechIT',
      subtitle: 'Stage: Idea',
      date: 'Jan 15, 2026',
      gsisDelta: null,
      description: 'Started the incubation journey',
    },
    {
      id: '2',
      type: 'training',
      title: 'Completed Module: Market Validation',
      subtitle: null,
      date: 'Jan 22, 2026',
      gsisDelta: '+2',
      description: null,
    },
    {
      id: '3',
      type: 'milestone',
      title: 'Market Intel Complete',
      subtitle: '30 customer interviews across 3 cities',
      date: 'Feb 10, 2026',
      gsisDelta: '+5',
      description: 'Validated core problem: Rural clinics lack reliable patient data systems',
    },
    {
      id: '4',
      type: 'score',
      title: 'Unicorn Analysis complete',
      subtitle: 'UPS: 74%',
      date: 'Feb 15, 2026',
      gsisDelta: '+3',
      description: null,
    },
    {
      id: '5',
      type: 'inactive',
      title: '4-day inactive period',
      subtitle: 'Decay: 1.00 → 0.94',
      date: 'Mar 8, 2026',
      gsisDelta: '-6',
      description: '−6% score penalty applied automatically',
    },
    {
      id: '6',
      type: 'milestone',
      title: 'Validation Stage Reached',
      subtitle: 'Problem-solution fit confirmed',
      date: 'Mar 20, 2026',
      gsisDelta: '+4',
      description: '10 LOIs from clinic administrators',
    },
    {
      id: '7',
      type: 'training',
      title: 'Completed Module: MVP Building',
      subtitle: null,
      date: 'Apr 2, 2026',
      gsisDelta: '+2',
      description: null,
    },
    {
      id: '8',
      type: 'milestone',
      title: 'Shipped MVP — First 50 beta users onboarded',
      subtitle: '3 clinics using platform daily',
      date: 'Apr 12, 2026',
      gsisDelta: '+7',
      description: 'Patient record system live with real-time sync',
      metrics: {
        betaUsers: 50,
        mrr: 0,
        gsisDelta: 7,
        daysToNext: 14,
      },
    },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-20 lg:pb-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <h1 className="text-2xl font-semibold text-text-primary">MediConnect Africa</h1>
          <span
            className="text-xs px-2.5 py-1 rounded-full"
            style={{
              backgroundColor: 'rgba(79, 110, 247, 0.15)',
              color: 'var(--accent-primary)',
            }}
          >
            MVP Stage
          </span>
          <div
            className="px-2.5 py-1 rounded-md border text-xs font-mono"
            style={{
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              borderColor: 'var(--score-amber)',
              color: 'var(--score-amber)',
            }}
          >
            GSIS 68
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm text-text-secondary mb-3">
          <span>Public Build Log</span>
          <span>·</span>
          <div className="flex items-center gap-1.5">
            <Eye className="w-4 h-4" />
            <span>47 views this week</span>
          </div>
        </div>

        <div
          className="inline-block px-3 py-1.5 rounded-lg text-xs border"
          style={{
            backgroundColor: 'rgba(168, 85, 247, 0.15)',
            borderColor: 'var(--score-purple)',
            color: 'var(--score-purple)',
          }}
        >
          <Eye className="w-3 h-3 inline mr-1" />
          Investor viewed 3 times today
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical Line */}
        <div className="absolute left-[11px] top-0 bottom-0 w-0.5 bg-border-default"></div>

        {/* Timeline Entries */}
        <div className="space-y-6">
          {timelineEntries.map((entry, index) => (
            <TimelineEntry
              key={entry.id}
              entry={entry}
              isLast={index === timelineEntries.length - 1}
            />
          ))}
        </div>
      </div>

      {/* Share Button */}
      <div className="mt-8 flex justify-center">
        <button className="flex items-center gap-2 bg-accent-primary text-white px-6 py-3 rounded-lg hover:opacity-90 transition-opacity">
          <Share2 className="w-4 h-4" />
          Share My Build Log
        </button>
      </div>
    </div>
  );
}

function TimelineEntry({ entry }: { entry: any; isLast: boolean }) {
  const typeConfig = {
    joined: { color: 'var(--score-purple)', bg: 'rgba(168, 85, 247, 0.08)', dotSize: 16, hollow: false },
    milestone: { color: 'var(--score-green)', bg: 'rgba(34, 197, 94, 0.08)', dotSize: 12, hollow: false },
    training: { color: 'var(--score-blue)', bg: 'rgba(79, 110, 247, 0.05)', dotSize: 10, hollow: false },
    score: { color: 'var(--accent-primary)', bg: 'rgba(79, 110, 247, 0.05)', dotSize: 10, hollow: false },
    inactive: { color: 'var(--score-red)', bg: 'rgba(239, 68, 68, 0.05)', dotSize: 12, hollow: true },
  };

  const config = typeConfig[entry.type as keyof typeof typeConfig];

  return (
    <div className="flex gap-6 relative">
      {/* Date Label */}
      <div className="absolute -top-6 left-0 text-xs text-text-muted">{entry.date}</div>

      {/* Dot */}
      <div className="relative z-10 flex-shrink-0" style={{ marginTop: '4px' }}>
        <div
          className={config.hollow ? 'rounded-full bg-bg-base' : 'rounded-full'}
          style={{
            width: `${config.dotSize}px`,
            height: `${config.dotSize}px`,
            backgroundColor: config.hollow ? 'var(--bg-base)' : config.color,
            border: config.hollow ? `2px solid ${config.color}` : 'none',
            marginLeft: `${(16 - config.dotSize) / 2}px`,
          }}
        ></div>
      </div>

      {/* Content Card */}
      <div className="flex-1 pb-2">
        <div
          className="bg-bg-surface border border-border-default rounded-lg p-4"
          style={{ backgroundColor: entry.type === 'inactive' ? config.bg : 'var(--bg-surface)' }}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              {entry.type === 'milestone' && (
                <div
                  className="inline-block px-2 py-1 rounded text-[11px] font-medium uppercase mb-2"
                  style={{
                    backgroundColor: 'rgba(34, 197, 94, 0.10)',
                    color: 'var(--score-green)',
                  }}
                >
                  🏆 MILESTONE
                </div>
              )}
              <h3 className={`text-sm font-medium ${entry.type === 'inactive' ? 'text-text-muted italic' : 'text-text-primary'}`}>
                {entry.type === 'inactive' && '◐ '}
                {entry.title}
              </h3>
              {entry.subtitle && (
                <p className="text-xs text-text-secondary mt-1">{entry.subtitle}</p>
              )}
            </div>

            {entry.gsisDelta && (
              <div
                className="px-2 py-1 rounded text-xs font-mono font-medium ml-3"
                style={{
                  backgroundColor: entry.gsisDelta.startsWith('+')
                    ? 'rgba(34, 197, 94, 0.15)'
                    : 'rgba(239, 68, 68, 0.15)',
                  color: entry.gsisDelta.startsWith('+')
                    ? 'var(--score-green)'
                    : 'var(--score-red)',
                }}
              >
                {entry.gsisDelta.startsWith('+') ? (
                  <ArrowUp className="w-3 h-3 inline mr-0.5" />
                ) : null}
                {entry.gsisDelta}
              </div>
            )}
          </div>

          {/* Description */}
          {entry.description && (
            <p className="text-xs text-text-secondary leading-relaxed">{entry.description}</p>
          )}

          {/* Metrics Grid (for milestones) */}
          {entry.metrics && (
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="bg-bg-elevated rounded-lg p-3">
                <p className="text-text-muted text-[11px] mb-1">Beta Users</p>
                <p className="font-mono text-[16px] font-semibold text-text-primary">
                  {entry.metrics.betaUsers}
                </p>
              </div>
              <div className="bg-bg-elevated rounded-lg p-3">
                <p className="text-text-muted text-[11px] mb-1">MRR</p>
                <p className="font-mono text-[16px] font-semibold text-text-primary">
                  ${entry.metrics.mrr}
                </p>
              </div>
              <div className="bg-bg-elevated rounded-lg p-3">
                <p className="text-text-muted text-[11px] mb-1">GSIS Delta</p>
                <p className="font-mono text-[16px] font-semibold text-score-green">
                  +{entry.metrics.gsisDelta}
                </p>
              </div>
              <div className="bg-bg-elevated rounded-lg p-3">
                <p className="text-text-muted text-[11px] mb-1">Days to Next</p>
                <p className="font-mono text-[16px] font-semibold text-text-primary">
                  {entry.metrics.daysToNext}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
