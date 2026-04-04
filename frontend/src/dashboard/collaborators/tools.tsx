import { useState } from "react";
import {
  Github,
  Figma,
  BookOpen,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Zap,
  Lock,
} from "lucide-react";
import CollaboratorSidebar from "@/components/CollaboratorSidebar";
import MobileNavBar from "@/components/MobileNavBar";

interface Tool {
  id: string;
  name: string;
  icon: React.ReactNode;
  status: "connected" | "disconnected";
  recentUpdates?: number;
  color: string;
  borderColor: string;
}

const ToolsPage = () => {
  const [syncingTools, setSyncingTools] = useState<string[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const tools: Tool[] = [
    {
      id: "github",
      name: "GitHub",
      icon: <Github className="h-8 w-8" />,
      status: "connected",
      recentUpdates: 5,
      color: "bg-slate-50 dark:bg-slate-950/50",
      borderColor: "border-emerald-500/50",
    },
    {
      id: "figma",
      name: "Figma",
      icon: <Figma className="h-8 w-8" />,
      status: "connected",
      recentUpdates: 2,
      color: "bg-slate-50 dark:bg-slate-950/50",
      borderColor: "border-emerald-500/50",
    },
    {
      id: "notion",
      name: "Notion",
      icon: <BookOpen className="h-8 w-8" />,
      status: "connected",
      recentUpdates: 8,
      color: "bg-slate-50 dark:bg-slate-950/50",
      borderColor: "border-emerald-500/50",
    },
    {
      id: "linear",
      name: "Linear",
      icon: <Lock className="h-8 w-8" />,
      status: "disconnected",
      color: "bg-slate-50 dark:bg-slate-950/50",
      borderColor: "border-slate-200 dark:border-slate-700",
    },
    {
      id: "vercel",
      name: "Vercel",
      icon: <Zap className="h-8 w-8" />,
      status: "connected",
      recentUpdates: 3,
      color: "bg-slate-50 dark:bg-slate-950/50",
      borderColor: "border-emerald-500/50",
    },
    {
      id: "supabase",
      name: "Supabase",
      icon: <BookOpen className="h-8 w-8" />,
      status: "connected",
      recentUpdates: 1,
      color: "bg-slate-50 dark:bg-slate-950/50",
      borderColor: "border-emerald-500/50",
    },
  ];

  const quickActions = [
    { icon: "🌿", title: "Create new branch", description: "" },
    { icon: "📐", title: "Open design specs", description: "" },
    { icon: "📄", title: "Update project docs", description: "" },
    { icon: "🚀", title: "Deploy to preview", description: "" },
  ];

  const aiSuggestions = [
    {
      title: "Sync Recommended",
      description:
        "Your Notion docs are 2 days behind. Consider syncing project updates.",
      type: "info",
    },
    {
      title: "PR Ready",
      description:
        "Your recent commits can be merged into main. All checks passed.",
      type: "success",
    },
    {
      title: "Design Review",
      description:
        "New Figma mockups match your current task. Review now to stay aligned.",
      type: "warning",
    },
  ];

  const stats = [
    { value: "5", label: "Connected Tools", color: "text-blue-600" },
    { value: "19", label: "Total Updates", color: "text-violet-600" },
    { value: "98%", label: "Sync Success Rate", color: "text-emerald-600" },
    { value: "2.3s", label: "Avg Sync Time", color: "text-orange-600" },
  ];

  const handleSync = (toolId: string) => {
    setSyncingTools([...syncingTools, toolId]);
    setTimeout(() => {
      setSyncingTools(syncingTools.filter((id) => id !== toolId));
    }, 2000);
  };

  const handleSyncAll = () => {
    const connectedToolIds = tools
      .filter((t) => t.status === "connected")
      .map((t) => t.id);
    setSyncingTools(connectedToolIds);
    setTimeout(() => {
      setSyncingTools([]);
    }, 2000);
  };

  return (
    <div className="min-h-dvh w-full flex flex-col bg-background text-foreground overflow-hidden md:flex-row">
      {/* Mobile Navbar */}
      <MobileNavBar
        title="Tool Integration"
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
          {/* Tool Integration Panel */}
          <div className="space-y-3 sm:space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
              <div className="space-y-1 flex-1 min-w-0">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-foreground flex items-center gap-2 sm:gap-3">
                  <Zap className="h-5 sm:h-6 w-5 sm:w-6 text-violet-500 flex-shrink-0" />
                  Tool Panel
                </h1>
                <p className="text-xs sm:text-sm lg:text-base text-muted-foreground">
                  Unified access to your tools
                </p>
              </div>
              <button
                onClick={handleSyncAll}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold text-xs sm:text-sm hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors w-fit flex-shrink-0"
              >
                <RefreshCw className="h-4 w-4" />
                <span className="hidden sm:inline">Sync All</span>
              </button>
            </div>

            {/* Tools Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {tools.map((tool) => (
                <div
                  key={tool.id}
                  className={`rounded-lg sm:rounded-2xl border-2 ${tool.borderColor} ${tool.color} p-3 sm:p-6 space-y-3 sm:space-y-4 transition-all hover:shadow-lg`}
                >
                  {/* Tool Header */}
                  <div className="flex items-start justify-between gap-2 sm:gap-3">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <div className="text-slate-700 dark:text-slate-300 h-6 sm:h-8 w-6 sm:w-8 flex-shrink-0">
                        {tool.icon}
                      </div>
                      <h3 className="font-semibold text-foreground text-sm sm:text-base">
                        {tool.name}
                      </h3>
                    </div>
                    {tool.status === "connected" && (
                      <div className="flex items-center gap-1 px-2 py-0.5 sm:py-1 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex-shrink-0">
                        <CheckCircle2 className="h-3 w-3" />
                        <span className="text-[0.65rem] sm:text-xs font-medium hidden sm:inline">
                          connected
                        </span>
                      </div>
                    )}
                    {tool.status === "disconnected" && (
                      <div className="flex items-center gap-1 px-2 py-0.5 sm:py-1 rounded-full bg-slate-400/20 text-slate-700 dark:text-slate-400 flex-shrink-0">
                        <Lock className="h-3 w-3" />
                        <span className="text-[0.65rem] sm:text-xs font-medium hidden sm:inline">
                          disconnected
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Connected Tool Content */}
                  {tool.status === "connected" && (
                    <>
                      <div className="border-t border-slate-200 dark:border-slate-700 pt-2 sm:pt-4 space-y-2 sm:space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs sm:text-sm font-medium text-foreground">
                            Recent Updates
                          </p>
                          <span className="text-xs sm:text-sm font-semibold text-foreground">
                            {tool.recentUpdates}
                          </span>
                        </div>

                        <div className="flex gap-1.5 sm:gap-2">
                          <button className="flex-1 flex items-center justify-center gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-900 dark:text-foreground font-medium text-xs sm:text-sm transition-colors">
                            <ExternalLink className="h-3 sm:h-4 w-3 sm:w-4" />
                            <span className="hidden sm:inline">Open</span>
                          </button>
                          <button
                            onClick={() => handleSync(tool.id)}
                            disabled={syncingTools.includes(tool.id)}
                            className="flex items-center justify-center gap-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-900 dark:text-foreground font-medium text-xs sm:text-sm transition-colors disabled:opacity-50"
                          >
                            <RefreshCw
                              className={`h-3 sm:h-4 w-3 sm:w-4 ${
                                syncingTools.includes(tool.id)
                                  ? "animate-spin"
                                  : ""
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Disconnected Tool Content */}
                  {tool.status === "disconnected" && (
                    <button className="w-full px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold text-xs sm:text-sm hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors">
                      Connect
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* AI Intelligence Layer */}
          <div className="rounded-lg sm:rounded-2xl border-2 border-blue-500/30 bg-blue-50 dark:bg-blue-950/20 px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
            <div className="flex items-start gap-2 sm:gap-3">
              <Zap className="h-5 sm:h-6 w-5 sm:w-6 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h2 className="text-base sm:text-lg font-semibold text-blue-900 dark:text-blue-300">
                  AI Intelligence Layer
                </h2>
                <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-400 mt-0.5">
                  Smart updates and insights
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-2 sm:space-y-3">
              <h3 className="text-xs sm:text-sm font-semibold text-blue-900 dark:text-blue-300">
                Quick Start
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
                {quickActions.map((action, idx) => (
                  <button
                    key={idx}
                    className="flex items-center gap-2 sm:gap-3 rounded-lg px-3 sm:px-4 py-2 sm:py-2.5 border border-blue-200 dark:border-blue-800 bg-white/50 dark:bg-slate-900/30 hover:bg-white dark:hover:bg-slate-800/50 transition-colors text-left"
                  >
                    <span className="text-base sm:text-lg flex-shrink-0">
                      {action.icon}
                    </span>
                    <span className="font-medium text-blue-900 dark:text-blue-300 text-xs sm:text-sm break-words">
                      {action.title}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Integration Start - AI Suggestions */}
            <div className="space-y-2 sm:space-y-3">
              <h3 className="text-xs sm:text-sm font-semibold text-blue-900 dark:text-blue-300">
                Integration Start
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                {aiSuggestions.map((suggestion, idx) => {
                  const bgColors = {
                    info: "bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700",
                    success:
                      "bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700",
                    warning:
                      "bg-violet-100 dark:bg-violet-900/40 border-violet-300 dark:border-violet-700",
                  };

                  const textColors = {
                    info: "text-blue-900 dark:text-blue-300",
                    success: "text-emerald-900 dark:text-emerald-300",
                    warning: "text-violet-900 dark:text-violet-300",
                  };

                  return (
                    <div
                      key={idx}
                      className={`rounded-lg border px-3 sm:px-4 py-2 sm:py-3 space-y-1.5 sm:space-y-2 ${bgColors[suggestion.type as keyof typeof bgColors]}`}
                    >
                      <h4
                        className={`font-semibold text-[0.7rem] sm:text-xs ${textColors[suggestion.type as keyof typeof textColors]}`}
                      >
                        {suggestion.title}
                      </h4>
                      <p
                        className={`text-[0.65rem] sm:text-xs leading-relaxed ${textColors[suggestion.type as keyof typeof textColors]}`}
                      >
                        {suggestion.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Activity Updates */}
            <div className="space-y-3 pt-3 sm:pt-4 border-t border-blue-200 dark:border-blue-800">
              <h3 className="text-xs sm:text-sm font-semibold text-blue-900 dark:text-blue-300">
                Latest Activity
              </h3>
              <div className="space-y-2 sm:space-y-3">
                {[
                  {
                    icon: "🐙",
                    title: "GitHub Activity",
                    description:
                      "5 new commits across 3 repositories. PR #234 has 2 pending reviews.",
                  },
                  {
                    icon: "🎨",
                    title: "Figma Updates",
                    description:
                      "Design system v2.0 shared with you. 2 components updated.",
                  },
                  {
                    icon: "📝",
                    title: "Notion Activity",
                    description:
                      "8 new pages in project docs. Sprint planning doc updated 2 hours ago.",
                  },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="border-b border-blue-200 dark:border-blue-800 pb-2 sm:pb-3 sm:pb-4 space-y-1 last:border-b-0 last:pb-0"
                  >
                    <div className="flex items-start gap-2 sm:gap-3">
                      <span className="text-base sm:text-lg flex-shrink-0">
                        {item.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-blue-900 dark:text-blue-300 text-xs sm:text-sm">
                          {item.title}
                        </h3>
                        <p className="text-[0.65rem] sm:text-xs text-blue-800 dark:text-blue-400 mt-0.5">
                          {item.description}
                        </p>
                        <button className="text-[0.65rem] sm:text-xs font-medium text-blue-600 dark:text-blue-300 hover:underline mt-1 sm:mt-2">
                          {item.title.includes("GitHub")
                            ? "View →"
                            : item.title.includes("Figma")
                              ? "Open →"
                              : "View →"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Integration Stats */}
          <div className="rounded-lg sm:rounded-2xl bg-white dark:bg-card/80 border border-border px-4 sm:px-6 py-4 sm:py-6">
            <h2 className="text-base sm:text-lg font-semibold text-foreground mb-4 sm:mb-6">
              Integration Stats
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
              {stats.map((stat, idx) => (
                <div key={idx} className="text-center space-y-1">
                  <p
                    className={`text-2xl sm:text-3xl lg:text-4xl font-bold ${stat.color}`}
                  >
                    {stat.value}
                  </p>
                  <p className="text-[0.65rem] sm:text-xs lg:text-sm text-muted-foreground">
                    {stat.label}
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

export default ToolsPage;
