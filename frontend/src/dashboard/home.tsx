import {
  Users,
  Target,
  Bell,
  MessageCircleMore,
  Search,
  Lightbulb,
} from "lucide-react";
import Sidebar from "../components/Sidebar";
import MobileMenuButton from "../components/MobileMenuButton";

const stats = [
  {
    label: "Active Projects",
    value: "3",
    helper: "+2 this week",
    iconBg: "bg-[#7c3aed]",
  },
  {
    label: "Team Members",
    value: "12",
    helper: "4 pending invites",
    iconBg: "bg-[#38bdf8]",
  },
  {
    label: "Market Readiness",
    value: "68%",
    helper: "+12% this month",
    iconBg: "bg-emerald-500",
  },
  {
    label: "Match Score",
    value: "87%",
    helper: "Top 10%",
    iconBg: "bg-orange-400",
  },
];

const steps = [
  { label: "Idea Validated", status: "complete", progress: 100 },
  { label: "Team Building", status: "active", progress: 65 },
  { label: "MVP Development", status: "active", progress: 32 },
  { label: "Market Testing", status: "upcoming", progress: 0 },
  { label: "Launch Ready", status: "upcoming", progress: 0 },
];

const insights = [
  {
    title: "Complete your pitch deck",
    detail: "3 slides remaining",
    progress: 78,
  },
  {
    title: "Schedule investor meeting",
    detail: "2 investors interested",
    progress: 52,
  },
  {
    title: "Review collaboration requests",
    detail: "5 pending requests",
    progress: 34,
  },
];

const recentUpdates = [
  {
    initials: "SC",
    name: "Sarah Chen",
    action: "pushed to main in",
    project: "AI Task Manager",
    tag: "code",
  },
  {
    initials: "MR",
    name: "Mike Ross",
    action: "completed MVP milestone in",
    project: "FinTech Dashboard",
    tag: "milestone",
  },
  {
    initials: "EW",
    name: "Emma Wilson",
    action: "invited 2 new collaborators in",
    project: "HealthHub",
    tag: "team",
  },
];

const Dashboard = () => {
  return (
    <div className="min-h-dvh w-full flex bg-background text-foreground">
      <Sidebar />

      {/* Main content */}
      <main className="flex-1 min-h-dvh overflow-y-auto bg-linear-to-b from-slate-100 via-indigo-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="max-w-6xl mx-auto px-4 lg:px-8 py-5 lg:py-7 space-y-6">
          {/* Top bar */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3 flex-1">
              <MobileMenuButton />
              <div className="flex-1 flex items-center gap-3 rounded-2xl bg-card border border-border px-3 py-2.5">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  placeholder="Search projects, people, ideas..."
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground text-foreground"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button className="flex h-9 w-9 items-center justify-center rounded-full bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
                <MessageCircleMore className="h-4 w-4" />
              </button>
              <button className="flex h-9 w-9 items-center justify-center rounded-full bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
                <Bell className="h-4 w-4" />
              </button>
              <button className="inline-flex items-center gap-2 rounded-full bg-[#7c3aed] px-4 py-2 text-sm font-medium shadow-lg shadow-[#7c3aed]/40 hover:bg-[#7c3aed]/90 text-primary-foreground">
                <Lightbulb className="h-4 w-4" />
                <span>New Idea</span>
              </button>
            </div>
          </div>

          {/* Welcome + stats */}
          <section className="space-y-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">
                Welcome back, Demo User
              </h1>
              <p className="text-sm text-muted-foreground">
                Here&apos;s what&apos;s happening with your projects.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl bg-card border border-border px-4 py-4 flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.iconBg} text-white`}
                    >
                      {stat.label === "Active Projects" && (
                        <Target className="h-5 w-5" />
                      )}
                      {stat.label === "Team Members" && (
                        <Users className="h-5 w-5" />
                      )}
                      {stat.label === "Market Readiness" && (
                        <Lightbulb className="h-5 w-5" />
                      )}
                      {stat.label === "Match Score" && (
                        <Target className="h-5 w-5" />
                      )}
                    </div>
                    <p className="text-2xl font-semibold text-foreground">
                      {stat.value}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      {stat.label}
                    </p>
                    <p className="text-[0.7rem] text-muted-foreground">
                      {stat.helper}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Middle panels */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6">
            {/* Market-Ready Path */}
            <div className="rounded-2xl bg-card border border-border px-5 py-5 space-y-4">
              <h2 className="text-sm font-semibold text-foreground">
                Market-Ready Path
              </h2>
              <ol className="space-y-3 text-sm">
                {steps.map((step, index) => (
                  <li key={step.label} className="flex items-start gap-3">
                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                        step.status === "complete"
                          ? "bg-emerald-500 text-white"
                          : step.status === "active"
                            ? "bg-slate-300 text-slate-700 dark:bg-slate-800 dark:text-slate-200 border border-slate-400 dark:border-slate-600"
                            : "bg-slate-200 dark:bg-slate-900 text-slate-600 dark:text-slate-500 border border-slate-300 dark:border-slate-700"
                      }`}
                    >
                      {index + 1}
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-foreground">{step.label}</p>
                      <div className="h-1.5 rounded-full bg-slate-300 dark:bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            step.status === "complete"
                              ? "bg-emerald-400"
                              : step.status === "active"
                                ? "bg-[#38bdf8]"
                                : "bg-muted-foreground/40"
                          }`}
                          style={{ width: `${step.progress}%` }}
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* Insights & Recommendations */}
            <div className="rounded-2xl bg-card border border-border px-5 py-5 space-y-4">
              <h2 className="text-sm font-semibold text-foreground">
                AI Insights &amp; Recommendations
              </h2>
              <div className="space-y-4 text-sm">
                {insights.map((item) => (
                  <div key={item.title} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-foreground">{item.title}</p>
                      <span className="text-[0.7rem] text-muted-foreground">
                        {item.detail}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-300 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#38bdf8]"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Bottom grid */}
          <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)] gap-5 lg:gap-6">
            {/* Recent Updates */}
            <div className="rounded-2xl bg-card border border-border px-5 py-5 space-y-4">
              <h2 className="text-sm font-semibold text-foreground">
                Recent Updates
              </h2>
              <div className="space-y-3 text-sm">
                {recentUpdates.map((update) => (
                  <div
                    key={update.project}
                    className="flex items-center gap-3 rounded-xl bg-slate-200 dark:bg-slate-800/50 px-3 py-2.5"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-300 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-white">
                      {update.initials}
                    </div>
                    <div className="flex-1">
                      <p className="text-foreground">
                        <span className="font-medium">{update.name}</span>{" "}
                        <span className="text-muted-foreground">
                          {update.action}
                        </span>{" "}
                        <span className="font-medium">{update.project}</span>
                      </p>
                      <p className="text-[0.7rem] text-muted-foreground">
                        Just now
                      </p>
                    </div>
                    <span className="text-[0.7rem] px-2 py-0.5 rounded-full bg-slate-300 dark:bg-slate-800 text-slate-700 dark:text-slate-300 capitalize">
                      {update.tag}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right column cards */}
            <div className="grid grid-cols-1 gap-4">
              <div className="rounded-2xl bg-card border border-border px-4 py-4 space-y-2">
                <p className="text-sm font-semibold text-foreground">
                  Find Collaborators
                </p>
                <p className="text-xs text-muted-foreground">
                  5 new matches available
                </p>
                <button className="text-xs text-cyan-600 dark:text-[#38bdf8] hover:text-cyan-700 dark:hover:text-[#7dd3fc] font-medium">
                  View matches →
                </button>
              </div>

              <div className="rounded-2xl bg-card border border-border px-4 py-4 space-y-2">
                <p className="text-sm font-semibold text-foreground">
                  Active Workspaces
                </p>
                <p className="text-xs text-muted-foreground">
                  3 projects in progress
                </p>
                <button className="text-xs text-cyan-600 dark:text-[#38bdf8] hover:text-cyan-700 dark:hover:text-[#7dd3fc] font-medium">
                  Go to workspace →
                </button>
              </div>

              <div className="rounded-2xl bg-card border border-border px-4 py-4 space-y-2">
                <p className="text-sm font-semibold text-foreground">
                  Investor Network
                </p>
                <p className="text-xs text-muted-foreground">
                  2 investors interested
                </p>
                <button className="text-xs text-cyan-600 dark:text-[#38bdf8] hover:text-cyan-700 dark:hover:text-[#7dd3fc] font-medium">
                  View investors →
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
