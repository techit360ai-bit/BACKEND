import { useState } from 'react';
import { Link } from 'react-router-dom';
import { mockStartups } from '../../data/mockData';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts';
import {
  AlertTriangle,
  CheckCircle,
  Filter,
  SortAsc,
  SortDesc,
  ArrowRight,
  ShieldAlert,
  TrendingUp,
  Activity,
} from 'lucide-react';

type SortField = 'readinessScore' | 'avgRisk' | 'riskLevel';
type SortDir = 'asc' | 'desc';

function avgRiskScore(startup: (typeof mockStartups)[0]) {
  const m = startup.riskMetrics;
  return (m.product + m.market + m.team + m.compliance + m.financial + m.execution) / 6;
}

export function RiskAnalysis() {
  const [filterRisk, setFilterRisk] = useState<'all' | 'low' | 'moderate' | 'high'>('all');
  const [sortField, setSortField] = useState<SortField>('avgRisk');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedStartup, setSelectedStartup] = useState(mockStartups[0]);

  const filtered = mockStartups
    .filter((s) => filterRisk === 'all' || s.riskLevel === filterRisk)
    .sort((a, b) => {
      let aVal: number, bVal: number;
      if (sortField === 'avgRisk') {
        aVal = avgRiskScore(a);
        bVal = avgRiskScore(b);
      } else if (sortField === 'readinessScore') {
        aVal = a.readinessScore;
        bVal = b.readinessScore;
      } else {
        const order = { low: 0, moderate: 1, high: 2 };
        aVal = order[a.riskLevel];
        bVal = order[b.riskLevel];
      }
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
    });

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const radarData = [
    { category: 'Product', value: selectedStartup.riskMetrics.product },
    { category: 'Market', value: selectedStartup.riskMetrics.market },
    { category: 'Team', value: selectedStartup.riskMetrics.team },
    { category: 'Compliance', value: selectedStartup.riskMetrics.compliance },
    { category: 'Financial', value: selectedStartup.riskMetrics.financial },
    { category: 'Execution', value: selectedStartup.riskMetrics.execution },
  ];

  const portfolioAvg = mockStartups.reduce((sum, s) => sum + avgRiskScore(s), 0) / mockStartups.length;
  const lowCount = mockStartups.filter((s) => s.riskLevel === 'low').length;
  const modCount = mockStartups.filter((s) => s.riskLevel === 'moderate').length;
  const highCount = mockStartups.filter((s) => s.riskLevel === 'high').length;

  const SortIcon = sortDir === 'desc' ? SortDesc : SortAsc;

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <div className="border-b border-border bg-[#111111] px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Risk Analysis</h1>
            <p className="text-muted-foreground/70 mt-1">
              Multi-dimensional risk assessment across your entire deal pipeline
            </p>
          </div>
          <Link
            to={`/investor/risk-radar/${selectedStartup.id}`}
            className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-medium rounded-lg transition-all flex items-center gap-2"
          >
            Full Radar: {selectedStartup.name}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      <div className="p-8">
        {/* Portfolio summary */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-[#111111] border border-border rounded-lg p-5">
            <p className="text-xs text-muted-foreground/70 uppercase tracking-wider mb-2">Portfolio Avg Risk</p>
            <p className="text-3xl font-bold font-mono text-white">{portfolioAvg.toFixed(0)}</p>
            <p className="text-sm text-muted-foreground mt-1">out of 100</p>
          </div>
          <div className="bg-[#111111] border border-emerald-500/20 rounded-lg p-5">
            <p className="text-xs text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" /> Low Risk
            </p>
            <p className="text-3xl font-bold font-mono text-emerald-400">{lowCount}</p>
            <p className="text-sm text-muted-foreground mt-1">startups</p>
          </div>
          <div className="bg-[#111111] border border-amber-500/20 rounded-lg p-5">
            <p className="text-xs text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Moderate Risk
            </p>
            <p className="text-3xl font-bold font-mono text-amber-400">{modCount}</p>
            <p className="text-sm text-muted-foreground mt-1">startups</p>
          </div>
          <div className="bg-[#111111] border border-red-500/20 rounded-lg p-5">
            <p className="text-xs text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5" /> High Risk
            </p>
            <p className="text-3xl font-bold font-mono text-red-400">{highCount}</p>
            <p className="text-sm text-muted-foreground mt-1">startups</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: startup list */}
          <div className="lg:col-span-2 space-y-4">
            {/* Filters */}
            <div className="flex items-center gap-3">
              <Filter className="w-4 h-4 text-muted-foreground/70" />
              {(['all', 'low', 'moderate', 'high'] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => setFilterRisk(level)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all capitalize ${
                    filterRisk === level
                      ? level === 'low'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : level === 'moderate'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : level === 'high'
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : 'bg-card text-white border border-border'
                      : 'bg-card/50 text-muted-foreground/70 border border-border hover:bg-card'
                  }`}
                >
                  {level === 'all' ? 'All' : level}
                </button>
              ))}
              <div className="ml-auto flex gap-2">
                <button
                  onClick={() => toggleSort('avgRisk')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                    sortField === 'avgRisk'
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      : 'bg-card/50 text-muted-foreground/70 border border-border hover:bg-card'
                  }`}
                >
                  {sortField === 'avgRisk' && <SortIcon className="w-3.5 h-3.5" />}
                  Risk Score
                </button>
                <button
                  onClick={() => toggleSort('readinessScore')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                    sortField === 'readinessScore'
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      : 'bg-card/50 text-muted-foreground/70 border border-border hover:bg-card'
                  }`}
                >
                  {sortField === 'readinessScore' && <SortIcon className="w-3.5 h-3.5" />}
                  Readiness
                </button>
              </div>
            </div>

            {/* Startup risk cards */}
            <div className="space-y-3">
              {filtered.map((startup) => {
                const avg = avgRiskScore(startup);
                const isSelected = selectedStartup.id === startup.id;
                const weakest = Object.entries(startup.riskMetrics).sort(
                  ([, a], [, b]) => a - b
                )[0];

                return (
                  <button
                    key={startup.id}
                    onClick={() => setSelectedStartup(startup)}
                    className={`w-full text-left p-5 rounded-lg border transition-all ${
                      isSelected
                        ? 'bg-emerald-500/5 border-emerald-500/30'
                        : 'bg-[#111111] border-border hover:border-border'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-white">{startup.name}</h3>
                          <span
                            className={`text-xs px-2 py-0.5 rounded font-mono ${
                              startup.riskLevel === 'low'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : startup.riskLevel === 'moderate'
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}
                          >
                            {startup.riskLevel}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground/70 mt-0.5">
                          {startup.sector} · {startup.region}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={`text-2xl font-bold font-mono ${
                            avg >= 85
                              ? 'text-emerald-400'
                              : avg >= 70
                              ? 'text-amber-400'
                              : 'text-red-400'
                          }`}
                        >
                          {avg.toFixed(0)}
                        </p>
                        <p className="text-xs text-muted-foreground">avg risk score</p>
                      </div>
                    </div>

                    {/* Mini metric bars */}
                    <div className="grid grid-cols-6 gap-2">
                      {Object.entries(startup.riskMetrics).map(([dim, val]) => (
                        <div key={dim}>
                          <p className="text-xs text-muted-foreground mb-1 capitalize truncate">{dim}</p>
                          <div className="h-1.5 bg-card rounded-full overflow-hidden">
                            <div
                              className={`h-full ${
                                val >= 85
                                  ? 'bg-emerald-500'
                                  : val >= 70
                                  ? 'bg-amber-500'
                                  : 'bg-red-500'
                              }`}
                              style={{ width: `${val}%` }}
                            />
                          </div>
                          <p className="text-xs font-mono text-muted-foreground/70 mt-0.5">{val}</p>
                        </div>
                      ))}
                    </div>

                    {weakest[1] < 75 && (
                      <div className="mt-3 flex items-center gap-2 text-xs text-amber-400">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>
                          Weakest dimension: <span className="font-semibold capitalize">{weakest[0]}</span>{' '}
                          ({weakest[1]})
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Radar detail */}
          <div className="space-y-4">
            <div className="bg-[#111111] border border-border rounded-lg p-6 sticky top-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-white">{selectedStartup.name}</h3>
                  <p className="text-sm text-muted-foreground/70">{selectedStartup.sector}</p>
                </div>
                <Link
                  to={`/investor/risk-radar/${selectedStartup.id}`}
                  className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-all"
                >
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#333" />
                    <PolarAngleAxis dataKey="category" stroke="#555" tick={{ fontSize: 11 }} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} stroke="#444" tick={false} />
                    <Radar
                      name="Risk"
                      dataKey="value"
                      stroke="#10b981"
                      fill="#10b981"
                      fillOpacity={0.25}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2 mt-4">
                {radarData.map((item) => (
                  <div key={item.category} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground/70">{item.category}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-card rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            item.value >= 85
                              ? 'bg-emerald-500'
                              : item.value >= 70
                              ? 'bg-amber-500'
                              : 'bg-red-500'
                          }`}
                          style={{ width: `${item.value}%` }}
                        />
                      </div>
                      <span className="font-mono text-white w-6 text-right">{item.value}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 pt-5 border-t border-border grid grid-cols-2 gap-3 text-sm">
                <div className="bg-card/50 rounded-lg p-3">
                  <p className="text-muted-foreground/70 text-xs mb-1">Readiness</p>
                  <div className="flex items-center gap-1">
                    <Activity className="w-3.5 h-3.5 text-blue-400" />
                    <span className="font-mono font-bold text-white">
                      {selectedStartup.readinessScore}
                    </span>
                  </div>
                </div>
                <div className="bg-card/50 rounded-lg p-3">
                  <p className="text-muted-foreground/70 text-xs mb-1">Velocity</p>
                  <div className="flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
                    <span className="font-mono font-bold text-white">
                      {selectedStartup.executionVelocity}
                    </span>
                  </div>
                </div>
              </div>

              <Link
                to={`/investor/risk-radar/${selectedStartup.id}`}
                className="mt-4 w-full py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2"
              >
                Deep Dive Analysis
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
