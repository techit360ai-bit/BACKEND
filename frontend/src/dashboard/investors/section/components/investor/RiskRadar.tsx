import { useParams, Link } from 'react-router-dom';
import { mockStartups } from '../../data/mockData';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts';
import { Radar as RadarIcon, AlertCircle, CheckCircle, TrendingUp, Calendar, FileText, Eye, PieChart } from 'lucide-react';

export function RiskRadar() {
  const { startupId } = useParams();
  const startup = mockStartups.find((s) => s.id === startupId);

  if (!startup) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-2">Startup not found</h2>
          <Link to="/investor/deal-intelligence" className="text-emerald-400 hover:text-emerald-300">
            Return to Deal Intelligence
          </Link>
        </div>
      </div>
    );
  }

  const radarData = [
    { category: 'Product', value: startup.riskMetrics.product },
    { category: 'Market', value: startup.riskMetrics.market },
    { category: 'Team', value: startup.riskMetrics.team },
    { category: 'Compliance', value: startup.riskMetrics.compliance },
    { category: 'Financial', value: startup.riskMetrics.financial },
    { category: 'Execution', value: startup.riskMetrics.execution },
  ];

  const avgRisk = Object.values(startup.riskMetrics).reduce((a, b) => a + b, 0) / 6;
  const overallRiskLevel =
    avgRisk >= 85 ? 'Low Risk' : avgRisk >= 70 ? 'Moderate Risk' : 'High Risk';
  const overallRiskColor =
    avgRisk >= 85 ? 'text-emerald-400' : avgRisk >= 70 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <div className="border-b border-gray-800 bg-[#111111] px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">{startup.name}</h1>
            <div className="flex items-center gap-3 text-sm">
              <span className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded font-mono">
                {startup.sector}
              </span>
              <span className="text-gray-400">{startup.region}</span>
              <span className={`font-medium ${overallRiskColor}`}>{overallRiskLevel}</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button className="px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 font-medium rounded-lg transition-all flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Add to Watchlist
            </button>
            <Link
              to={`/investor/data-room/${startup.id}`}
              className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-medium rounded-lg transition-all flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              Data Room
            </Link>
            <Link
              to="/investor/allocation"
              className="px-4 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 font-medium rounded-lg transition-all flex items-center gap-2"
            >
              <PieChart className="w-4 h-4" />
              Simulate Allocation
            </Link>
          </div>
        </div>
      </div>

      <div className="p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Radar Chart */}
          <div className="bg-[#111111] border border-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <RadarIcon className="w-5 h-5 text-emerald-400" />
              Risk Heatmap
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#333" />
                  <PolarAngleAxis dataKey="category" stroke="#666" />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} stroke="#666" />
                  <Radar
                    name="Risk Score"
                    dataKey="value"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.3}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Risk Breakdown */}
            <div className="mt-4 space-y-2">
              {radarData.map((item) => (
                <div key={item.category} className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">{item.category}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          item.value >= 85
                            ? 'bg-emerald-500'
                            : item.value >= 70
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${item.value}%` }}
                      ></div>
                    </div>
                    <span className="font-mono text-white w-8">{item.value}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Overall Score */}
            <div className="mt-6 pt-6 border-t border-gray-800">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Overall Risk Score</span>
                <span className={`text-2xl font-bold font-mono ${overallRiskColor}`}>
                  {avgRisk.toFixed(0)}
                </span>
              </div>
            </div>
          </div>

          {/* Center: Execution Timeline */}
          <div className="bg-[#111111] border border-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-400" />
              Execution Timeline
            </h3>
            <div className="space-y-4">
              {startup.milestones.map((milestone, index) => (
                <div key={milestone.id} className="relative pl-6">
                  {index < startup.milestones.length - 1 && (
                    <div className="absolute left-2 top-6 w-0.5 h-full bg-gray-800"></div>
                  )}
                  <div className="absolute left-0 top-1">
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium">{milestone.title}</p>
                    <p className="text-sm text-gray-400">{milestone.date}</p>
                    <span
                      className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-mono ${
                        milestone.type === 'revenue'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : milestone.type === 'beta'
                          ? 'bg-blue-500/20 text-blue-300'
                          : milestone.type === 'certification'
                          ? 'bg-purple-500/20 text-purple-300'
                          : milestone.type === 'governance'
                          ? 'bg-cyan-500/20 text-cyan-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {milestone.type}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Key Metrics */}
            <div className="mt-6 pt-6 border-t border-gray-800 space-y-3">
              <MetricItem label="Market Readiness" value={startup.readinessScore} />
              <MetricItem label="Execution Velocity" value={startup.executionVelocity} />
              <MetricItem label="Beta Retention" value={`${startup.betaRetention}%`} />
              <MetricItem label="Revenue Growth" value={`${startup.revenueGrowth}%`} />
              <MetricItem label="MRR" value={`$${(startup.mrr / 1000).toFixed(0)}K`} />
              <MetricItem label="Burn Efficiency" value={startup.burnEfficiency.toFixed(1)} />
            </div>
          </div>

          {/* Right: AI Risk Commentary */}
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">AI Risk Commentary</h3>
              <div className="space-y-4">
                {startup.riskMetrics.execution >= 85 && (
                  <InsightCard
                    type="positive"
                    text="Execution risk reduced by 18% due to consistent sprint delivery and milestone velocity."
                  />
                )}
                {startup.riskMetrics.market < 75 && (
                  <InsightCard
                    type="warning"
                    text={`Market risk elevated due to ${
                      startup.sector === 'FinTech' ? 'regulatory challenges' : 'competitive pressure'
                    } in the ${startup.sector} space.`}
                  />
                )}
                {startup.complianceVerified && (
                  <InsightCard
                    type="positive"
                    text="Compliance verification complete. All regulatory requirements met."
                  />
                )}
                {startup.riskMetrics.financial < 75 && (
                  <InsightCard
                    type="warning"
                    text="Financial risk moderate. Monitor burn rate and revenue acceleration closely."
                  />
                )}
                {startup.founderReliability >= 90 && (
                  <InsightCard
                    type="positive"
                    text="Founder demonstrates exceptional reliability with consistent execution track record."
                  />
                )}
              </div>
            </div>

            {/* Comparative Analysis */}
            <div className="bg-[#111111] border border-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Comparative Analysis</h3>
              <div className="space-y-3 text-sm">
                <p className="text-gray-300">
                  Performance ranking:{' '}
                  <span className="text-emerald-400 font-semibold">
                    Top {Math.round((mockStartups.findIndex((s) => s.id === startup.id) + 1) / mockStartups.length * 100)}%
                  </span>
                </p>
                <p className="text-gray-300">
                  Investors watching: <span className="text-blue-400 font-semibold">{startup.investorsWatching}</span>
                </p>
                <p className="text-gray-300">
                  Pivot frequency:{' '}
                  <span
                    className={`font-semibold ${
                      startup.pivotFrequency === 0
                        ? 'text-emerald-400'
                        : startup.pivotFrequency === 1
                        ? 'text-amber-400'
                        : 'text-red-400'
                    }`}
                  >
                    {startup.pivotFrequency}
                  </span>
                </p>
                <p className="text-gray-300">
                  Experiment velocity:{' '}
                  <span className="text-purple-400 font-semibold">{startup.experimentVelocity}/week</span>
                </p>
              </div>
            </div>

            {/* AI Generated Summary */}
            <div className="bg-[#111111] border border-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-3">Investment Thesis</h3>
              <p className="text-gray-300 text-sm leading-relaxed">
                {startup.name} demonstrates {avgRisk >= 85 ? 'strong' : avgRisk >= 70 ? 'moderate' : 'developing'}{' '}
                execution fundamentals with a readiness score of {startup.readinessScore}. The team has achieved{' '}
                {startup.milestones.length} key milestones and maintains{' '}
                {startup.complianceVerified ? 'full' : 'partial'} compliance. Revenue trajectory shows{' '}
                {startup.revenueGrowth}% growth with ${(startup.mrr / 1000).toFixed(0)}K MRR.
              </p>
              <button className="mt-4 w-full py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-medium rounded-lg transition-all">
                Generate Full Investment Memo
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface MetricItemProps {
  label: string;
  value: string | number;
}

function MetricItem({ label, value }: MetricItemProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-400">{label}</span>
      <span className="text-sm font-mono font-medium text-white">{value}</span>
    </div>
  );
}

interface InsightCardProps {
  type: 'positive' | 'warning' | 'neutral';
  text: string;
}

function InsightCard({ type, text }: InsightCardProps) {
  const colors = {
    positive: {
      icon: CheckCircle,
      iconColor: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/20',
    },
    warning: {
      icon: AlertCircle,
      iconColor: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/20',
    },
    neutral: {
      icon: TrendingUp,
      iconColor: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/20',
    },
  };

  const config = colors[type];
  const Icon = config.icon;

  return (
    <div className={`${config.bgColor} border ${config.borderColor} rounded-lg p-4 flex gap-3`}>
      <Icon className={`w-5 h-5 ${config.iconColor} flex-shrink-0 mt-0.5`} />
      <p className="text-sm text-gray-200 leading-relaxed">{text}</p>
    </div>
  );
}
