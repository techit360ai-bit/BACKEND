import { Link } from 'react-router-dom';
import { Eye, MessageCircle, TrendingUp } from 'lucide-react';
import { LeftSidebar } from '../components/LeftSidebar';
import { RightPanel } from '../components/RightPanel';

export function ProblemsPage() {
  const problems = [
    {
      id: '1',
      title: 'Rural maternal mortality rate 3× urban average in West Africa',
      location: 'West Africa',
      category: 'Health',
      impactScore: 75,
      priority: 'HIGH',
      priorityColor: 'score-amber',
      views: 245,
      discussions: 23,
      solutions: 8,
      trending: true,
      aiDiscovered: true,
    },
    {
      id: '2',
      title: 'Post-harvest food losses exceed 40% in Sub-Saharan Africa',
      location: 'Sub-Saharan Africa',
      category: 'Agriculture',
      impactScore: 78,
      priority: 'CRITICAL',
      priorityColor: 'score-red',
      views: 389,
      discussions: 34,
      solutions: 12,
      trending: true,
      aiDiscovered: true,
    },
    {
      id: '3',
      title: 'Rural payment infrastructure gaps affecting 200M+ people',
      location: 'West Africa',
      category: 'FinTech',
      impactScore: 71,
      priority: 'HIGH',
      priorityColor: 'score-amber',
      views: 156,
      discussions: 18,
      solutions: 6,
      trending: false,
      aiDiscovered: true,
    },
    {
      id: '4',
      title: 'Off-grid communities lack reliable electricity access',
      location: 'East Africa',
      category: 'CleanTech',
      impactScore: 82,
      priority: 'CRITICAL',
      priorityColor: 'score-red',
      views: 412,
      discussions: 41,
      solutions: 15,
      trending: true,
      aiDiscovered: false,
    },
    {
      id: '5',
      title: 'Limited access to quality education in rural areas',
      location: 'Africa',
      category: 'Education',
      impactScore: 68,
      priority: 'MEDIUM',
      priorityColor: 'score-blue',
      views: 234,
      discussions: 27,
      solutions: 9,
      trending: false,
      aiDiscovered: true,
    },
  ];

  return (
    <div className="flex pb-14 lg:pb-0">
      {/* Left Sidebar */}
      <LeftSidebar />

      {/* Main Content */}
      <main className="flex-1 min-w-0 lg:max-w-[720px] lg:mx-auto w-full">
        {/* Header */}
        <div className="sticky top-14 bg-bg-surface border-b border-border-default px-6 py-4 z-40">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-semibold text-text-primary mb-1">Problem Signals</h1>
              <p className="text-sm text-text-secondary">
                {problems.length} high-impact problems discovered by AI and the community
              </p>
            </div>
            <button className="bg-accent-primary text-white text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 transition-opacity">
              Submit Problem
            </button>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-4 text-sm overflow-x-auto">
            <button className="text-accent-primary border-b-2 border-accent-primary pb-2 font-medium whitespace-nowrap">
              All Problems
            </button>
            <button className="text-text-secondary hover:text-text-primary pb-2 transition-colors whitespace-nowrap">
              Critical
            </button>
            <button className="text-text-secondary hover:text-text-primary pb-2 transition-colors whitespace-nowrap">
              AI Discovered
            </button>
            <button className="text-text-secondary hover:text-text-primary pb-2 transition-colors whitespace-nowrap">
              Trending
            </button>
            <button className="text-text-secondary hover:text-text-primary pb-2 transition-colors whitespace-nowrap">
              My Solutions
            </button>
          </div>
        </div>

        {/* Problems List */}
        <div className="px-4 py-4 space-y-3">
          {problems.map((problem) => (
            <ProblemCard key={problem.id} problem={problem} />
          ))}
        </div>
      </main>

      {/* Right Panel */}
      <RightPanel />
    </div>
  );
}

function ProblemCard({ problem }: { problem: any }) {
  return (
    <Link to={`/feed/problem/${problem.id}`}>
      <div className="bg-bg-surface border border-border-default rounded-xl p-4 border-l-[3px] border-l-score-red card-hover animate-slide-in">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {problem.aiDiscovered && (
              <div
                className="px-2 py-0.5 rounded text-[10px] font-medium uppercase"
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  color: 'var(--score-red)',
                }}
              >
                AI DISCOVERED
              </div>
            )}
            {problem.trending && (
              <div className="flex items-center gap-1 text-score-amber">
                <TrendingUp className="w-3 h-3" />
                <span className="text-[10px] font-medium">Trending</span>
              </div>
            )}
          </div>
        </div>

        {/* Problem Type */}
        <div
          className="inline-block px-2 py-1 rounded text-[11px] font-medium uppercase mb-2"
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.10)',
            color: 'var(--score-red)',
          }}
        >
          🌍 PROBLEM SIGNAL
        </div>

        {/* Title */}
        <h3 className="text-[15px] font-medium text-text-primary mb-3 hover:text-accent-primary transition-colors">
          {problem.title}
        </h3>

        {/* Location & Category */}
        <div className="flex items-center gap-3 text-xs text-text-secondary mb-3">
          <span>📍 {problem.location}</span>
          <span>·</span>
          <span>🏷️ {problem.category}</span>
        </div>

        {/* Impact Score */}
        <div className="bg-bg-elevated rounded-lg p-2.5 mb-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-text-secondary">Impact Score:</span>
            <span
              className="font-mono text-sm font-semibold"
              style={{
                color:
                  problem.impactScore > 75
                    ? 'var(--score-green)'
                    : problem.impactScore > 65
                    ? 'var(--score-amber)'
                    : 'var(--score-blue)',
              }}
            >
              {problem.impactScore}/100
            </span>
          </div>
          <div className="h-1 bg-bg-base rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${problem.impactScore}%`,
                backgroundColor:
                  problem.impactScore > 75
                    ? 'var(--score-green)'
                    : problem.impactScore > 65
                    ? 'var(--score-amber)'
                    : 'var(--score-blue)',
              }}
            ></div>
          </div>
        </div>

        {/* Priority Badge */}
        <div
          className="inline-block px-2 py-1 rounded text-[11px] font-medium mb-3"
          style={{
            backgroundColor: `var(--${problem.priorityColor})/15`,
            color: `var(--${problem.priorityColor})`,
          }}
        >
          🔴 {problem.priority} PRIORITY
        </div>

        {/* Stats & Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-border-default">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-text-secondary">
              <Eye className="w-4 h-4" />
              <span className="text-xs font-medium">{problem.views}</span>
            </div>
            <div className="flex items-center gap-1.5 text-text-secondary">
              <MessageCircle className="w-4 h-4" />
              <span className="text-xs font-medium">{problem.discussions}</span>
            </div>
            <div className="flex items-center gap-1.5 text-text-secondary">
              <span className="text-xs font-medium">{problem.solutions} solutions</span>
            </div>
          </div>
          <button
            className="text-accent-primary text-xs hover:underline font-medium"
            onClick={(e) => {
              e.preventDefault();
            }}
          >
            Explore Solutions →
          </button>
        </div>
      </div>
    </Link>
  );
}
