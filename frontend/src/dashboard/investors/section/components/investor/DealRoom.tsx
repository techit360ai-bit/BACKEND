import { useParams, Link } from 'react-router-dom';
import { mockStartups } from '../../data/mockData';
import { Shield, FileText, Users, DollarSign, Calendar, PenTool, CheckCircle } from 'lucide-react';

export function DealRoom() {
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

  const suggestedValuation = startup.mrr * 12 * 8; // Simple ARR * 8 multiple

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <div className="border-b border-gray-800 bg-[#111111] px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">{startup.name} - Deal Room</h1>
            <p className="text-gray-400 mt-1">Secure negotiation and structuring environment</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-sm font-medium flex items-center gap-1">
              <Shield className="w-3 h-3" />
              Encrypted
            </div>
          </div>
        </div>
      </div>

      <div className="p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Deal Structure */}
          <div className="lg:col-span-2 space-y-6">
            {/* Cap Table Preview */}
            <div className="bg-[#111111] border border-gray-800 rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-400" />
                  Cap Table Preview
                </h3>
                <button className="text-sm text-blue-400 hover:text-blue-300">View Full Table</button>
              </div>
              <div className="space-y-3">
                <CapTableRow entity="Founders" percentage={65} />
                <CapTableRow entity="Employee Pool" percentage={15} />
                <CapTableRow entity="Existing Investors" percentage={12} />
                <CapTableRow entity="Available for New Round" percentage={8} isHighlight />
              </div>
            </div>

            {/* Term Sheet Simulator */}
            <div className="bg-[#111111] border border-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-400" />
                Term Sheet Simulator
              </h3>
              <div className="space-y-4">
                <InputField label="Investment Amount" defaultValue="$250,000" />
                <InputField label="Valuation" defaultValue={`$${(suggestedValuation / 1000000).toFixed(1)}M`} />
                <InputField label="Equity %" defaultValue="5.2%" />
                <InputField label="Instrument Type" defaultValue="SAFE" isSelect />
                
                <div className="pt-4 border-t border-gray-800">
                  <h4 className="text-sm font-semibold text-white mb-3">Key Terms</h4>
                  <div className="space-y-2 text-sm">
                    <TermRow label="Valuation Cap" value={`$${(suggestedValuation / 1000000).toFixed(1)}M`} />
                    <TermRow label="Discount Rate" value="20%" />
                    <TermRow label="Pro Rata Rights" value="Yes" />
                    <TermRow label="Board Seat" value="Observer Rights" />
                  </div>
                </div>
              </div>
            </div>

            {/* Milestone-Based SAFE */}
            <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-purple-400" />
                Milestone-Based Capital Release
              </h3>
              <div className="space-y-3">
                <MilestoneClause 
                  milestone="Initial Tranche"
                  amount="$100K"
                  condition="Upon signing"
                  status="pending"
                />
                <MilestoneClause 
                  milestone="Product Milestone"
                  amount="$75K"
                  condition="Achieve 90+ Market Readiness"
                  status="pending"
                />
                <MilestoneClause 
                  milestone="Revenue Milestone"
                  amount="$75K"
                  condition="Reach $150K MRR"
                  status="pending"
                />
              </div>
              <p className="text-sm text-gray-400 mt-4">
                Automated release based on TechIT execution tracking
              </p>
            </div>

            {/* Document Signing */}
            <div className="bg-[#111111] border border-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                <PenTool className="w-5 h-5 text-blue-400" />
                Document Signing
              </h3>
              <div className="space-y-2">
                <DocumentItem name="Simple Agreement for Future Equity (SAFE)" status="ready" />
                <DocumentItem name="Subscription Agreement" status="ready" />
                <DocumentItem name="Investor Rights Agreement" status="draft" />
                <DocumentItem name="Right of First Refusal Agreement" status="draft" />
              </div>
              <button className="w-full mt-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg transition-colors">
                Review & Sign Documents
              </button>
            </div>
          </div>

          {/* Right: Deal Summary */}
          <div className="space-y-6">
            {/* Deal Overview */}
            <div className="bg-[#111111] border border-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Deal Overview</h3>
              <div className="space-y-4">
                <SummaryItem 
                  icon={DollarSign}
                  label="Suggested Investment"
                  value="$250K"
                  color="text-emerald-400"
                />
                <SummaryItem 
                  icon={Users}
                  label="Equity"
                  value="5.2%"
                  color="text-purple-400"
                />
                <SummaryItem 
                  icon={FileText}
                  label="Valuation"
                  value={`$${(suggestedValuation / 1000000).toFixed(1)}M`}
                  color="text-blue-400"
                />
              </div>
            </div>

            {/* Startup Performance */}
            <div className="bg-[#111111] border border-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Current Performance</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Market Readiness</span>
                  <span className="font-mono text-white">{startup.readinessScore}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">MRR</span>
                  <span className="font-mono text-emerald-400">${(startup.mrr / 1000).toFixed(0)}K</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Growth Rate</span>
                  <span className="font-mono text-emerald-400">+{startup.revenueGrowth}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Risk Level</span>
                  <span className={`capitalize ${
                    startup.riskLevel === 'low' ? 'text-emerald-400' :
                    startup.riskLevel === 'moderate' ? 'text-amber-400' :
                    'text-red-400'
                  }`}>
                    {startup.riskLevel}
                  </span>
                </div>
              </div>
            </div>

            {/* Negotiation Tracking */}
            <div className="bg-[#111111] border border-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Negotiation Status</h3>
              <div className="space-y-3">
                <StatusStep step="Initial Discussion" completed />
                <StatusStep step="Term Sheet Draft" completed />
                <StatusStep step="Due Diligence" active />
                <StatusStep step="Final Agreement" />
                <StatusStep step="Funds Transfer" />
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-[#111111] border border-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <Link
                  to={`/investor/data-room/${startup.id}`}
                  className="block w-full py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-sm font-medium rounded transition-all text-center"
                >
                  View Data Room
                </Link>
                <Link
                  to={`/investor/risk-radar/${startup.id}`}
                  className="block w-full py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-sm font-medium rounded transition-all text-center"
                >
                  Risk Analysis
                </Link>
                <button className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded transition-all">
                  Schedule Call
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface CapTableRowProps {
  entity: string;
  percentage: number;
  isHighlight?: boolean;
}

function CapTableRow({ entity, percentage, isHighlight }: CapTableRowProps) {
  return (
    <div className={`p-3 rounded-lg ${isHighlight ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-gray-800/50'}`}>
      <div className="flex justify-between items-center mb-2">
        <span className={`text-sm ${isHighlight ? 'text-emerald-400 font-medium' : 'text-gray-300'}`}>{entity}</span>
        <span className={`font-mono font-semibold ${isHighlight ? 'text-emerald-400' : 'text-white'}`}>{percentage}%</span>
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${isHighlight ? 'bg-emerald-500' : 'bg-purple-500'}`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
}

interface InputFieldProps {
  label: string;
  defaultValue: string;
  isSelect?: boolean;
}

function InputField({ label, defaultValue, isSelect }: InputFieldProps) {
  return (
    <div>
      <label className="text-sm text-gray-400 mb-2 block">{label}</label>
      {isSelect ? (
        <select className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
          <option>{defaultValue}</option>
          <option>Convertible Note</option>
          <option>Equity</option>
        </select>
      ) : (
        <input
          type="text"
          defaultValue={defaultValue}
          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      )}
    </div>
  );
}

interface TermRowProps {
  label: string;
  value: string;
}

function TermRow({ label, value }: TermRowProps) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-400">{label}</span>
      <span className="text-white font-medium">{value}</span>
    </div>
  );
}

interface MilestoneClauseProps {
  milestone: string;
  amount: string;
  condition: string;
  status: 'completed' | 'pending';
}

function MilestoneClause({ milestone, amount, condition, status }: MilestoneClauseProps) {
  return (
    <div className={`p-4 rounded-lg border ${
      status === 'completed' 
        ? 'bg-emerald-500/10 border-emerald-500/20' 
        : 'bg-gray-800/50 border-gray-700'
    }`}>
      <div className="flex justify-between items-start mb-2">
        <div>
          <h4 className="font-semibold text-white">{milestone}</h4>
          <p className="text-sm text-gray-400 mt-1">{condition}</p>
        </div>
        <span className="font-mono font-bold text-emerald-400">{amount}</span>
      </div>
      <div className={`mt-2 inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
        status === 'completed'
          ? 'bg-emerald-500/20 text-emerald-300'
          : 'bg-gray-700 text-gray-400'
      }`}>
        {status === 'completed' && <CheckCircle className="w-3 h-3" />}
        {status === 'completed' ? 'Released' : 'Pending'}
      </div>
    </div>
  );
}

interface DocumentItemProps {
  name: string;
  status: 'ready' | 'draft';
}

function DocumentItem({ name, status }: DocumentItemProps) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
      <div className="flex items-center gap-3">
        <FileText className="w-4 h-4 text-gray-400" />
        <span className="text-sm text-white">{name}</span>
      </div>
      <span className={`text-xs px-2 py-1 rounded ${
        status === 'ready'
          ? 'bg-emerald-500/20 text-emerald-400'
          : 'bg-amber-500/20 text-amber-400'
      }`}>
        {status}
      </span>
    </div>
  );
}

interface SummaryItemProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: string;
}

function SummaryItem({ icon: Icon, label, value, color }: SummaryItemProps) {
  return (
    <div className="flex items-center gap-3">
      <div className={`p-2 bg-gray-800 rounded-lg`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div>
        <p className="text-sm text-gray-400">{label}</p>
        <p className={`text-xl font-bold font-mono ${color}`}>{value}</p>
      </div>
    </div>
  );
}

interface StatusStepProps {
  step: string;
  completed?: boolean;
  active?: boolean;
}

function StatusStep({ step, completed, active }: StatusStepProps) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
        completed ? 'bg-emerald-500' :
        active ? 'bg-blue-500' :
        'bg-gray-700'
      }`}>
        {completed && <CheckCircle className="w-4 h-4 text-white" />}
        {active && !completed && <div className="w-2 h-2 bg-white rounded-full"></div>}
      </div>
      <span className={`text-sm ${
        completed || active ? 'text-white font-medium' : 'text-gray-400'
      }`}>
        {step}
      </span>
    </div>
  );
}
