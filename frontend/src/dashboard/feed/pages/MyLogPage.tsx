import { ArrowUp } from 'lucide-react';
import { Link } from 'react-router-dom';

export function MyLogPage() {
  return (
    <div className="max-w-md mx-auto px-4 py-6 pb-20">
      {/* GSIS Large Display */}
      <div className="text-center mb-8">
        <h4 className="text-text-muted text-[11px] font-medium uppercase tracking-[1.5px] mb-4">
          YOUR MOMENTUM
        </h4>
        <div className="flex items-center justify-center gap-2 mb-4">
          <h3 className="text-lg font-medium text-text-primary">MediConnect Africa</h3>
          <span
            className="text-xs px-2.5 py-0.5 rounded-full"
            style={{
              backgroundColor: 'rgba(79, 110, 247, 0.15)',
              color: 'var(--accent-primary)',
            }}
          >
            MVP
          </span>
        </div>

        {/* GSIS Circle */}
        <div className="relative w-40 h-40 mx-auto mb-6">
          <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
            <circle
              cx="80"
              cy="80"
              r="70"
              fill="none"
              stroke="var(--bg-elevated)"
              strokeWidth="12"
            />
            <circle
              cx="80"
              cy="80"
              r="70"
              fill="none"
              stroke="var(--score-amber)"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 70}
              strokeDashoffset={2 * Math.PI * 70 * (1 - 0.68)}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-5xl font-bold text-score-amber">68</span>
            <span className="text-text-muted text-sm">/100 GSIS</span>
          </div>
        </div>

        <p className="text-text-secondary text-sm">High Potential</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-bg-surface border border-border-default rounded-xl p-4">
          <p className="text-text-muted text-xs mb-1">Decay Factor</p>
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-2xl font-semibold text-score-amber">0.91</span>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-medium"
              style={{
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                color: 'var(--score-amber)',
              }}
            >
              −9%
            </span>
          </div>
          <p className="text-text-muted text-[11px] mt-1">Last active 5d ago</p>
        </div>

        <div className="bg-bg-surface border border-border-default rounded-xl p-4">
          <p className="text-text-muted text-xs mb-1">Stage Progress</p>
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-2xl font-semibold text-accent-primary">42</span>
            <span className="text-text-muted text-sm">%</span>
          </div>
          <p className="text-text-muted text-[11px] mt-1">to Beta stage</p>
        </div>
      </div>

      {/* Velocity Chart */}
      <div className="bg-bg-surface border border-border-default rounded-xl p-4 mb-6">
        <h5 className="text-text-muted text-[11px] font-medium uppercase tracking-[1.5px] mb-3">
          30-DAY VELOCITY
        </h5>
        <div className="flex items-end justify-between gap-2 h-24 mb-2">
          <div className="flex-1 flex flex-col justify-end items-center gap-1">
            <div className="w-full rounded-t bg-score-green" style={{ height: '60px' }}></div>
            <span className="text-[10px] text-text-muted">W1</span>
          </div>
          <div className="flex-1 flex flex-col justify-end items-center gap-1">
            <div className="w-full rounded-t bg-score-amber" style={{ height: '15px' }}></div>
            <span className="text-[10px] text-text-muted">W2</span>
          </div>
          <div className="flex-1 flex flex-col justify-end items-center gap-1">
            <div className="w-full rounded-t bg-score-red opacity-50" style={{ height: '10px' }}></div>
            <span className="text-[10px] text-text-muted">W3</span>
          </div>
          <div className="flex-1 flex flex-col justify-end items-center gap-1">
            <div className="w-full rounded-t bg-score-green" style={{ height: '70px' }}></div>
            <span className="text-[10px] text-text-muted">W4</span>
          </div>
        </div>
        <p className="text-text-secondary text-xs flex items-center gap-1">
          <ArrowUp className="w-3 h-3 text-score-green" />
          Week 4 recovery +12 GSIS
        </p>
      </div>

      {/* Next Milestone */}
      <div className="bg-bg-surface border border-border-default rounded-xl p-4 mb-6">
        <h5 className="text-text-muted text-[11px] font-medium uppercase tracking-[1.5px] mb-3">
          NEXT MILESTONE
        </h5>
        <div className="bg-bg-elevated rounded-lg p-3">
          <p className="text-text-primary text-sm font-medium mb-1">🎯 First paying customer</p>
          <p className="text-text-secondary text-xs mb-2">~14 days away</p>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-score-amber"></div>
            <p className="text-text-muted text-[10px]">Platform estimate based on velocity</p>
          </div>
        </div>
      </div>

      {/* Build Log Timeline Preview */}
      <div className="bg-bg-surface border border-border-default rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h5 className="text-text-muted text-[11px] font-medium uppercase tracking-[1.5px]">
            RECENT ACTIVITY
          </h5>
          <Link to="/feed/build-log" className="text-accent-primary text-xs hover:underline">
            View Full Log →
          </Link>
        </div>
        <div className="space-y-4">
          <TimelineEntry type="milestone" title="Shipped MVP" date="Apr 12" gsisDelta="+7" />
          <TimelineEntry
            type="validation"
            title="30 customer interviews"
            date="Apr 8"
            gsisDelta="+3"
          />
          <TimelineEntry
            type="inactive"
            title="4-day inactive period"
            date="Apr 4"
            gsisDelta="-6"
          />
        </div>
      </div>

      {/* Share Button */}
      <button className="w-full h-12 border border-accent-primary rounded-lg text-accent-primary text-sm font-medium hover:bg-accent-glow transition-colors flex items-center justify-center gap-2">
        📤 Share My Build Log
      </button>
    </div>
  );
}

function TimelineEntry({
  type,
  title,
  date,
  gsisDelta,
}: {
  type: 'milestone' | 'validation' | 'inactive';
  title: string;
  date: string;
  gsisDelta: string;
}) {
  const colors = {
    milestone: 'var(--score-green)',
    validation: 'var(--accent-primary)',
    inactive: 'var(--score-red)',
  };

  const bgColors = {
    milestone: 'rgba(34, 197, 94, 0.1)',
    validation: 'rgba(79, 110, 247, 0.1)',
    inactive: 'rgba(239, 68, 68, 0.05)',
  };

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div
          className="w-3 h-3 rounded-full"
          style={{
            backgroundColor: type === 'inactive' ? 'transparent' : colors[type],
            border: type === 'inactive' ? `2px solid ${colors[type]}` : 'none',
          }}
        ></div>
        <div className="w-px h-full bg-border-default mt-1"></div>
      </div>
      <div className="flex-1 pb-1 px-3 py-2 rounded-lg" style={{ backgroundColor: bgColors[type] }}>
        <div className="flex items-start justify-between mb-1">
          <p className="text-xs text-text-primary font-medium">{title}</p>
          <span
            className="font-mono text-[10px] px-1.5 py-0.5 rounded"
            style={{
              backgroundColor:
                gsisDelta.startsWith('+') ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: gsisDelta.startsWith('+') ? 'var(--score-green)' : 'var(--score-red)',
            }}
          >
            {gsisDelta}
          </span>
        </div>
        <p className="text-[11px] text-text-muted">{date}</p>
      </div>
    </div>
  );
}
