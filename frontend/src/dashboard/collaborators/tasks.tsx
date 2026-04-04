import { useState } from "react";
import { ChevronRight, Filter, Clock, ArrowUpDown } from "lucide-react";
import CollaboratorSidebar from "@/components/CollaboratorSidebar";
import MobileNavBar from "@/components/MobileNavBar";

interface Task {
  id: number;
  title: string;
  project: string;
  projectIcon: string;
  priority: "critical" | "high" | "medium" | "low";
  status: "pending" | "in-progress" | "blocked";
  impact: number;
  deadline: string;
  dependencies: number;
  whyMatters: string;
  blockedBy?: string[];
}

const AITaskCenter = () => {
  const [selectedProject, setSelectedProject] = useState("all");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const tasks: Task[] = [
    {
      id: 1,
      title: "Optimize ML model accuracy for HealthTrack",
      project: "HealthTrack Pro",
      projectIcon: "🏥",
      priority: "critical",
      status: "pending",
      impact: 95,
      deadline: "2026-04-04",
      dependencies: 1,
      whyMatters:
        "Critical deadline tomorrow. Investor demo depends on this. High visibility milestone.",
      blockedBy: ["Data pipeline completion"],
    },
    {
      id: 2,
      title: "Complete Stripe webhook integration",
      project: "FinFlow",
      projectIcon: "💰",
      priority: "high",
      status: "pending",
      impact: 88,
      deadline: "2026-04-06",
      dependencies: 1,
      whyMatters:
        "Blocks 3 other team members. Payment flow is core feature for beta launch.",
      blockedBy: ["API keys from founder"],
    },
    {
      id: 3,
      title: "Review and merge design system PR",
      project: "NeuralSync AI",
      projectIcon: "🧠",
      priority: "high",
      status: "pending",
      impact: 82,
      deadline: "2026-04-05",
      dependencies: 0,
      whyMatters:
        "Unblocks 2 designers and 4 developers. Quick win with high team impact.",
    },
    {
      id: 4,
      title: "Implement real-time notifications",
      project: "NeuralSync AI",
      projectIcon: "🧠",
      priority: "medium",
      status: "in-progress",
      impact: 75,
      deadline: "2026-04-10",
      dependencies: 1,
      whyMatters:
        "Part of v2.0 release. Improves user engagement significantly.",
      blockedBy: ["WebSocket setup"],
    },
    {
      id: 5,
      title: "Write API documentation",
      project: "FinFlow",
      projectIcon: "💰",
      priority: "medium",
      status: "pending",
      impact: 68,
      deadline: "2026-04-12",
      dependencies: 0,
      whyMatters:
        "Important for external integrations but not blocking current sprint.",
    },
    {
      id: 6,
      title: "Update component library",
      project: "NeuralSync AI",
      projectIcon: "🧠",
      priority: "low",
      status: "pending",
      impact: 45,
      deadline: "2026-04-15",
      dependencies: 0,
      whyMatters: "Good to have but low impact on current milestones.",
    },
  ];

  const projects = [
    { name: "All Projects", id: "all", count: 6 },
    { name: "NeuralSync AI", id: "neuralsync", count: 3, icon: "🧠" },
    { name: "FinFlow", id: "finflow", count: 2, icon: "💰" },
    { name: "HealthTrack Pro", id: "healthtrack", count: 1, icon: "🏥" },
  ];

  const stats = [
    {
      count: tasks.filter((t) => t.priority === "critical").length,
      label: "Critical",
      color: "text-rose-600 dark:text-rose-400",
      bgColor: "bg-rose-50 dark:bg-rose-950/20",
    },
    {
      count: tasks.filter((t) => t.priority === "high").length,
      label: "High Priority",
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-50 dark:bg-amber-950/20",
    },
    {
      count: tasks.filter((t) => t.status === "in-progress").length,
      label: "In Progress",
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-50 dark:bg-blue-950/20",
    },
    {
      count: 0,
      label: "Completed",
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-50 dark:bg-emerald-950/20",
    },
  ];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical":
        return "border-rose-500/50 bg-rose-50 dark:bg-rose-950/20";
      case "high":
        return "border-amber-500/50 bg-amber-50 dark:bg-amber-950/20";
      case "medium":
        return "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/50";
      case "low":
        return "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/30";
      default:
        return "border-border";
    }
  };

  const getPrioritytBadgeColor = (priority: string) => {
    switch (priority) {
      case "critical":
        return "bg-rose-500 text-white";
      case "high":
        return "bg-amber-500 text-white";
      case "medium":
        return "bg-slate-600 dark:bg-slate-500 text-white";
      case "low":
        return "bg-slate-400 text-white";
      default:
        return "bg-slate-500 text-white";
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "pending":
        return "text-slate-600 dark:text-slate-400";
      case "in-progress":
        return "text-blue-600 dark:text-blue-400";
      case "blocked":
        return "text-rose-600 dark:text-rose-400";
      default:
        return "text-slate-600 dark:text-slate-400";
    }
  };

  const filteredTasks =
    selectedProject === "all"
      ? tasks
      : tasks.filter(
          (t) =>
            t.projectIcon ===
            projects.find((p) => p.id === selectedProject)?.icon,
        );

  const sortedTasks = [...filteredTasks].sort((a, b) => b.impact - a.impact);

  return (
    <div className="min-h-dvh w-full flex flex-col bg-background text-foreground overflow-hidden md:flex-row">
      {/* Mobile Navbar */}
      <MobileNavBar
        title="Task Center"
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
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-4 md:py-6 lg:py-8 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
            <div className="space-y-1 sm:space-y-2 flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-foreground">
                Task Command Center
              </h1>
              <p className="text-xs sm:text-sm lg:text-base text-muted-foreground">
                Prioritized by impact and urgency
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <button className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-card/50 hover:bg-slate-100 dark:hover:bg-card text-slate-900 dark:text-foreground font-medium text-xs sm:text-sm transition-colors">
                <Filter className="h-4 w-4 flex-shrink-0" />
                <span className="hidden sm:inline">Filter</span>
              </button>
              <button className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-card/50 hover:bg-slate-100 dark:hover:bg-card text-slate-900 dark:text-foreground font-medium text-xs sm:text-sm transition-colors">
                <ArrowUpDown className="h-4 w-4 flex-shrink-0" />
                <span className="hidden sm:inline">Sort</span>
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className={`rounded-lg sm:rounded-2xl border border-border px-3 sm:px-6 py-3 sm:py-5 ${stat.bgColor}`}
              >
                <p
                  className={`text-xl sm:text-2xl lg:text-3xl font-bold ${stat.color}`}
                >
                  {stat.count}
                </p>
                <p className="text-[0.65rem] sm:text-xs lg:text-sm text-muted-foreground mt-1 sm:mt-2">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-[250px_1fr] gap-4 lg:gap-6">
            {/* Left Sidebar - Filter */}
            <div className="rounded-lg sm:rounded-2xl bg-white dark:bg-card/80 border border-border px-4 sm:px-6 py-4 sm:py-6 h-fit space-y-4">
              <h2 className="text-sm sm:text-base font-semibold text-foreground flex items-center gap-2">
                <Filter className="h-4 sm:h-5 w-4 sm:h-5 flex-shrink-0" />
                Filter by Project
              </h2>

              <div className="space-y-1.5 sm:space-y-2">
                {projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => setSelectedProject(project.id)}
                    className={`w-full text-left px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl border transition-colors ${
                      selectedProject === project.id
                        ? "border-violet-500 bg-violet-500/10 text-violet-700 dark:text-violet-400 font-medium"
                        : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                        {project.icon && (
                          <span className="text-base sm:text-lg flex-shrink-0">
                            {project.icon}
                          </span>
                        )}
                        <span className="text-xs sm:text-sm font-medium truncate">
                          {project.name}
                        </span>
                      </div>
                      <span className="text-[0.6rem] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex-shrink-0">
                        ({project.count})
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Right Content - Tasks */}
            <div className="space-y-3 sm:space-y-4">
              {/* Sort Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
                <h2 className="text-base sm:text-lg font-semibold text-foreground">
                  Tasks (AI Ranked)
                </h2>
                <button className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-violet-500 hover:bg-violet-600 text-white font-medium text-xs sm:text-sm transition-colors shadow-lg shadow-violet-500/20 w-fit">
                  ✨ AI Optimized
                </button>
              </div>

              {/* Tasks List */}
              <div className="space-y-3 sm:space-y-4">
                {sortedTasks.map((task) => (
                  <div
                    key={task.id}
                    className={`rounded-lg sm:rounded-2xl border p-3 sm:p-4 lg:p-6 space-y-3 sm:space-y-4 bg-white dark:bg-slate-900/50 ${getPriorityColor(
                      task.priority,
                    )}`}
                  >
                    {/* Task Header */}
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
                          <span className="text-lg sm:text-xl flex-shrink-0">
                            {task.projectIcon}
                          </span>
                          <h3 className="font-semibold text-foreground text-sm sm:text-base lg:text-lg break-words">
                            {task.title}
                          </h3>
                        </div>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          {task.project}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                        <span
                          className={`text-[0.6rem] sm:text-xs font-semibold uppercase px-2 sm:px-3 py-1 rounded-lg ${getPrioritytBadgeColor(
                            task.priority,
                          )}`}
                        >
                          {task.priority}
                        </span>
                        <span
                          className={`text-[0.6rem] sm:text-xs font-semibold uppercase px-2 sm:px-3 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 ${getStatusBadgeColor(
                            task.status,
                          )}`}
                        >
                          {task.status}
                        </span>
                      </div>
                    </div>

                    {/* Why This Matters */}
                    <div className="bg-cyan-50 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-800 rounded-lg sm:rounded-xl p-2.5 sm:p-4 flex items-start gap-2 sm:gap-3">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500 shrink-0 mt-0.5 text-xs font-bold flex-shrink-0">
                        💡
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm font-semibold text-cyan-900 dark:text-cyan-300">
                          Why this matters:{" "}
                          <span className="font-normal text-cyan-800 dark:text-cyan-400 block mt-0.5">
                            {task.whyMatters}
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Task Details Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
                      <div className="space-y-1.5 sm:space-y-2">
                        <p className="text-xs text-muted-foreground font-semibold">
                          Impact Score
                        </p>
                        <div className="space-y-1">
                          <div className="h-2 rounded-full bg-slate-300 dark:bg-slate-700 overflow-hidden">
                            <div
                              className="h-full bg-linear-to-r from-slate-800 to-slate-900 dark:from-cyan-500 dark:to-violet-500"
                              style={{ width: `${task.impact}%` }}
                            />
                          </div>
                          <p className="text-xs sm:text-sm font-semibold text-foreground">
                            {task.impact}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-1.5 sm:space-y-2">
                        <p className="text-xs text-muted-foreground font-semibold">
                          Deadline
                        </p>
                        <p className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-1">
                          📅{" "}
                          {new Date(task.deadline).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      </div>

                      <div className="space-y-1.5 sm:space-y-2">
                        <p className="text-xs text-muted-foreground font-semibold">
                          Dependencies
                        </p>
                        <p className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-1">
                          🔗 {task.dependencies}
                        </p>
                      </div>
                    </div>

                    {/* Blocked By */}
                    {task.blockedBy && task.blockedBy.length > 0 && (
                      <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg sm:rounded-xl p-2.5 sm:p-4 space-y-1.5 sm:space-y-2">
                        <p className="text-xs text-muted-foreground font-semibold flex items-center gap-2">
                          <Clock className="h-3 sm:h-4 w-3 sm:w-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                          Blocked by:
                        </p>
                        <ul className="space-y-0.5 sm:space-y-1">
                          {task.blockedBy.map((blocker, idx) => (
                            <li
                              key={idx}
                              className="text-xs sm:text-sm text-yellow-800 dark:text-yellow-300"
                            >
                              • {blocker}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 pt-2">
                      <button className="flex-1 rounded-lg bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white font-semibold py-2 sm:py-3 text-xs sm:text-sm transition-colors flex items-center justify-center gap-1.5">
                        Start Task
                        <ChevronRight className="h-3 sm:h-4 w-3 sm:w-4" />
                      </button>
                      <button className="w-full sm:w-auto rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-foreground font-medium py-2 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm transition-colors">
                        Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AITaskCenter;
