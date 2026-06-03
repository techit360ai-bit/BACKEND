import { Award, TrendingUp, Star, Clock, Heart, Zap, Shield } from 'lucide-react';

export function Reputation() {
  const investorScore = 87;
  const scoreLevel = investorScore >= 85 ? 'Elite' : investorScore >= 70 ? 'Established' : 'Building';
  
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <div className="border-b border-border bg-[#111111] px-8 py-6">
        <h1 className="text-3xl font-bold text-white">Investor Reputation Dashboard</h1>
        <p className="text-muted-foreground/70 mt-1">
          Building balanced power dynamics through mutual accountability
        </p>
      </div>

      <div className="p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Score Overview */}
          <div className="lg:col-span-2 space-y-6">
            {/* Main Score Card */}
            <div className="bg-gradient-to-br from-emerald-500/10 to-blue-500/10 border border-emerald-500/20 rounded-lg p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">Your Reputation Score</h2>
                  <p className="text-muted-foreground/50">Based on founder feedback and engagement metrics</p>
                </div>
                <div className="p-4 bg-emerald-500/20 rounded-full">
                  <Award className="w-8 h-8 text-emerald-400" />
                </div>
              </div>
              
              <div className="flex items-baseline gap-4 mb-4">
                <span className="text-6xl font-bold font-mono text-emerald-400">{investorScore}</span>
                <span className="text-2xl text-muted-foreground/70">/100</span>
              </div>
              
              <div className="flex items-center gap-3 mb-4">
                <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-sm font-semibold">
                  {scoreLevel} Tier
                </span>
                <div className="flex items-center gap-1 text-emerald-400">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-sm font-medium">+3 this month</span>
                </div>
              </div>
              
              <div className="h-3 bg-card rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-blue-500"
                  style={{ width: `${investorScore}%` }}
                ></div>
              </div>
            </div>

            {/* Score Breakdown */}
            <div className="bg-[#111111] border border-border rounded-lg p-6">
              <h3 className="text-xl font-semibold text-white mb-6">Reputation Metrics</h3>
              <div className="space-y-4">
                <ScoreMetric
                  icon={Clock}
                  label="Response Speed"
                  score={92}
                  description="Average response time: 4.2 hours"
                  color="text-emerald-400"
                />
                <ScoreMetric
                  icon={Star}
                  label="Founder Rating"
                  score={88}
                  description="Based on 12 founder reviews"
                  color="text-amber-400"
                />
                <ScoreMetric
                  icon={Zap}
                  label="Follow-Through Consistency"
                  score={85}
                  description="Commitments kept: 94%"
                  color="text-purple-400"
                />
                <ScoreMetric
                  icon={Heart}
                  label="Value-Add Contributions"
                  score={81}
                  description="Active portfolio support"
                  color="text-pink-400"
                />
                <ScoreMetric
                  icon={TrendingUp}
                  label="Portfolio Engagement"
                  score={90}
                  description="Monthly check-ins: 100%"
                  color="text-blue-400"
                />
              </div>
            </div>

            {/* Founder Reviews */}
            <div className="bg-[#111111] border border-border rounded-lg p-6">
              <h3 className="text-xl font-semibold text-white mb-6">Recent Founder Reviews</h3>
              <div className="space-y-4">
                <ReviewCard
                  founderName="Sarah Chen"
                  startup="QuantumAPI"
                  rating={5}
                  comment="Incredibly responsive and provided valuable strategic guidance. Made the funding process smooth and transparent."
                  date="Feb 8, 2026"
                />
                <ReviewCard
                  founderName="Marcus Rodriguez"
                  startup="NeuralEdge AI"
                  rating={5}
                  comment="Goes beyond capital. Opened doors to key partnerships and actively helps with hiring. True value-add investor."
                  date="Feb 1, 2026"
                />
                <ReviewCard
                  founderName="Aisha Patel"
                  startup="CloudMesh"
                  rating={4}
                  comment="Professional and fair terms. Would have appreciated faster turnaround on due diligence."
                  date="Jan 24, 2026"
                />
              </div>
            </div>
          </div>

          {/* Right: Benefits & Insights */}
          <div className="space-y-6">
            {/* Benefits Unlocked */}
            <div className="bg-[#111111] border border-border rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-400" />
                Elite Tier Benefits
              </h3>
              <div className="space-y-3">
                <BenefitItem 
                  label="Early Access Deals"
                  status="active"
                  description="See startups 48h before general investors"
                />
                <BenefitItem 
                  label="Exclusive Cohorts"
                  status="active"
                  description="Invitation to private funding rounds"
                />
                <BenefitItem 
                  label="Allocation Priority"
                  status="active"
                  description="Preferential allocation in high-demand deals"
                />
                <BenefitItem 
                  label="Direct Founder Intro"
                  status="active"
                  description="Skip the queue for top startups"
                />
              </div>
            </div>

            {/* Score History */}
            <div className="bg-[#111111] border border-border rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Score Progression</h3>
              <div className="space-y-3">
                <ProgressItem month="Feb 2026" score={87} change={3} />
                <ProgressItem month="Jan 2026" score={84} change={2} />
                <ProgressItem month="Dec 2025" score={82} change={4} />
                <ProgressItem month="Nov 2025" score={78} change={1} />
              </div>
            </div>

            {/* Tips to Improve */}
            <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Ways to Improve</h3>
              <ul className="space-y-3 text-sm text-muted-foreground/50">
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-purple-400 rounded-full mt-1.5"></div>
                  <span>Reduce response time to under 4 hours for +5 points</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-purple-400 rounded-full mt-1.5"></div>
                  <span>Complete 3 more founder reviews for credibility boost</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-purple-400 rounded-full mt-1.5"></div>
                  <span>Provide 2+ portfolio intros this quarter for value-add score</span>
                </li>
              </ul>
            </div>

            {/* Leaderboard Position */}
            <div className="bg-[#111111] border border-border rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Leaderboard Position</h3>
              <div className="text-center py-4">
                <p className="text-5xl font-bold font-mono text-emerald-400 mb-2">#12</p>
                <p className="text-sm text-muted-foreground/70">out of 284 investors</p>
                <p className="text-xs text-muted-foreground mt-2">Top 4.2%</p>
              </div>
              <button className="w-full mt-4 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-sm font-medium rounded transition-all">
                View Full Leaderboard
              </button>
            </div>
          </div>
        </div>

        {/* Info Banner */}
        <div className="mt-6 bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Shield className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-blue-300 mb-2">BALANCED POWER DYNAMICS</h4>
              <p className="text-white mb-2">
                TechIT scores both founders AND investors. This creates mutual accountability.
              </p>
              <p className="text-muted-foreground/50 text-sm">
                High reputation investors get early access to top-tier startups. This incentivizes fair treatment, 
                fast responses, and genuine value-add behavior. It's not just about capital—it's about partnership quality.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ScoreMetricProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  score: number;
  description: string;
  color: string;
}

function ScoreMetric({ icon: Icon, label, score, description, color }: ScoreMetricProps) {
  return (
    <div className="flex items-center gap-4">
      <div className="p-3 bg-card/50 rounded-lg">
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="font-medium text-white">{label}</span>
          <span className={`font-mono font-bold ${color}`}>{score}</span>
        </div>
        <p className="text-sm text-muted-foreground/70">{description}</p>
        <div className="h-1.5 bg-card rounded-full overflow-hidden mt-2">
          <div
            className={`h-full ${color.replace('text-', 'bg-')}`}
            style={{ width: `${score}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
}

interface ReviewCardProps {
  founderName: string;
  startup: string;
  rating: number;
  comment: string;
  date: string;
}

function ReviewCard({ founderName, startup, rating, comment, date }: ReviewCardProps) {
  return (
    <div className="p-4 bg-card/50 rounded-lg">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-semibold text-white">{founderName}</p>
          <p className="text-sm text-muted-foreground/70">{startup}</p>
        </div>
        <div className="flex items-center gap-1">
          {[...Array(rating)].map((_, i) => (
            <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
          ))}
        </div>
      </div>
      <p className="text-sm text-muted-foreground/50 mb-2">{comment}</p>
      <p className="text-xs text-muted-foreground">{date}</p>
    </div>
  );
}

interface BenefitItemProps {
  label: string;
  status: 'active' | 'locked';
  description: string;
}

function BenefitItem({ label, status, description }: BenefitItemProps) {
  return (
    <div className={`p-3 rounded-lg ${
      status === 'active' 
        ? 'bg-emerald-500/10 border border-emerald-500/20' 
        : 'bg-card/50 border border-border'
    }`}>
      <div className="flex items-center gap-2 mb-1">
        {status === 'active' ? (
          <Shield className="w-4 h-4 text-emerald-400" />
        ) : (
          <Shield className="w-4 h-4 text-muted-foreground" />
        )}
        <span className={`font-medium ${status === 'active' ? 'text-emerald-400' : 'text-muted-foreground/70'}`}>
          {label}
        </span>
      </div>
      <p className="text-xs text-muted-foreground/70 ml-6">{description}</p>
    </div>
  );
}

interface ProgressItemProps {
  month: string;
  score: number;
  change: number;
}

function ProgressItem({ month, score, change }: ProgressItemProps) {
  return (
    <div className="flex items-center justify-between p-3 bg-card/50 rounded-lg">
      <span className="text-sm text-muted-foreground/70">{month}</span>
      <div className="flex items-center gap-3">
        <span className="font-mono text-white">{score}</span>
        <div className={`flex items-center gap-1 text-sm ${change > 0 ? 'text-emerald-400' : 'text-muted-foreground/70'}`}>
          <TrendingUp className="w-3 h-3" />
          <span>+{change}</span>
        </div>
      </div>
    </div>
  );
}
