import { Link } from 'react-router-dom';
import { investorMetrics, mockStartups } from '../../data/mockData';
import { TrendingUp, Shield, DollarSign, Activity, Zap, ArrowRight, Sparkles, X } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useInvestorProfile } from '@/contexts/UserContext';
import { useState } from 'react';

export function Dashboard() {
  const { investorProfile } = useInvestorProfile();
  const onboardingIncomplete =
    investorProfile.industries.length === 0 || !investorProfile.stage;
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const highMomentumStartups = mockStartups
    .filter((s) => s.velocityDelta > 20)
    .slice(0, 5);

  const portfolioData = [
    { week: 'W1', readiness: 72, conversion: 12 },
    { week: 'W2', readiness: 74, conversion: 15 },
    { week: 'W3', readiness: 76, conversion: 18 },
    { week: 'W4', readiness: 79, conversion: 22 },
    { week: 'W5', readiness: 82, conversion: 26 },
    { week: 'W6', readiness: 84, conversion: 31 },
  ];

  const riskDistribution = {
    low: mockStartups.filter((s) => s.riskLevel === 'low').length,
    moderate: mockStartups.filter((s) => s.riskLevel === 'moderate').length,
    high: mockStartups.filter((s) => s.riskLevel === 'high').length,
  };

  const totalStartups = mockStartups.length;

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <div className="border-b border-border bg-[#111111] px-8 py-6">
        <h1 className="text-3xl font-bold text-white">Investor Dashboard</h1>
        <p className="text-muted-foreground/70 mt-1">Live startup execution intelligence</p>
      </div>

      <div className="p-8">
        {/* Onboarding banner — appears when profile is incomplete */}
        {onboardingIncomplete && !bannerDismissed && (
          <div className="mb-6 flex items-center gap-4 rounded-lg border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent px-5 py-4">
            <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">
                Complete your investor profile
              </p>
              <p className="text-xs text-muted-foreground/70 mt-0.5">
                Set your sectors, stage and check size so the dashboard prioritises
                the deals you actually want to see.
              </p>
            </div>
            <Link
              to="/investor/onboarding/step-1"
              className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold transition-colors flex-shrink-0"
            >
              Start onboarding
              <ArrowRight className="w-4 h-4" />
            </Link>
            <button
              onClick={() => setBannerDismissed(true)}
              className="p-1.5 rounded-md hover:bg-background/5 text-muted-foreground hover:text-muted-foreground/50 transition-colors flex-shrink-0"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Top Metrics Bar */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <MetricCard
            label="Watchlisted Startups"
            value={investorMetrics.watchlistedStartups}
            icon={Activity}
            color="text-blue-400"
            bgColor="bg-blue-500/10"
            borderColor="border-blue-500/20"
          />
          <MetricCard
            label="80+ Readiness"
            value={investorMetrics.highReadiness}
            icon={TrendingUp}
            color="text-emerald-400"
            bgColor="bg-emerald-500/10"
            borderColor="border-emerald-500/20"
          />
          <MetricCard
            label="75+ Execution Velocity"
            value={investorMetrics.highExecution}
            icon={Zap}
            color="text-purple-400"
            bgColor="bg-purple-500/10"
            borderColor="border-purple-500/20"
          />
          <MetricCard
            label="Revenue Validated"
            value={investorMetrics.revenueValidated}
            icon={DollarSign}
            color="text-amber-400"
            bgColor="bg-amber-500/10"
            borderColor="border-amber-500/20"
          />
          <MetricCard
            label="AI Governance Verified"
            value={investorMetrics.aiGovernanceVerified}
            icon={Shield}
            color="text-cyan-400"
            bgColor="bg-cyan-500/10"
            borderColor="border-cyan-500/20"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Center Panel - Execution Momentum */}
          <div className="lg:col-span-2 space-y-6">
            {/* Execution Momentum Graph */}
            <div className="bg-[#111111] border border-border rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Execution Momentum</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={portfolioData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="week" stroke="#666" />
                    <YAxis stroke="#666" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1a1a1a',
                        border: '1px solid #333',
                        borderRadius: '8px',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="readiness"
                      stroke="#10b981"
                      strokeWidth={2}
                      name="Avg Portfolio Readiness"
                    />
                    <Line
                      type="monotone"
                      dataKey="conversion"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      name="Beta-to-Revenue %"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="flex gap-6 mt-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-emerald-500 rounded"></div>
                  <span className="text-muted-foreground/70">Avg Portfolio Readiness</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded"></div>
                  <span className="text-muted-foreground/70">Beta-to-Revenue %</span>
                </div>
              </div>
            </div>

            {/* Risk Distribution */}
            <div className="bg-[#111111] border border-border rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Portfolio Risk Distribution</h3>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex gap-2 h-12 rounded-lg overflow-hidden">
                    <div
                      className="bg-emerald-500/80 flex items-center justify-center text-white font-mono text-sm font-medium"
                      style={{ width: `${(riskDistribution.low / totalStartups) * 100}%` }}
                    >
                      {Math.round((riskDistribution.low / totalStartups) * 100)}%
                    </div>
                    <div
                      className="bg-amber-500/80 flex items-center justify-center text-white font-mono text-sm font-medium"
                      style={{ width: `${(riskDistribution.moderate / totalStartups) * 100}%` }}
                    >
                      {Math.round((riskDistribution.moderate / totalStartups) * 100)}%
                    </div>
                    <div
                      className="bg-red-500/80 flex items-center justify-center text-white font-mono text-sm font-medium"
                      style={{ width: `${(riskDistribution.high / totalStartups) * 100}%` }}
                    >
                      {Math.round((riskDistribution.high / totalStartups) * 100)}%
                    </div>
                  </div>
                  <div className="flex gap-6 mt-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-emerald-500 rounded"></div>
                      <span className="text-muted-foreground/70">Low Risk ({riskDistribution.low})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-amber-500 rounded"></div>
                      <span className="text-muted-foreground/70">Moderate ({riskDistribution.moderate})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-500 rounded"></div>
                      <span className="text-muted-foreground/70">High ({riskDistribution.high})</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Insight Box */}
            <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-lg p-6">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Zap className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-blue-300 mb-2">AI INSIGHTS</h4>
                  <p className="text-white mb-2">
                    3 startups in your watchlist increased milestone velocity by 24% this week.
                  </p>
                  <p className="text-muted-foreground/50">
                    2 projects moved from 78 to 84 readiness. QuantumAPI and CloudMesh show strong
                    revenue acceleration patterns.
                  </p>
                  <button className="mt-3 text-blue-400 text-sm font-medium hover:text-blue-300 flex items-center gap-1">
                    View detailed analysis <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - High Momentum */}
          <div className="space-y-6">
            <div className="bg-[#111111] border border-border rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">High Momentum This Week</h3>
              <div className="space-y-3">
                {highMomentumStartups.map((startup) => (
                  <Link
                    key={startup.id}
                    to={`/investor/risk-radar/${startup.id}`}
                    className="block p-4 bg-card/50 hover:bg-card border border-border rounded-lg transition-all group"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-white group-hover:text-emerald-400 transition-colors">
                        {startup.name}
                      </h4>
                      <span className="text-xs px-2 py-1 bg-purple-500/20 text-purple-300 rounded font-mono">
                        {startup.sector}
                      </span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground/70">Velocity Spike</span>
                        <span className="text-emerald-400 font-mono font-medium">
                          +{startup.velocityDelta}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground/70">Risk Level</span>
                        <span
                          className={`font-medium capitalize ${
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
                      <div className="flex justify-between">
                        <span className="text-muted-foreground/70">Investors Watching</span>
                        <span className="text-blue-400 font-mono">{startup.investorsWatching}</span>
                      </div>
                    </div>
                    <button className="mt-3 w-full py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-sm font-medium rounded transition-all flex items-center justify-center gap-2">
                      Analyze <ArrowRight className="w-4 h-4" />
                    </button>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  borderColor: string;
}

function MetricCard({ label, value, icon: Icon, color, bgColor, borderColor }: MetricCardProps) {
  return (
    <div className={`${bgColor} border ${borderColor} rounded-lg p-4`}>
      <div className="flex items-start justify-between mb-2">
        <Icon className={`w-5 h-5 ${color}`} />
        <span className={`text-3xl font-bold font-mono ${color}`}>{value}</span>
      </div>
      <p className="text-sm text-muted-foreground/70">{label}</p>
    </div>
  );
}
