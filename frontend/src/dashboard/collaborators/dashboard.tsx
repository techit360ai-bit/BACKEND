import {
  Bell,
  MessageCircleMore,
  Search,
  CheckCircle,
  Lightbulb,
  TrendingUp,
  AlertTriangle,
  Zap,
  HelpCircle,
} from "lucide-react";
import { useState } from "react";
import CollaboratorSidebar from "@/components/CollaboratorSidebar";
import MobileNavBar from "@/components/MobileNavBar";
import AICopilot from "@/components/AICopilot";

const CollaboratorDashboard = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const aiIntelligence = [
    {
      icon: CheckCircle,
      label: "You are active in 3 startups this week",
      color: "text-emerald-500",
    },
    {
      icon: AlertTriangle,
      label: "2 projects need urgent attention",
      color: "text-amber-500",
    },
    {
      icon: Lightbulb,
      label: "1 new opportunity matches your skills",
      color: "text-cyan-500",
    },
    {
      icon: TrendingUp,
      label: "Your execution score increased by +4",
      color: "text-violet-500",
    },
  ];

  const startups = [
    {
      name: "NeuralSync AI",
      role: "Lead Frontend Engineer",
      progress: 78,
      status: "healthy",
      icon: "🧠",
      tasks: 8,
      dueDate: "2026-04-15",
    },
    {
      name: "FinFlow",
      role: "Full-Stack Developer",
      progress: 45,
      status: "risk",
      icon: "💰",
      tasks: 12,
      dueDate: "2026-04-08",
    },
    {
      name: "HealthTrack Pro",
      role: "ML Engineer",
      progress: 23,
      status: "critical",
      icon: "🏥",
      tasks: 15,
      dueDate: "2026-04-05",
    },
  ];

  const urgentTasks = [
    {
      title: "Optimize ML model accuracy for HealthTrack",
      project: "HealthTrack Pro",
      severity: "critical",
      deadline:
        "Critical deadline tomorrow. Investor demo depends on this. High visibility milestone.",
      impact: 95,
      dueDate: "2026-04-04",
    },
    {
      title: "Complete Stripe webhook integration",
      project: "FinFlow",
      severity: "high",
      deadline:
        "Blocks 3 other team members. Payment flow is core feature for beta launch.",
      impact: 88,
      dueDate: "2026-04-06",
    },
  ];

  const aiRecommendations = [
    {
      type: "warning",
      message:
        "You complete tasks fast but delay feedback responses. This reduces your collaboration score.",
    },
    {
      type: "success",
      message:
        "Your recent work on NeuralSync resulted in 18% increase in user retention. Great impact!",
    },
    {
      type: "info",
      message:
        "Consider taking on the CloudVault project - it matches 92% of your skills and offers strong equity.",
    },
  ];

  const recentActivity = [
    {
      icon: "🧠",
      title: "NeuralSync AI",
      action: "Merged PR #234 - Added WebSocket integration",
      time: "2h ago",
    },
    {
      icon: "💰",
      title: "FinFlow",
      action: "Working on Stripe API integration",
      time: "2h ago",
    },
    {
      icon: "🏥",
      title: "HealthTrack Pro",
      action: "Data preprocessing pipeline built",
      time: "2h ago",
    },
  ];

  const stats = [
    { label: "Reputation", value: "94", color: "text-blue-500" },
    { label: "Execution", value: "87", color: "text-purple-500" },
    { label: "Lifetime", value: "$128K", color: "text-emerald-500" },
    { label: "Pending", value: "$12.3K", color: "text-orange-500" },
    { label: "Active", value: "3", color: "text-slate-500" },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "border-emerald-500/50 bg-emerald-500/10";
      case "risk":
        return "border-amber-500/50 bg-amber-500/10";
      case "critical":
        return "border-rose-500/50 bg-rose-500/10";
      default:
        return "border-border";
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/50";
      case "risk":
        return "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/50";
      case "critical":
        return "bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/50";
      default:
        return "";
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-rose-500/10 border-rose-500/50";
      case "high":
        return "bg-amber-500/10 border-amber-500/50";
      default:
        return "bg-muted border-border";
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/50";
      case "high":
        return "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/50";
      default:
        return "";
    }
  };

  const getRecommendationColor = (type: string) => {
    switch (type) {
      case "warning":
        return "border-l-4 border-l-amber-500 bg-amber-500/10 dark:bg-amber-950/30";
      case "success":
        return "border-l-4 border-l-emerald-500 bg-emerald-500/10 dark:bg-emerald-950/30";
      case "info":
        return "border-l-4 border-l-cyan-500 bg-cyan-500/10 dark:bg-cyan-950/30";
      default:
        return "";
    }
  };

  return (
    <div className="min-h-dvh w-full flex flex-col bg-background text-foreground overflow-hidden md:flex-row">
      {/* Mobile Navbar */}
      <MobileNavBar
        title="Command Center"
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
      <main className="flex-1 min-h-dvh overflow-y-auto bg-linear-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 md:ml-64 xl:ml-72 pt-16 md:pt-0 relative">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-4 md:py-6 lg:py-8 space-y-6">
          {/* Header with Search and Actions */}
          <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2 sm:gap-3 rounded-lg sm:rounded-2xl bg-slate-100 dark:bg-card/50 border border-slate-200 dark:border-border/30 px-3 sm:px-4 py-2 sm:py-3 backdrop-blur-sm hover:bg-slate-200 dark:hover:bg-card/60 transition-colors">
              <Search className="h-4 w-4 text-slate-600 dark:text-muted-foreground flex-shrink-0" />
              <input
                placeholder="Search projects..."
                className="flex-1 bg-transparent text-xs sm:text-sm outline-none placeholder:text-slate-500 dark:placeholder:text-muted-foreground text-slate-900 dark:text-foreground"
              />
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <AICopilot />
              <button className="flex h-9 sm:h-10 w-9 sm:w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-card/50 border border-slate-200 dark:border-border/30 text-slate-600 dark:text-muted-foreground hover:bg-slate-200 dark:hover:bg-card transition-colors backdrop-blur-sm flex-shrink-0">
                <HelpCircle className="h-4 sm:h-5 w-4 sm:w-5" />
              </button>
              <button className="hidden sm:flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-card/50 border border-slate-200 dark:border-border/30 text-slate-600 dark:text-muted-foreground hover:bg-slate-200 dark:hover:bg-card transition-colors backdrop-blur-sm">
                <MessageCircleMore className="h-5 w-5" />
              </button>
              <button className="hidden sm:flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-card/50 border border-slate-200 dark:border-border/30 text-slate-600 dark:text-muted-foreground hover:bg-slate-200 dark:hover:bg-card transition-colors backdrop-blur-sm relative">
                <Bell className="h-5 w-5" />
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-rose-500"></span>
              </button>
            </div>
          </div>

          {/* AI Intelligence Brief */}
          <section className="rounded-xl sm:rounded-3xl bg-linear-to-br from-cyan-500/15 via-cyan-500/10 to-blue-500/10 dark:from-cyan-500/20 dark:via-slate-900/40 dark:to-slate-900/40 border border-cyan-500/30 dark:border-cyan-500/30 backdrop-blur-md px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex h-9 sm:h-10 w-9 sm:w-10 items-center justify-center rounded-lg sm:rounded-2xl bg-linear-to-br from-pink-500 to-fuchsia-500 text-white shadow-lg shadow-pink-500/30 dark:shadow-pink-500/30 flex-shrink-0">
                  <Zap className="h-4 sm:h-5 w-4 sm:w-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">
                    AI Intelligence Brief
                  </h2>
                  <p className="text-xs text-muted-foreground">Today</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
              {aiIntelligence.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div
                    key={idx}
                    className="flex items-start gap-3 rounded-xl bg-white/30 dark:bg-white/5 p-3 pl-4"
                  >
                    <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${item.color}`} />
                    <p className="text-sm text-slate-900 dark:text-foreground">
                      {item.label}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Profile Section with Stats */}
          <section className="space-y-4">
            <div className="rounded-lg sm:rounded-2xl bg-white dark:bg-card/80 border border-border px-4 sm:px-6 py-4 sm:py-5 space-y-4">
              <div className="flex items-center justify-between gap-3 sm:gap-4 flex-wrap">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="flex h-12 sm:h-14 w-12 sm:w-14 items-center justify-center rounded-lg sm:rounded-xl bg-linear-to-br from-violet-500 to-cyan-500 text-white font-semibold text-base sm:text-lg shadow-lg shadow-violet-500/30 dark:shadow-violet-600/30 flex-shrink-0">
                    AC
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-foreground">
                      Alex Chen
                    </h3>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="px-2 sm:px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-700 dark:text-blue-300 text-xs font-medium border border-blue-500/50">
                        Frontend
                      </span>
                      <span className="px-2 sm:px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-700 dark:text-purple-300 text-xs font-medium border border-purple-500/50">
                        ML
                      </span>
                      <span className="px-2 sm:px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 text-xs font-medium border border-cyan-500/50">
                        Product
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3 pt-2 border-t border-border/50">
                {stats.map((stat) => (
                  <div key={stat.label} className="text-center space-y-1">
                    <p
                      className={`text-lg sm:text-xl lg:text-2xl font-bold ${stat.color}`}
                    >
                      {stat.value}
                    </p>
                    <p className="text-[0.65rem] sm:text-[0.7rem] text-slate-600 dark:text-muted-foreground whitespace-nowrap">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Your Startups */}
          <section className="space-y-3 sm:space-y-4">
            <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-foreground">
              Your Startups
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {startups.map((startup) => (
                <div
                  key={startup.name}
                  className={`rounded-lg sm:rounded-2xl border px-4 sm:px-5 py-4 sm:py-5 space-y-4 bg-white dark:bg-card/60 backdrop-blur-sm ${getStatusColor(
                    startup.status,
                  )}`}
                >
                  <div className="flex items-start justify-between gap-2 sm:gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-xl sm:text-2xl">
                          {startup.icon}
                        </span>
                        <h3 className="font-semibold text-slate-900 dark:text-foreground text-sm sm:text-base">
                          {startup.name}
                        </h3>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-muted-foreground">
                        {startup.role}
                      </p>
                    </div>
                    <span
                      className={`text-[0.6rem] sm:text-[0.65rem] font-semibold uppercase px-2 py-1 rounded-lg border whitespace-nowrap flex-shrink-0 ${getStatusBadgeColor(
                        startup.status,
                      )}`}
                    >
                      {startup.status}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 dark:text-muted-foreground">
                        Progress
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-foreground">
                        {startup.progress}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-linear-to-r from-slate-700 to-slate-800"
                        style={{ width: `${startup.progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-2 text-xs pt-2 border-t border-border/30">
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-muted-foreground">
                        {startup.tasks} tasks
                      </span>
                      <span className="text-slate-600 dark:text-muted-foreground">
                        Due {startup.dueDate}
                      </span>
                    </div>
                  </div>

                  <button className="w-full rounded-lg bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white font-medium py-2 sm:py-2.5 text-xs sm:text-sm transition-colors">
                    Jump In →
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Urgent Tasks and AI Recommendations */}
          <section className="grid grid-cols-1 xl:grid-cols-[2fr_1.3fr] gap-4 sm:gap-5">
            {/* Urgent Tasks */}
            <div className="rounded-lg sm:rounded-2xl bg-white dark:bg-card/80 border border-border px-4 sm:px-6 py-4 sm:py-6 space-y-4">
              <h2 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 sm:h-5 w-4 sm:w-5 text-rose-500 flex-shrink-0" />
                Urgent Tasks (AI Ranked)
              </h2>

              <div className="space-y-2 sm:space-y-3">
                {urgentTasks.map((task, idx) => (
                  <div
                    key={idx}
                    className={`rounded-lg sm:rounded-xl p-3 sm:p-4 space-y-2 border ${getSeverityColor(
                      task.severity,
                    )}`}
                  >
                    <div className="flex items-start justify-between gap-2 sm:gap-3">
                      <div className="space-y-1 flex-1 min-w-0">
                        <p className="font-medium text-slate-900 dark:text-foreground text-xs sm:text-sm">
                          {task.title}
                        </p>
                        <p className="text-xs text-slate-600 dark:text-muted-foreground">
                          {task.project}
                        </p>
                      </div>
                      <span
                        className={`text-[0.6rem] sm:text-[0.65rem] font-semibold uppercase px-2 py-1 rounded-lg border whitespace-nowrap flex-shrink-0 ${getSeverityBadge(
                          task.severity,
                        )}`}
                      >
                        {task.severity}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-muted-foreground leading-relaxed">
                      {task.deadline}
                    </p>
                    <div className="flex items-center justify-between pt-1 text-xs">
                      <span className="text-slate-600 dark:text-muted-foreground">
                        Impact: {task.impact}
                      </span>
                      <span className="text-slate-600 dark:text-muted-foreground">
                        {task.dueDate}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <button className="w-full mt-2 py-2 sm:py-2.5 rounded-lg border border-slate-200 dark:border-border text-slate-900 dark:text-foreground hover:bg-slate-100 dark:hover:bg-accent/30 text-xs sm:text-sm font-medium transition-colors">
                View All Tasks
              </button>
            </div>

            {/* Right Column - Recommendations */}
            <div className="rounded-lg sm:rounded-2xl bg-white dark:bg-card/80 border border-border px-4 sm:px-6 py-4 sm:py-6 space-y-4">
              <h2 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-foreground flex items-center gap-2">
                <Lightbulb className="h-4 sm:h-5 w-4 sm:w-5 text-yellow-500 flex-shrink-0" />
                AI Insights & Recommendations
              </h2>

              <div className="space-y-2 sm:space-y-3">
                {aiRecommendations.map((rec, idx) => (
                  <div
                    key={idx}
                    className={`rounded-lg sm:rounded-xl p-3 sm:p-4 space-y-2 ${getRecommendationColor(
                      rec.type,
                    )}`}
                  >
                    <p className="text-xs sm:text-sm text-slate-900 dark:text-foreground leading-relaxed">
                      {rec.message}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Recent Activity */}
          <section className="rounded-lg sm:rounded-2xl bg-white dark:bg-card/80 border border-border px-4 sm:px-6 py-4 sm:py-6 space-y-4">
            <h2 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-foreground">
              📊 Recent Activity Across Projects
            </h2>

            <div className="space-y-2 sm:space-y-3">
              {recentActivity.map((activity, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 sm:gap-4 rounded-lg sm:rounded-xl bg-slate-100 dark:bg-muted/30 p-3 sm:p-4"
                >
                  <span className="text-xl sm:text-2xl shrink-0">
                    {activity.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 dark:text-foreground text-xs sm:text-sm">
                      {activity.title}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-muted-foreground mt-0.5">
                      {activity.action}
                    </p>
                  </div>
                  <span className="text-xs text-slate-600 dark:text-muted-foreground shrink-0">
                    {activity.time}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default CollaboratorDashboard;
