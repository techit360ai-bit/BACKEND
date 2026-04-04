import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  Target,
  Zap,
} from "lucide-react";
import { useState } from "react";
import CollaboratorSidebar from "@/components/CollaboratorSidebar";
import MobileNavBar from "@/components/MobileNavBar";

const PerformancePage = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const metrics = [
    {
      label: "Execution Velocity",
      value: 87,
      change: 4,
      trend: "up",
      icon: TrendingUp,
      color: "text-emerald-600",
    },
    {
      label: "Consistency Score",
      value: 92,
      change: -2,
      trend: "down",
      icon: TrendingDown,
      color: "text-rose-600",
    },
    {
      label: "Completion Rate",
      value: 94,
      change: 0,
      trend: "flat",
      icon: Minus,
      color: "text-slate-600",
    },
    {
      label: "Collaboration Score",
      value: 78,
      change: -5,
      trend: "down",
      icon: TrendingDown,
      color: "text-rose-600",
    },
    {
      label: "Impact Score",
      value: 89,
      change: 7,
      trend: "up",
      icon: TrendingUp,
      color: "text-emerald-600",
    },
  ];

  const getTrendBadgeColor = (change: number) => {
    if (change > 0)
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
    if (change < 0)
      return "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300";
    return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400";
  };

  const performanceData = [
    {
      metric: "Execution Velocity",
      description: "How fast you deliver relative to estimates",
      value: 87,
      change: 4,
      color: "bg-blue-500",
    },
    {
      metric: "Consistency Score",
      description: "Regularity of contributions over time",
      value: 92,
      change: -2,
      color: "bg-emerald-500",
    },
    {
      metric: "Completion Rate",
      description: "Percentage of tasks completed vs assigned",
      value: 94,
      change: 0,
      color: "bg-emerald-500",
    },
    {
      metric: "Collaboration Score",
      description: "Quality of teamwork, feedback, and communication",
      value: 78,
      change: -5,
      color: "bg-blue-500",
    },
    {
      metric: "Impact Score",
      description: "Contribution to major milestones and business goals",
      value: 89,
      change: 7,
      color: "bg-blue-500",
    },
  ];

  const impactScoreData = [
    { week: "Week 1", value: 85 },
    { week: "Week 2", value: 90 },
    { week: "Week 3", value: 88 },
    { week: "Week 4", value: 98 },
  ];

  return (
    <div className="min-h-dvh w-full flex flex-col bg-background text-foreground overflow-hidden md:flex-row">
      {/* Mobile Navbar */}
      <MobileNavBar
        title="Performance"
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
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-4 md:py-6 lg:py-8 space-y-4 sm:space-y-6">
          {/* Header */}
          <div className="space-y-1 sm:space-y-2">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground">
              Execution Analytics
            </h1>
            <p className="text-xs sm:text-base text-muted-foreground">
              Track impact, velocity, and growth
            </p>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 lg:gap-4">
            {metrics.map((metric, idx) => {
              const Icon = metric.icon;
              return (
                <div
                  key={idx}
                  className="rounded-lg sm:rounded-2xl bg-white dark:bg-card/80 border border-slate-200 dark:border-slate-700 p-3 sm:p-5 space-y-2 sm:space-y-3 hover:shadow-lg transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm text-muted-foreground font-medium">
                      {metric.label}
                    </span>
                    <Icon className={`h-4 sm:h-5 w-4 sm:w-5 ${metric.color}`} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-2xl sm:text-3xl font-bold text-foreground">
                      {metric.value}
                    </p>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${getTrendBadgeColor(metric.change)}`}
                      >
                        {metric.change > 0 ? "+" : ""}
                        {metric.change}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        vs last week
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Weekly Velocity Trend */}
            <div className="rounded-2xl bg-white dark:bg-card/80 border border-slate-200 dark:border-slate-700 p-6 space-y-4">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-foreground">
                  Weekly Velocity Trend
                </h2>
                <p className="text-sm text-muted-foreground">
                  Tasks completed per week
                </p>
              </div>

              {/* Line Chart Visualization */}
              <div className="h-64 flex flex-col justify-between relative">
                <div className="absolute inset-0 grid grid-rows-5 pointer-events-none">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="border-t border-slate-200 dark:border-slate-700 flex items-center px-2"
                    >
                      <span className="text-xs text-muted-foreground">
                        {20 - i * 5}
                      </span>
                    </div>
                  ))}
                </div>

                <svg
                  viewBox="0 0 400 200"
                  className="w-full h-full"
                  preserveAspectRatio="none"
                >
                  {/* Grid lines */}
                  <line
                    x1="0"
                    y1="0"
                    x2="400"
                    y2="0"
                    stroke="currentColor"
                    strokeOpacity="0.1"
                    strokeWidth="0.5"
                  />
                  <line
                    x1="0"
                    y1="50"
                    x2="400"
                    y2="50"
                    stroke="currentColor"
                    strokeOpacity="0.1"
                    strokeWidth="0.5"
                  />
                  <line
                    x1="0"
                    y1="100"
                    x2="400"
                    y2="100"
                    stroke="currentColor"
                    strokeOpacity="0.1"
                    strokeWidth="0.5"
                  />
                  <line
                    x1="0"
                    y1="150"
                    x2="400"
                    y2="150"
                    stroke="currentColor"
                    strokeOpacity="0.1"
                    strokeWidth="0.5"
                  />

                  {/* Line path */}
                  <polyline
                    points="50,120 150,85 250,35 350,105"
                    fill="none"
                    stroke="#3B82F6"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Points */}
                  <circle cx="50" cy="120" r="4" fill="#3B82F6" />
                  <circle cx="150" cy="85" r="4" fill="#3B82F6" />
                  <circle cx="250" cy="35" r="4" fill="#3B82F6" />
                  <circle cx="350" cy="105" r="4" fill="#3B82F6" />
                </svg>
              </div>

              {/* X-axis labels */}
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Week 1</span>
                <span>Week 2</span>
                <span>Week 3</span>
                <span>Week 4</span>
              </div>
            </div>

            {/* Impact Score Over Time */}
            <div className="rounded-2xl bg-white dark:bg-card/80 border border-slate-200 dark:border-slate-700 p-6 space-y-4">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-foreground">
                  Impact Score Over Time
                </h2>
                <p className="text-sm text-muted-foreground">
                  Contribution quality
                </p>
              </div>

              {/* Bar Chart Visualization */}
              <div className="h-64 flex flex-col justify-between relative">
                <div className="absolute inset-0 grid grid-rows-5 pointer-events-none">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="border-t border-slate-200 dark:border-slate-700 flex items-center px-2"
                    >
                      <span className="text-xs text-muted-foreground">
                        {100 - i * 25}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="relative h-full flex items-flex-end justify-around px-4 pt-8">
                  {impactScoreData.map((data, idx) => (
                    <div
                      key={idx}
                      className="flex flex-col items-center flex-1 mx-1"
                    >
                      <div
                        className="flex-1 w-12 rounded-t bg-violet-500 relative"
                        style={{ height: `${(data.value / 100) * 100}%` }}
                      ></div>
                    </div>
                  ))}
                </div>
              </div>

              {/* X-axis labels */}
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Week 1</span>
                <span>Week 2</span>
                <span>Week 3</span>
                <span>Week 4</span>
              </div>
            </div>
          </div>

          {/* Performance Profile & AI Feedback */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Performance Profile */}
            <div className="rounded-2xl bg-white dark:bg-card/80 border border-slate-200 dark:border-slate-700 p-6 space-y-4">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-foreground">
                  Performance Profile
                </h2>
                <p className="text-sm text-muted-foreground">
                  Multi-dimensional view
                </p>
              </div>

              {/* Radar Chart (Pentagon) */}
              <div className="flex justify-center py-6">
                <svg
                  viewBox="0 0 300 300"
                  className="w-full max-w-xs"
                  style={{ aspectRatio: "1/1" }}
                >
                  {/* Pentagon background */}
                  <polygon
                    points="150,30 270,110 220,245 80,245 30,110"
                    fill="none"
                    stroke="currentColor"
                    strokeOpacity="0.1"
                    strokeWidth="1"
                  />

                  {/* Inner circles */}
                  <circle
                    cx="150"
                    cy="150"
                    r="100"
                    fill="none"
                    stroke="currentColor"
                    strokeOpacity="0.05"
                    strokeWidth="1"
                  />
                  <circle
                    cx="150"
                    cy="150"
                    r="50"
                    fill="none"
                    stroke="currentColor"
                    strokeOpacity="0.05"
                    strokeWidth="1"
                  />

                  {/* Data polygon */}
                  <polygon
                    points="150,65 240,130 210,215 90,215 60,130"
                    fill="#60A5FA"
                    fillOpacity="0.3"
                    stroke="#3B82F6"
                    strokeWidth="2"
                  />

                  {/* Labels */}
                  <text
                    x="150"
                    y="20"
                    textAnchor="middle"
                    className="text-xs fill-current"
                    dy="0.3em"
                  >
                    Execution Velocity
                  </text>
                  <text
                    x="265"
                    y="110"
                    textAnchor="start"
                    className="text-xs fill-current"
                    dy="0.3em"
                  >
                    Consistency
                  </text>
                  <text
                    x="225"
                    y="265"
                    textAnchor="middle"
                    className="text-xs fill-current"
                    dy="0.3em"
                  >
                    Completion
                  </text>
                  <text
                    x="75"
                    y="265"
                    textAnchor="middle"
                    className="text-xs fill-current"
                    dy="0.3em"
                  >
                    Collaboration
                  </text>
                  <text
                    x="20"
                    y="110"
                    textAnchor="end"
                    className="text-xs fill-current"
                    dy="0.3em"
                  >
                    Impact
                  </text>
                </svg>
              </div>
            </div>

            {/* AI Performance Feedback */}
            <div className="rounded-2xl border-2 border-blue-500/50 bg-blue-50/50 dark:bg-blue-950/20 p-6 space-y-4">
              <div className="flex items-center gap-3">
                <Zap className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-300">
                  AI Performance Feedback
                </h2>
              </div>

              {/* Area for Improvement */}
              <div className="rounded-lg bg-yellow-100/50 dark:bg-yellow-950/30 border border-yellow-400 p-4 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-700 dark:text-yellow-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-yellow-900 dark:text-yellow-300 text-sm">
                      Area for Improvement
                    </h3>
                    <p className="text-xs text-yellow-800 dark:text-yellow-400 mt-1">
                      You complete tasks fast but delay feedback responses. This
                      reduces your collaboration score by 5 points.
                    </p>
                  </div>
                </div>
              </div>

              {/* Strength */}
              <div className="rounded-lg bg-emerald-100/50 dark:bg-emerald-950/30 border border-emerald-400 p-4 space-y-2">
                <div className="flex items-start gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-emerald-900 dark:text-emerald-300 text-sm">
                      Strength
                    </h3>
                    <p className="text-xs text-emerald-800 dark:text-emerald-400 mt-1">
                      Your execution velocity is in the top 5% of all
                      collaborators. Keep maintaining this pace!
                    </p>
                  </div>
                </div>
              </div>

              {/* Next Milestone */}
              <div className="rounded-lg bg-blue-100/50 dark:bg-blue-900/30 border border-blue-400 p-4 space-y-2">
                <div className="flex items-start gap-2">
                  <Target className="h-5 w-5 text-blue-700 dark:text-blue-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-blue-900 dark:text-blue-300 text-sm">
                      Next Milestone
                    </h3>
                    <p className="text-xs text-blue-800 dark:text-blue-400 mt-1">
                      Complete 3 more high-impact tasks to reach "Elite
                      Contributor" status.
                    </p>
                  </div>
                </div>
              </div>

              {/* Recommended Actions */}
              <div className="rounded-lg bg-violet-100/50 dark:bg-violet-900/30 border border-violet-400 p-4 space-y-2">
                <h3 className="font-semibold text-violet-900 dark:text-violet-300 text-sm">
                  Recommended Actions:
                </h3>
                <ul className="text-xs text-violet-800 dark:text-violet-400 space-y-1 list-disc list-inside">
                  <li>Respond to pending code reviews within 24 hours</li>
                  <li>Schedule 1-on-1s with team leads</li>
                  <li>Document your recent ML model improvements</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Detailed Performance Breakdown */}
          <div className="rounded-2xl bg-white dark:bg-card/80 border border-slate-200 dark:border-slate-700 p-6 space-y-6">
            <h2 className="text-lg font-semibold text-foreground">
              Detailed Performance Breakdown
            </h2>

            <div className="space-y-6">
              {performanceData.map((item, idx) => (
                <div key={idx} className="space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">
                        {item.metric}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-2xl font-bold text-foreground">
                        {item.value}
                      </span>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold flex items-center ${getTrendBadgeColor(item.change)}`}
                      >
                        {item.change > 0 ? "+" : ""}
                        {item.change}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${item.color}`}
                      style={{ width: `${item.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PerformancePage;
