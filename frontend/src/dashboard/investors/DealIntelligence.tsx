import { useState } from "react";
import { Grid3x3, List, Filter, Menu, X } from "lucide-react";
import { InvestorSidebar } from "./components/InvestorSidebar";
import { DealIntelligenceFilters } from "./components/DealIntelligenceFilters";
import { StartupCard } from "./components/StartupCard";

interface Startup {
  id: string;
  name: string;
  type: string;
  region: string;
  readiness: number;
  evi: number;
  revenue: string;
  riskLevel: "Low" | "Moderate" | "High";
  founder: number;
  location: string;
}

const startups: Startup[] = [
  {
    id: "1",
    name: "QuantumAPI",
    type: "SaaS",
    region: "North America",
    readiness: 86,
    evi: 79,
    revenue: "$120K MRR",
    riskLevel: "Low",
    founder: 91,
    location: "North America",
  },
  {
    id: "2",
    name: "NeuralEdge AI",
    type: "AI/ML",
    region: "Europe",
    readiness: 92,
    evi: 88,
    revenue: "$245K MRR",
    riskLevel: "Low",
    founder: 94,
    location: "Europe",
  },
  {
    id: "3",
    name: "FinFlow",
    type: "FinTech",
    region: "Asia",
    readiness: 78,
    evi: 72,
    revenue: "$68K MRR",
    riskLevel: "Moderate",
    founder: 82,
    location: "Asia",
  },
  {
    id: "4",
    name: "BioSynth",
    type: "BioTech",
    region: "Europe",
    readiness: 84,
    evi: 76,
    revenue: "$156K MRR",
    riskLevel: "Moderate",
    founder: 87,
    location: "Europe",
  },
  {
    id: "5",
    name: "CloudMesh",
    type: "Infrastructure",
    region: "North America",
    readiness: 88,
    evi: 83,
    revenue: "$198K MRR",
    riskLevel: "Low",
    founder: 89,
    location: "North America",
  },
  {
    id: "6",
    name: "DataVault",
    type: "Security",
    region: "Europe",
    readiness: 81,
    evi: 74,
    revenue: "$92K MRR",
    riskLevel: "Moderate",
    founder: 84,
    location: "Europe",
  },
];

export function DealIntelligence() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showFilters, setShowFilters] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);

  return (
    <div className="h-screen bg-white dark:bg-slate-950 flex">
      <style>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide:hover::-webkit-scrollbar {
          display: block;
        }
        .scrollbar-hide::-webkit-scrollbar {
          width: 8px;
        }
        .scrollbar-hide::-webkit-scrollbar-track {
          background: transparent;
        }
        .scrollbar-hide::-webkit-scrollbar-thumb {
          background: rgba(100, 116, 139, 0.5);
          border-radius: 4px;
        }
        .scrollbar-hide:hover::-webkit-scrollbar-thumb {
          background: rgba(100, 116, 139, 0.7);
        }
        .dark .scrollbar-hide::-webkit-scrollbar-thumb {
          background: rgba(71, 85, 105, 0.5);
        }
        .dark .scrollbar-hide:hover::-webkit-scrollbar-thumb {
          background: rgba(71, 85, 105, 0.7);
        }
      `}</style>

      {/* Mobile Overlay - Closes sidebar */}
      {showSidebar && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* LEFT: Investor Sidebar */}
      <nav
        className={`${
          showSidebar
            ? "fixed left-0 top-0 z-40 w-64 h-full"
            : "hidden md:flex md:w-64 md:shrink-0"
        } flex-col`}
      >
        <InvestorSidebar
          isMobile={showSidebar}
          isOpen={showSidebar}
          onClose={() => setShowSidebar(false)}
        />
      </nav>

      {/* RIGHT: Main Content Area (Header + Body) */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header - Top Bar */}
        <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 sm:px-4 md:px-8 py-4 md:py-6 shrink-0">
          <div className="flex items-center justify-between gap-2 mb-3 md:mb-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-1 md:mb-2 truncate">
                Deal Intelligence Engine
              </h1>
              <p className="text-xs sm:text-sm md:text-base text-slate-600 dark:text-slate-400 truncate">
                Bloomberg Terminal for startup execution · Signal &gt; Noise
              </p>
            </div>

            {/* Hamburger Menu - Top Right */}
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="md:hidden p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-all shrink-0"
              title="Toggle sidebar"
            >
              {showSidebar ? (
                <X className="w-5 h-5 sm:w-6 sm:h-6 text-slate-900 dark:text-white" />
              ) : (
                <Menu className="w-5 h-5 sm:w-6 sm:h-6 text-slate-900 dark:text-white" />
              )}
            </button>
          </div>

          {/* Controls Bar */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              Showing {startups.length} of {startups.length} startups
            </p>

            <div className="flex items-center gap-2">
              {/* Mobile Filter Button */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="lg:hidden p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-all"
                title="Toggle filters"
              >
                <Filter className="w-4 h-4 sm:w-5 sm:h-5 text-slate-900 dark:text-white" />
              </button>

              {/* View Mode Toggle */}
              <div className="flex items-center gap-1 bg-slate-200 dark:bg-slate-800 rounded-lg p-1">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-1.5 sm:p-2 rounded transition-all ${
                    viewMode === "grid"
                      ? "bg-white dark:bg-slate-700 text-teal-500 dark:text-teal-400 shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                  title="Grid view"
                >
                  <Grid3x3 className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-1.5 sm:p-2 rounded transition-all ${
                    viewMode === "list"
                      ? "bg-white dark:bg-slate-700 text-blue-500 dark:text-blue-400 shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                  title="List view"
                >
                  <List className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area - Filters (fixed) + Cards (scrollable) */}
        <div className="flex-1 flex overflow-hidden gap-0 md:gap-4 px-2 sm:px-4 md:px-6 pt-4 md:pt-6 w-full min-w-0">
          {/* Advanced Filters Panel - FIXED - Visible on desktop only */}
          <div
            className={`${
              showFilters ? "absolute inset-0 z-40" : "hidden md:block"
            } md:relative md:z-0 md:inset-auto w-full md:w-80 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800 shrink-0 overflow-hidden mb-6`}
          >
            <div className="p-4 sm:p-6 h-full overflow-y-auto scrollbar-hide">
              <DealIntelligenceFilters />
            </div>
          </div>

          {/* Cards Grid - SCROLLABLE & CONTAINED */}
          <div className="flex-1 flex flex-col overflow-hidden w-full min-w-0">
            <div className="flex-1 overflow-y-auto scrollbar-hide">
              <div className="pb-8 max-w-6xl px-2 sm:px-0">
                {viewMode === "grid" ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
                    {startups.map((startup) => (
                      <StartupCard
                        key={startup.id}
                        startup={startup}
                        viewMode="grid"
                      />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3 sm:space-y-4">
                    {startups.map((startup) => (
                      <StartupCard
                        key={startup.id}
                        startup={startup}
                        viewMode="list"
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DealIntelligence;
