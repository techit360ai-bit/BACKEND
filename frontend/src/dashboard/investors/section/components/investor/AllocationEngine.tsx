import { useState } from 'react';
import { mockStartups } from '../../data/mockData';
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { DollarSign, TrendingUp, AlertCircle, ChartBar } from 'lucide-react';

export function AllocationEngine() {
  const [totalCapital, setTotalCapital] = useState(1000000);
  const [minReadiness, setMinReadiness] = useState(80);
  const [maxRisk, setMaxRisk] = useState('moderate');
  const [region, setRegion] = useState('all');

  const eligibleStartups = mockStartups.filter((s) => {
    if (s.readinessScore < minReadiness) return false;
    if (maxRisk === 'low' && s.riskLevel !== 'low') return false;
    if (region !== 'all' && s.region !== region) return false;
    return true;
  });

  const allocationPerStartup = eligibleStartups.length > 0 ? totalCapital / eligibleStartups.length : 0;

  // Simulate IRR projections
  const expectedIRR = {
    min: 18 + (minReadiness - 80) * 0.5,
    max: 45 + (minReadiness - 80) * 0.8,
  };

  const survivalLikelihood = Math.min(95, 60 + minReadiness * 0.4);
  const exitProbability = {
    min: 15 + (minReadiness - 80) * 0.3,
    max: 35 + (minReadiness - 80) * 0.5,
  };

  // Projection data
  const projectionData = [
    { year: 'Y1', portfolio: 1.0, best: 1.2, worst: 0.85 },
    { year: 'Y2', portfolio: 1.4, best: 2.1, worst: 0.9 },
    { year: 'Y3', portfolio: 2.2, best: 3.8, worst: 1.1 },
    { year: 'Y4', portfolio: 3.5, best: 6.2, worst: 1.4 },
    { year: 'Y5', portfolio: 5.8, best: 10.5, worst: 1.8 },
  ];

  const sectorDistribution = eligibleStartups.reduce((acc, startup) => {
    acc[startup.sector] = (acc[startup.sector] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const sectorData = Object.entries(sectorDistribution).map(([name, value]) => ({
    name,
    value,
    allocation: (value / eligibleStartups.length) * totalCapital,
  }));

  const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4'];

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <div className="border-b border-border bg-[#111111] px-8 py-6">
        <h1 className="text-3xl font-bold text-white">Smart Capital Allocation Engine</h1>
        <p className="text-muted-foreground/70 mt-1">Predictive modeling for optimal portfolio construction</p>
      </div>

      <div className="p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Configuration Panel */}
          <div className="bg-[#111111] border border-border rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <ChartBar className="w-5 h-5 text-purple-400" />
              Allocation Parameters
            </h3>

            <div className="space-y-6">
              {/* Total Capital */}
              <div>
                <label className="text-sm text-muted-foreground/70 mb-2 block">Total Capital to Deploy</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
                  <input
                    type="number"
                    value={totalCapital}
                    onChange={(e) => setTotalCapital(Number(e.target.value))}
                    className="w-full pl-9 pr-4 py-3 bg-card border border-border rounded-lg text-white font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                    step="100000"
                  />
                </div>
              </div>

              {/* Min Readiness */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm text-muted-foreground/70">Minimum Readiness Score</label>
                  <span className="text-sm font-mono text-purple-400">{minReadiness}</span>
                </div>
                <input
                  type="range"
                  min="60"
                  max="95"
                  value={minReadiness}
                  onChange={(e) => setMinReadiness(Number(e.target.value))}
                  className="w-full h-2 bg-card rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>

              {/* Max Risk Level */}
              <div>
                <label className="text-sm text-muted-foreground/70 mb-2 block">Maximum Risk Level</label>
                <select
                  value={maxRisk}
                  onChange={(e) => setMaxRisk(e.target.value)}
                  className="w-full px-3 py-3 bg-card border border-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="low">Low Risk Only</option>
                  <option value="moderate">Moderate or Lower</option>
                  <option value="high">All Risk Levels</option>
                </select>
              </div>

              {/* Region Preference */}
              <div>
                <label className="text-sm text-muted-foreground/70 mb-2 block">Region Preference</label>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full px-3 py-3 bg-card border border-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">All Regions</option>
                  <option value="North America">North America</option>
                  <option value="Europe">Europe</option>
                  <option value="Asia">Asia</option>
                </select>
              </div>

              {/* Results Summary */}
              <div className="pt-6 border-t border-border">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground/70">Eligible Startups</span>
                    <span className="text-sm font-mono text-white font-medium">
                      {eligibleStartups.length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground/70">Per Startup</span>
                    <span className="text-sm font-mono text-emerald-400 font-medium">
                      ${(allocationPerStartup / 1000).toFixed(0)}K
                    </span>
                  </div>
                </div>
              </div>

              <button className="w-full py-3 bg-purple-500 hover:bg-purple-600 text-white font-semibold rounded-lg transition-colors">
                Run Simulation
              </button>
            </div>
          </div>

          {/* Center & Right: Simulation Results */}
          <div className="lg:col-span-2 space-y-6">
            {/* Expected Returns */}
            <div className="bg-[#111111] border border-border rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Expected Portfolio Performance</h3>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <MetricCard
                  label="Expected IRR Range"
                  value={`${expectedIRR.min.toFixed(0)}-${expectedIRR.max.toFixed(0)}%`}
                  color="text-emerald-400"
                />
                <MetricCard
                  label="Survival Likelihood"
                  value={`${survivalLikelihood.toFixed(0)}%`}
                  color="text-blue-400"
                />
                <MetricCard
                  label="Exit Probability"
                  value={`${exitProbability.min.toFixed(0)}-${exitProbability.max.toFixed(0)}%`}
                  color="text-purple-400"
                />
              </div>

              {/* Projection Chart */}
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={projectionData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="year" stroke="#666" />
                    <YAxis stroke="#666" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1a1a1a',
                        border: '1px solid #333',
                        borderRadius: '8px',
                      }}
                    />
                    <Line type="monotone" dataKey="best" stroke="#10b981" strokeWidth={2} name="Best Case" />
                    <Line type="monotone" dataKey="portfolio" stroke="#3b82f6" strokeWidth={3} name="Expected" />
                    <Line type="monotone" dataKey="worst" stroke="#ef4444" strokeWidth={2} name="Worst Case" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Sector Distribution */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-[#111111] border border-border rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Sector Distribution</h3>
                <div className="h-64 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sectorData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {sectorData.map((_entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1a1a1a',
                          border: '1px solid #333',
                          borderRadius: '8px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 mt-4">
                  {sectorData.map((sector, index) => (
                    <div key={sector.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        ></div>
                        <span className="text-muted-foreground/50">{sector.name}</span>
                      </div>
                      <span className="text-muted-foreground/70 font-mono">
                        {((sector.value / eligibleStartups.length) * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#111111] border border-border rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Capital Allocation by Sector</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sectorData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="name" stroke="#666" angle={-45} textAnchor="end" height={80} />
                      <YAxis stroke="#666" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1a1a1a',
                          border: '1px solid #333',
                          borderRadius: '8px',
                        }}
                        formatter={(value: number) => `$${(value / 1000).toFixed(0)}K`}
                      />
                      <Bar dataKey="allocation" fill="#8b5cf6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* AI Commentary */}
            <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-lg p-6">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-purple-400" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-purple-300 mb-2">AI ALLOCATION INSIGHTS</h4>
                  <p className="text-white mb-2">
                    Portfolio resembles top quartile early-stage SaaS funds (2015-2018 cohort).
                  </p>
                  <p className="text-muted-foreground/50 text-sm">
                    Risk-adjusted returns optimized for {minReadiness}+ readiness threshold. Diversification
                    across {Object.keys(sectorDistribution).length} sectors provides downside protection while
                    maintaining upside exposure to high-velocity startups.
                  </p>
                  {eligibleStartups.length < 5 && (
                    <div className="mt-3 flex items-start gap-2 text-sm text-amber-300">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>
                        Portfolio concentration risk: Consider lowering readiness threshold to increase
                        diversification.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Eligible Startups List */}
            <div className="bg-[#111111] border border-border rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                Eligible Startups ({eligibleStartups.length})
              </h3>
              <div className="space-y-2">
                {eligibleStartups.map((startup) => (
                  <div
                    key={startup.id}
                    className="flex items-center justify-between p-3 bg-card/50 rounded-lg hover:bg-card transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="font-medium text-white">{startup.name}</p>
                        <p className="text-sm text-muted-foreground/70">{startup.sector}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-center">
                        <p className="text-muted-foreground/70 text-xs mb-1">Readiness</p>
                        <p className="font-mono text-emerald-400 font-medium">{startup.readinessScore}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-muted-foreground/70 text-xs mb-1">Allocation</p>
                        <p className="font-mono text-purple-400 font-medium">
                          ${(allocationPerStartup / 1000).toFixed(0)}K
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-muted-foreground/70 text-xs mb-1">Risk</p>
                        <p
                          className={`text-xs font-medium capitalize ${
                            startup.riskLevel === 'low'
                              ? 'text-emerald-400'
                              : startup.riskLevel === 'moderate'
                              ? 'text-amber-400'
                              : 'text-red-400'
                          }`}
                        >
                          {startup.riskLevel}
                        </p>
                      </div>
                    </div>
                  </div>
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
  value: string;
  color: string;
}

function MetricCard({ label, value, color }: MetricCardProps) {
  return (
    <div className="bg-card/50 rounded-lg p-4 border border-border">
      <p className="text-sm text-muted-foreground/70 mb-2">{label}</p>
      <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
    </div>
  );
}
