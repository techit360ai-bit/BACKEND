import { useState } from 'react';
import { Link } from 'react-router-dom';
import { mockStartups } from '../../data/mockData';
import {
  Eye,
  TrendingUp,
  TrendingDown,
  Bell,
  BellOff,
  Trash2,
  ChevronDown,
  ChevronRight,
  Target,
  Briefcase,
  BarChart2,
  ArrowRight,
} from 'lucide-react';

export function Watchlist() {
  const watchedStartups = mockStartups.slice(0, 4);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [alertStates, setAlertStates] = useState<Record<string, boolean>>({
    velocity: true,
    risk: true,
    milestone: false,
  });

  const toggleExpanded = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const toggleAlert = (key: string) => {
    setAlertStates((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <div className="border-b border-border bg-[#111111] px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Watchlist & Signals</h1>
            <p className="text-muted-foreground/70 mt-1">Track execution velocity and get real-time alerts</p>
          </div>
          <button className="px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 font-medium rounded-lg transition-all flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Manage Alerts
          </button>
        </div>
      </div>

      <div className="p-8">
        <div className="bg-[#111111] border border-border rounded-lg overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-card/50 border-b border-border text-sm font-medium text-muted-foreground/70">
            <div className="col-span-3">Startup</div>
            <div className="col-span-1 text-center">Readiness</div>
            <div className="col-span-1 text-center">7d Δ</div>
            <div className="col-span-1 text-center">Risk</div>
            <div className="col-span-1 text-center">Risk Δ</div>
            <div className="col-span-2 text-center">Revenue</div>
            <div className="col-span-1 text-center">Rev Δ</div>
            <div className="col-span-1 text-center">Peers</div>
            <div className="col-span-1 text-right">Actions</div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-border">
            {watchedStartups.map((startup) => {
              const readinessDelta =
                startup.velocityDelta > 20
                  ? Math.floor(startup.velocityDelta / 4)
                  : -Math.floor(Math.random() * 3 + 1);
              const riskDelta = startup.riskLevel === 'low' ? 'improved' : 'stable';
              const isExpanded = expandedId === startup.id;

              return (
                <div key={startup.id}>
                  {/* Main row */}
                  <div
                    className={`grid grid-cols-12 gap-4 px-6 py-4 hover:bg-card/30 transition-colors cursor-pointer ${
                      isExpanded ? 'bg-card/20' : ''
                    }`}
                    onClick={() => toggleExpanded(startup.id)}
                  >
                    <div className="col-span-3 flex items-center gap-2">
                      <span className="text-muted-foreground hover:text-muted-foreground/50 transition-colors">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </span>
                      <div>
                        <Link
                          to={`/investor/risk-radar/${startup.id}`}
                          className="font-semibold text-white hover:text-emerald-400 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {startup.name}
                        </Link>
                        <p className="text-sm text-muted-foreground/70 mt-0.5">
                          {startup.sector} · {startup.region}
                        </p>
                      </div>
                    </div>

                    <div className="col-span-1 text-center flex items-center justify-center">
                      <p className="font-mono font-semibold text-white">{startup.readinessScore}</p>
                    </div>

                    <div className="col-span-1 text-center flex items-center justify-center">
                      <div
                        className={`inline-flex items-center gap-1 text-sm font-medium ${
                          readinessDelta > 0
                            ? 'text-emerald-400'
                            : readinessDelta < 0
                            ? 'text-red-400'
                            : 'text-muted-foreground/70'
                        }`}
                      >
                        {readinessDelta > 0 ? (
                          <TrendingUp className="w-4 h-4" />
                        ) : readinessDelta < 0 ? (
                          <TrendingDown className="w-4 h-4" />
                        ) : null}
                        {readinessDelta > 0 ? '+' : ''}
                        {readinessDelta}
                      </div>
                    </div>

                    <div className="col-span-1 text-center flex items-center justify-center">
                      <span
                        className={`text-sm font-medium capitalize ${
                          startup.riskLevel === 'low'
                            ? 'text-emerald-400'
                            : startup.riskLevel === 'moderate'
                            ? 'text-amber-400'
                            : 'text-red-400'
                        }`}
                      >
                        {startup.riskLevel}
                      </span>
                    </div>

                    <div className="col-span-1 text-center flex items-center justify-center">
                      <span
                        className={`text-sm font-medium ${
                          riskDelta === 'improved' ? 'text-emerald-400' : 'text-muted-foreground/70'
                        }`}
                      >
                        {riskDelta}
                      </span>
                    </div>

                    <div className="col-span-2 text-center flex items-center justify-center">
                      <p className="font-mono font-semibold text-white">
                        ${(startup.mrr / 1000).toFixed(0)}K MRR
                      </p>
                    </div>

                    <div className="col-span-1 text-center flex items-center justify-center">
                      <div className="inline-flex items-center gap-1 text-sm font-medium text-emerald-400">
                        <TrendingUp className="w-4 h-4" />
                        +{startup.revenueDelta}%
                      </div>
                    </div>

                    <div className="col-span-1 text-center flex items-center justify-center">
                      <p className="font-mono text-blue-400">{startup.investorsWatching}</p>
                    </div>

                    <div className="col-span-1 flex justify-end items-center gap-2">
                      <button
                        className="p-1.5 text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Bell className="w-4 h-4" />
                      </button>
                      <button
                        className="p-1.5 text-red-400 hover:bg-red-500/10 rounded transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* About section - expanded */}
                  {isExpanded && (
                    <div className="px-6 pb-6 pt-2 bg-[#0d0d0d] border-t border-border/60">
                      <div className="ml-6">
                        <div className="flex items-center gap-2 mb-4">
                          <span className="text-xs font-mono font-semibold tracking-widest text-emerald-400 uppercase">
                            Project Overview
                          </span>
                          <div className="flex-1 h-px bg-emerald-500/20"></div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                          {/* What's being built */}
                          <div className="bg-[#111111] border border-border rounded-lg p-5">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="p-1.5 bg-blue-500/15 rounded">
                                <Briefcase className="w-4 h-4 text-blue-400" />
                              </div>
                              <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
                                What's Being Built
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground/50 leading-relaxed">
                              {startup.about.summary}
                            </p>
                          </div>

                          {/* Use Case */}
                          <div className="bg-[#111111] border border-border rounded-lg p-5">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="p-1.5 bg-purple-500/15 rounded">
                                <Target className="w-4 h-4 text-purple-400" />
                              </div>
                              <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">
                                Primary Use Case
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground/50 leading-relaxed">
                              {startup.about.useCase}
                            </p>
                          </div>

                          {/* Market Size */}
                          <div className="bg-[#111111] border border-border rounded-lg p-5">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="p-1.5 bg-emerald-500/15 rounded">
                                <BarChart2 className="w-4 h-4 text-emerald-400" />
                              </div>
                              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                                Market Opportunity
                              </span>
                            </div>
                            <div className="mb-2">
                              <span className="text-2xl font-bold font-mono text-emerald-400">
                                {startup.about.marketSizeValue}
                              </span>
                              <span className="text-xs text-muted-foreground ml-1">TAM</span>
                            </div>
                            <p className="text-sm text-muted-foreground/50 leading-relaxed">
                              {startup.about.marketSize}
                            </p>
                          </div>
                        </div>

                        {/* Quick actions */}
                        <div className="flex gap-3 mt-4">
                          <Link
                            to={`/investor/risk-radar/${startup.id}`}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-sm font-medium rounded-lg transition-all"
                          >
                            Full Risk Analysis
                            <ArrowRight className="w-4 h-4" />
                          </Link>
                          <Link
                            to={`/investor/data-room/${startup.id}`}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-sm font-medium rounded-lg transition-all"
                          >
                            Data Room
                            <ArrowRight className="w-4 h-4" />
                          </Link>
                          <Link
                            to={`/investor/deal-room/${startup.id}`}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-sm font-medium rounded-lg transition-all"
                          >
                            Deal Room
                            <ArrowRight className="w-4 h-4" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Alert Settings */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <AlertCard
            title="Velocity Spike Alert"
            description="Get notified when execution velocity increases >20%"
            enabled={alertStates.velocity}
            onToggle={() => toggleAlert('velocity')}
          />
          <AlertCard
            title="Risk Shift Alert"
            description="Alert when risk level changes significantly"
            enabled={alertStates.risk}
            onToggle={() => toggleAlert('risk')}
          />
          <AlertCard
            title="Milestone Alert"
            description="Notification for major milestone completions"
            enabled={alertStates.milestone}
            onToggle={() => toggleAlert('milestone')}
          />
        </div>

        {/* Founder Notification Loop */}
        <div className="mt-6 bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Eye className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-blue-300 mb-2">WATCHLIST LOOP ACTIVE</h4>
              <p className="text-white">
                Founders see: &ldquo;{watchedStartups.length} verified investors are watching your project.&rdquo;
              </p>
              <p className="text-muted-foreground/50 text-sm mt-2">
                This creates psychological momentum and signals market validation, encouraging faster
                execution.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface AlertCardProps {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}

function AlertCard({ title, description, enabled, onToggle }: AlertCardProps) {
  return (
    <div className="bg-[#111111] border border-border rounded-lg p-5">
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-semibold text-white">{title}</h3>
        <div className={`p-1.5 rounded-lg ${enabled ? 'bg-emerald-500/20' : 'bg-card'}`}>
          {enabled ? (
            <Bell className="w-4 h-4 text-emerald-400" />
          ) : (
            <BellOff className="w-4 h-4 text-muted-foreground/70" />
          )}
        </div>
      </div>
      <p className="text-sm text-muted-foreground/70 mb-4">{description}</p>
      <button
        onClick={onToggle}
        className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
          enabled
            ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
            : 'bg-card text-muted-foreground/70 hover:bg-card'
        }`}
      >
        {enabled ? 'Enabled — Click to Disable' : 'Disabled — Click to Enable'}
      </button>
    </div>
  );
}
