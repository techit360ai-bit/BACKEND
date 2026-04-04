import {
  Download,
  Zap,
  TrendingUp,
  Clock,
  DollarSign,
  Eye,
  Zap as ZapIcon,
} from "lucide-react";
import { useState } from "react";
import CollaboratorSidebar from "@/components/CollaboratorSidebar";
import MobileNavBar from "@/components/MobileNavBar";

interface ProjectEarning {
  id: string;
  name: string;
  equity: string;
  revenueShare: string;
  earned: number;
  pending: number;
  equityPercent: string;
  impact: string;
}

interface Payout {
  id: string;
  project: string;
  milestone: string;
  dueDate: string;
  amount: number;
}

const EarningsPage = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const totalEarned = 105000;
  const totalPending = 12350;
  const totalEquity = 1.6;
  const avgMonthly = 8750;

  const projects: ProjectEarning[] = [
    {
      id: "1",
      name: "NeuralSync AI",
      equity: "0.8%",
      revenueShare: "2.5%",
      earned: 45000,
      pending: 5000,
      equityPercent: "0.8%",
      impact: "Dashboard feature increased user retention by 18%",
    },
    {
      id: "2",
      name: "FinFlow",
      equity: "0.5%",
      revenueShare: "1.8%",
      earned: 38000,
      pending: 4500,
      equityPercent: "0.5%",
      impact: "Payment integration enabled $500K in transactions",
    },
    {
      id: "3",
      name: "HealthTrack Pro",
      equity: "0.3%",
      revenueShare: "1.2%",
      earned: 22000,
      pending: 2850,
      equityPercent: "0.3%",
      impact: "ML model improved prediction accuracy by 12%",
    },
  ];

  const upcomingPayouts: Payout[] = [
    {
      id: "1",
      project: "NeuralSync AI",
      milestone: "March Milestone",
      dueDate: "April 10, 2026",
      amount: 5000,
    },
    {
      id: "2",
      project: "FinFlow",
      milestone: "Payment Integration Bonus",
      dueDate: "April 15, 2026",
      amount: 4500,
    },
    {
      id: "3",
      project: "HealthTrack Pro",
      milestone: "Q1 Performance",
      dueDate: "April 30, 2026",
      amount: 2850,
    },
  ];

  return (
    <div className="min-h-dvh w-full flex bg-background text-foreground overflow-hidden">
      {/* Mobile Navbar */}
      <MobileNavBar
        title="Earnings & Value"
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        onCloseSidebar={() => setIsSidebarOpen(false)}
      />

      {/* Sidebar */}
      <CollaboratorSidebar
        isOpenMobile={isSidebarOpen}
        onCloseMobile={() => setIsSidebarOpen(false)}
      />

      {/* Main Content */}
      <main className="flex-1 min-h-dvh overflow-y-auto bg-linear-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 md:ml-64 xl:ml-72 pt-16 md:pt-0">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6 lg:py-8 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground">
                Earnings & Value
              </h1>
              <p className="text-sm sm:text-base lg:text-lg text-muted-foreground">
                Track your financial impact across startups
              </p>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold text-sm hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors shrink-0 w-fit">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export Report</span>
              <span className="sm:hidden">Export</span>
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Total Earned */}
            <div className="rounded-xl sm:rounded-2xl border-2 border-emerald-500/60 bg-white dark:bg-card/80 p-4 sm:p-6 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                  Total Earned
                </p>
                <DollarSign className="h-5 sm:h-6 w-5 sm:w-6 text-emerald-600" />
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-emerald-600">
                ${(totalEarned / 1000).toFixed(0)}K
              </p>
              <p className="text-xs text-muted-foreground">Lifetime earnings</p>
            </div>

            {/* Pending */}
            <div className="rounded-xl sm:rounded-2xl border-2 border-orange-500/60 bg-white dark:bg-card/80 p-4 sm:p-6 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                  Pending
                </p>
                <TrendingUp className="h-5 sm:h-6 w-5 sm:w-6 text-orange-600" />
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-orange-600">
                ${(totalPending / 1000).toFixed(1)}K
              </p>
              <p className="text-xs text-muted-foreground">Awaiting payout</p>
            </div>

            {/* Total Equity */}
            <div className="rounded-xl sm:rounded-2xl border-2 border-violet-500/60 bg-white dark:bg-card/80 p-4 sm:p-6 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                  Total Equity
                </p>
                <Clock className="h-5 sm:h-6 w-5 sm:w-6 text-violet-600" />
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-violet-600">
                {totalEquity}%
              </p>
              <p className="text-xs text-muted-foreground">Across 3 startups</p>
            </div>

            {/* Avg Monthly */}
            <div className="rounded-xl sm:rounded-2xl border-2 border-blue-500/60 bg-white dark:bg-card/80 p-4 sm:p-6 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                  Avg Monthly
                </p>
                <Zap className="h-5 sm:h-6 w-5 sm:w-6 text-blue-600" />
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-blue-600">
                ${(avgMonthly / 1000).toFixed(1)}K
              </p>
              <p className="text-xs text-muted-foreground">Monthly average</p>
            </div>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Earnings by Project */}
            <div className="rounded-xl sm:rounded-2xl bg-white dark:bg-card/80 border border-slate-200 dark:border-slate-700 p-4 sm:p-6 space-y-4">
              <h2 className="text-lg font-semibold text-foreground">
                Earnings by Project
              </h2>

              <div className="h-64 sm:h-80 flex flex-col justify-between">
                {/* Y-axis labels */}
                <div className="flex justify-between text-xs text-muted-foreground px-4 sm:px-8">
                  <span className="hidden sm:inline">60000</span>
                  <span className="inline sm:hidden">60K</span>
                  <span className="hidden sm:inline">45000</span>
                  <span className="inline sm:hidden">45K</span>
                  <span className="hidden sm:inline">30000</span>
                  <span className="inline sm:hidden">30K</span>
                  <span className="hidden sm:inline">15000</span>
                  <span className="inline sm:hidden">15K</span>
                  <span>0</span>
                </div>

                {/* Chart bars */}
                <svg
                  viewBox="0 0 500 350"
                  className="w-full h-full"
                  preserveAspectRatio="none"
                >
                  {/* Grid lines */}
                  <line
                    x1="40"
                    y1="10"
                    x2="40"
                    y2="320"
                    stroke="currentColor"
                    strokeOpacity="0.1"
                    strokeWidth="1"
                  />
                  <line
                    x1="40"
                    y1="320"
                    x2="480"
                    y2="320"
                    stroke="currentColor"
                    strokeOpacity="0.1"
                    strokeWidth="1"
                  />
                  {[0, 1, 2, 3, 4].map((i) => (
                    <line
                      key={`grid-${i}`}
                      x1="40"
                      y1={10 + i * 77.5}
                      x2="480"
                      y2={10 + i * 77.5}
                      stroke="currentColor"
                      strokeOpacity="0.05"
                      strokeWidth="1"
                      strokeDasharray="4"
                    />
                  ))}

                  {/* Bars for each project */}
                  {/* NeuralSync AI */}
                  <rect
                    x="60"
                    y={320 - (45000 / 60000) * 310}
                    width="25"
                    height={(45000 / 60000) * 310}
                    fill="#10B981"
                  />
                  <rect
                    x="90"
                    y={320 - (5000 / 60000) * 310}
                    width="25"
                    height={(5000 / 60000) * 310}
                    fill="#F97316"
                  />

                  {/* FinFlow */}
                  <rect
                    x="160"
                    y={320 - (38000 / 60000) * 310}
                    width="25"
                    height={(38000 / 60000) * 310}
                    fill="#10B981"
                  />
                  <rect
                    x="190"
                    y={320 - (4500 / 60000) * 310}
                    width="25"
                    height={(4500 / 60000) * 310}
                    fill="#F97316"
                  />

                  {/* HealthTrack Pro */}
                  <rect
                    x="260"
                    y={320 - (22000 / 60000) * 310}
                    width="25"
                    height={(22000 / 60000) * 310}
                    fill="#10B981"
                  />
                  <rect
                    x="290"
                    y={320 - (2850 / 60000) * 310}
                    width="25"
                    height={(2850 / 60000) * 310}
                    fill="#F97316"
                  />

                  {/* X-axis labels */}
                  <text
                    x="75"
                    y="345"
                    textAnchor="middle"
                    className="text-xs fill-current"
                    fontSize="10"
                  >
                    NeuralSync
                  </text>
                  <text
                    x="175"
                    y="345"
                    textAnchor="middle"
                    className="text-xs fill-current"
                    fontSize="10"
                  >
                    FinFlow
                  </text>
                  <text
                    x="275"
                    y="345"
                    textAnchor="middle"
                    className="text-xs fill-current"
                    fontSize="10"
                  >
                    HealthTrack
                  </text>
                </svg>
              </div>
            </div>

            {/* Earnings Distribution (Pie) */}
            <div className="rounded-xl sm:rounded-2xl bg-white dark:bg-card/80 border border-slate-200 dark:border-slate-700 p-4 sm:p-6 space-y-4">
              <h2 className="text-lg font-semibold text-foreground">
                Earnings Distribution
              </h2>

              <div className="flex justify-center items-center py-6 sm:py-8 overflow-x-auto">
                <svg
                  viewBox="0 0 400 300"
                  className="w-full h-full max-w-xs sm:max-w-sm"
                >
                  {/* Pie slices using path */}
                  {/* NeuralSync AI (45000 = 42.5%) - Blue */}
                  <path
                    d="M 200 150 L 200 50 A 100 100 0 0 1 317.9 82.1 Z"
                    fill="#3B82F6"
                    opacity="0.9"
                  />
                  {/* FinFlow (38000 = 35.8%) - Violet */}
                  <path
                    d="M 200 150 L 317.9 82.1 A 100 100 0 0 1 249.2 261.8 Z"
                    fill="#A855F7"
                    opacity="0.9"
                  />
                  {/* HealthTrack Pro (22000 = 20.8%) - Pink */}
                  <path
                    d="M 200 150 L 249.2 261.8 A 100 100 0 0 1 200 50 Z"
                    fill="#EC4899"
                    opacity="0.9"
                  />

                  {/* Labels */}
                  <text
                    x="280"
                    y="60"
                    className="text-xs fill-current"
                    fontSize="12"
                    fontWeight="600"
                    fill="#3B82F6"
                  >
                    NeuralSync: $45K
                  </text>
                  <text
                    x="180"
                    y="280"
                    className="text-xs fill-current"
                    fontSize="12"
                    fontWeight="600"
                    fill="#A855F7"
                  >
                    FinFlow: $38K
                  </text>
                  <text
                    x="160"
                    y="120"
                    className="text-xs fill-current"
                    fontSize="12"
                    fontWeight="600"
                    fill="#EC4899"
                  >
                    HealthTrack: $22K
                  </text>
                </svg>
              </div>
            </div>
          </div>

          {/* Project Earnings Breakdown */}
          <div className="space-y-3 sm:space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg sm:text-xl font-semibold text-foreground">
                Project Earnings Breakdown
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Detailed view with contribution-to-value mapping
              </p>
            </div>

            {projects.map((project) => (
              <div
                key={project.id}
                className="rounded-xl sm:rounded-2xl bg-white dark:bg-card/80 border border-slate-200 dark:border-slate-700 p-4 sm:p-6 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base sm:text-lg font-semibold text-foreground">
                      {project.name}
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                      {project.equity} equity • {project.revenueShare} revenue
                      share
                    </p>
                  </div>
                  <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 text-sm">
                    <Eye className="h-4 w-4" />
                    <span className="font-medium">Details</span>
                  </button>
                </div>

                {/* Earnings Metrics */}
                <div className="grid grid-cols-3 gap-2 sm:gap-4">
                  <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 p-3 sm:p-4 space-y-1">
                    <p className="text-xs text-muted-foreground">Earned</p>
                    <p className="text-lg sm:text-2xl font-bold text-emerald-600">
                      ${(project.earned / 1000).toFixed(0)}K
                    </p>
                  </div>
                  <div className="rounded-lg bg-orange-50 dark:bg-orange-950/20 p-3 sm:p-4 space-y-1">
                    <p className="text-xs text-muted-foreground">Pending</p>
                    <p className="text-lg sm:text-2xl font-bold text-orange-600">
                      ${(project.pending / 1000).toFixed(1)}K
                    </p>
                  </div>
                  <div className="rounded-lg bg-violet-50 dark:bg-violet-950/20 p-3 sm:p-4 space-y-1">
                    <p className="text-xs text-muted-foreground">Equity</p>
                    <p className="text-lg sm:text-2xl font-bold text-violet-600">
                      {project.equityPercent}
                    </p>
                  </div>
                </div>

                {/* Impact Analysis */}
                <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-3 sm:p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <ZapIcon className="h-4 sm:h-5 w-4 sm:w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    <h4 className="font-semibold text-blue-900 dark:text-blue-300 text-xs sm:text-sm">
                      Impact Analysis
                    </h4>
                  </div>
                  <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-400">
                    {project.impact}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Upcoming Payouts */}
          <div className="space-y-3 sm:space-y-4">
            <h2 className="text-lg sm:text-xl font-semibold text-foreground">
              Upcoming Payouts
            </h2>

            <div className="space-y-2 sm:space-y-3">
              {upcomingPayouts.map((payout) => (
                <div
                  key={payout.id}
                  className="rounded-lg sm:rounded-xl bg-white dark:bg-card/80 border border-slate-200 dark:border-slate-700 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 hover:shadow-lg transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground text-sm sm:text-base">
                      {payout.project}
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {payout.milestone}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Due: {payout.dueDate}
                    </p>
                  </div>
                  <p className="text-lg sm:text-xl font-bold text-emerald-600 flex-shrink-0">
                    ${(payout.amount / 1000).toFixed(1)}K
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default EarningsPage;
