import { Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

export function LeftSidebar() {
  return (
    <aside className="hidden lg:block w-[260px] bg-bg-surface border-r border-border-default h-[calc(100vh-56px)] sticky top-14 overflow-y-auto p-5">
      {/* My Startup Section */}
      <div>
        <h4 className="text-text-muted text-[11px] font-medium uppercase tracking-[1.5px] mb-3">
          MY STARTUP
        </h4>
        <Link to="/feed/my-log">
          <h3 className="text-text-primary text-[15px] font-medium mb-2 hover:text-accent-primary transition-colors">
            MediConnect Africa
          </h3>
        </Link>
        <div className="inline-block bg-bg-elevated text-accent-primary text-[11px] font-medium px-2.5 py-1 rounded-full mb-3">
          MVP
        </div>

        {/* GSIS and Decay */}
        <div className="space-y-2 mb-3">
          <div className="flex items-center justify-between">
            <span className="text-text-muted text-xs">GSIS</span>
            <span className="font-mono text-[18px] font-semibold text-score-amber">68</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-muted text-xs">Decay</span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs text-score-amber">0.91</span>
              <div className="w-2 h-2 rounded-full bg-score-amber animate-pulse-amber"></div>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-1">
            <span className="text-text-muted text-[11px]">Progress</span>
            <span className="text-text-muted text-[11px]">42% to Beta</span>
          </div>
          <div className="h-1 bg-bg-elevated rounded-full overflow-hidden">
            <div className="h-full bg-accent-primary rounded-full" style={{ width: '42%' }}></div>
          </div>
        </div>
      </div>

      {/* Hangout Menu */}
      <div className="mb-6">
        <h4 className="text-text-muted text-[11px] font-medium uppercase tracking-[1.5px] mb-2">
          HANGOUT
        </h4>
        <div className="space-y-1">
          <MenuItem to="/feed" icon="🌍" label="Global Pulse" unread={12} />
          <MenuItem to="/feed/tribe" icon="👥" label="Your Tribe" unread={3} />
          <MenuItem to="/feed/build-log" icon="📋" label="Build Logs" />
          <MenuItem to="/feed/questions" icon="❓" label="Questions" unread={5} />
          <MenuItem to="/feed/problems" icon="🔴" label="Problem Signals" unread={2} />
        </div>
      </div>

      {/* Active Now */}
      <div className="mb-6">
        <h4 className="text-text-muted text-[11px] font-medium uppercase tracking-[1.5px] mb-2">
          ACTIVE NOW
        </h4>
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="w-6 h-6 rounded-full bg-gradient-to-br from-accent-primary to-score-purple border-2 border-bg-surface relative"
              >
                <div className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 bg-score-green rounded-full border border-bg-surface"></div>
              </div>
            ))}
          </div>
          <span className="text-text-secondary text-xs">+18 online</span>
        </div>
      </div>

      {/* My Progress Shortcuts */}
      <div>
        <h4 className="text-text-muted text-[11px] font-medium uppercase tracking-[1.5px] mb-2">
          SHORTCUTS
        </h4>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-score-amber" />
            <span className="text-text-primary text-xs flex-1 truncate">First paying customer</span>
            <span className="font-mono text-[11px] text-score-amber">~14d</span>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-text-secondary text-xs">Community Score</span>
              <span className="font-mono text-xs text-score-amber">45/100</span>
            </div>
            <div className="h-0.5 bg-bg-elevated rounded-full overflow-hidden">
              <div className="h-full bg-score-amber rounded-full" style={{ width: '45%' }}></div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function MenuItem({
  to,
  icon,
  label,
  unread,
}: {
  to: string;
  icon: string;
  label: string;
  unread?: number;
}) {
  return (
    <Link to={to}>
      <button className="w-full h-10 flex items-center gap-3 px-3 rounded-lg transition-colors hover:bg-bg-elevated border-l-2 border-transparent hover:border-accent-primary">
        <span className="text-sm">{icon}</span>
        <span className="text-sm flex-1 text-left">{label}</span>
        {unread && (
          <span className="text-[11px] font-medium text-accent-primary bg-accent-glow px-1.5 py-0.5 rounded">
            {unread}
          </span>
        )}
      </button>
    </Link>
  );
}
