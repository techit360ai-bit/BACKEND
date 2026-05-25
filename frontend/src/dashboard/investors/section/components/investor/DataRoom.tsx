import { useParams, Link } from 'react-router-dom';
import { mockStartups } from '../../data/mockData';
import { FileText, Download, Lock, Shield, BarChart3, DollarSign, Zap } from 'lucide-react';

export function DataRoom() {
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

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <div className="border-b border-gray-800 bg-[#111111] px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">{startup.name} - Data Room</h1>
            <p className="text-gray-400 mt-1">Auto-generated structured data repository</p>
          </div>
          <div className="flex gap-3">
            <button className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export All
            </button>
            <Link
              to={`/investor/deal-room/${startup.id}`}
              className="px-4 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 font-medium rounded-lg transition-all flex items-center gap-2"
            >
              <Shield className="w-4 h-4" />
              Deal Room
            </Link>
          </div>
        </div>
      </div>

      <div className="p-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Tab Navigation */}
          <div className="bg-[#111111] border border-gray-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-400 mb-3">SECTIONS</h3>
            <nav className="space-y-1">
              <TabButton icon={BarChart3} label="Metrics Dashboard" active />
              <TabButton icon={DollarSign} label="Financials" />
              <TabButton icon={Zap} label="Testing Reports" />
              <TabButton icon={Shield} label="Compliance" />
              <TabButton icon={FileText} label="Governance" />
              <TabButton icon={FileText} label="Execution History" />
              <TabButton icon={Zap} label="AI Summary" />
            </nav>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Metrics Dashboard */}
            <div className="bg-[#111111] border border-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-white mb-6">Metrics Dashboard</h3>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <MetricCard label="Market Readiness Score" value={startup.readinessScore.toString()} />
                <MetricCard label="Execution Velocity Index" value={startup.executionVelocity.toString()} />
                <MetricCard label="Beta Retention Rate" value={`${startup.betaRetention}%`} />
                <MetricCard label="Revenue Growth (MoM)" value={`${startup.revenueGrowth}%`} />
                <MetricCard label="Monthly Recurring Revenue" value={`$${(startup.mrr / 1000).toFixed(0)}K`} />
                <MetricCard label="Burn Efficiency Ratio" value={startup.burnEfficiency.toFixed(1)} />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <StatCard label="Pivot Frequency" value={startup.pivotFrequency} color="text-amber-400" />
                <StatCard label="Experiment Velocity" value={`${startup.experimentVelocity}/wk`} color="text-purple-400" />
                <StatCard label="Founder Reliability" value={startup.founderReliability} color="text-emerald-400" />
              </div>
            </div>

            {/* Milestones */}
            <div className="bg-[#111111] border border-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-white mb-6">Key Milestones</h3>
              <div className="space-y-3">
                {startup.milestones.map((milestone) => (
                  <div key={milestone.id} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className={`w-2 h-2 rounded-full ${
                        milestone.status === 'completed' ? 'bg-emerald-500' : 
                        milestone.status === 'in-progress' ? 'bg-blue-500' : 'bg-gray-500'
                      }`}></div>
                      <div>
                        <p className="font-medium text-white">{milestone.title}</p>
                        <p className="text-sm text-gray-400">{milestone.date}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded text-xs font-mono ${
                      milestone.type === 'revenue' ? 'bg-emerald-500/20 text-emerald-300' :
                      milestone.type === 'beta' ? 'bg-blue-500/20 text-blue-300' :
                      milestone.type === 'certification' ? 'bg-purple-500/20 text-purple-300' :
                      milestone.type === 'governance' ? 'bg-cyan-500/20 text-cyan-300' :
                      'bg-amber-500/20 text-amber-300'
                    }`}>
                      {milestone.type}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Risk Analysis */}
            <div className="bg-[#111111] border border-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-white mb-6">Risk Analysis Report</h3>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(startup.riskMetrics).map(([key, value]) => (
                  <div key={key} className="p-4 bg-gray-800/50 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-gray-400 capitalize">{key} Risk</span>
                      <span className="text-lg font-bold font-mono text-white">{value}</span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          value >= 85 ? 'bg-emerald-500' :
                          value >= 70 ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${value}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Compliance Documents */}
            <div className="bg-[#111111] border border-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-white mb-6">Compliance Documents</h3>
              <div className="space-y-2">
                <DocumentRow name="AI Governance Certificate" verified={startup.aiGovernanceVerified} date="2026-01-15" />
                <DocumentRow name="Regulatory Compliance Report" verified={startup.complianceVerified} date="2026-02-01" />
                <DocumentRow name="Data Privacy Audit" verified={true} date="2026-01-28" />
                <DocumentRow name="Security Assessment" verified={true} date="2026-02-05" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface TabButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
}

function TabButton({ icon: Icon, label, active }: TabButtonProps) {
  return (
    <button
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left ${
        active
          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
          : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
}

function MetricCard({ label, value }: MetricCardProps) {
  return (
    <div className="p-4 bg-gray-800/50 rounded-lg">
      <p className="text-sm text-gray-400 mb-2">{label}</p>
      <p className="text-2xl font-bold font-mono text-white">{value}</p>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  color: string;
}

function StatCard({ label, value, color }: StatCardProps) {
  return (
    <div className="p-4 bg-gray-800/50 rounded-lg text-center">
      <p className={`text-3xl font-bold font-mono ${color} mb-1`}>{value}</p>
      <p className="text-sm text-gray-400">{label}</p>
    </div>
  );
}

interface DocumentRowProps {
  name: string;
  verified: boolean;
  date: string;
}

function DocumentRow({ name, verified, date }: DocumentRowProps) {
  return (
    <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors group">
      <div className="flex items-center gap-3">
        <FileText className="w-5 h-5 text-gray-400" />
        <div>
          <p className="font-medium text-white">{name}</p>
          <p className="text-sm text-gray-400">{date}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {verified && (
          <div className="flex items-center gap-1 px-2 py-1 bg-emerald-500/20 rounded">
            <Shield className="w-3 h-3 text-emerald-400" />
            <span className="text-xs text-emerald-400">Verified</span>
          </div>
        )}
        <button className="opacity-0 group-hover:opacity-100 p-2 text-blue-400 hover:bg-blue-500/10 rounded transition-all">
          <Download className="w-4 h-4" />
        </button>
        <button className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:bg-gray-700 rounded transition-all">
          <Lock className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
