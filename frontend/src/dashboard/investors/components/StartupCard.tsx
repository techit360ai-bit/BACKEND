import { Eye, Watch, Zap } from "lucide-react";

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

interface StartupCardProps {
  startup: Startup;
  viewMode: "grid" | "list";
}

export function StartupCard({ startup, viewMode }: StartupCardProps) {
  const getTypeBadgeColor = (type: string) => {
    const colors: Record<string, string> = {
      SaaS: "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300",
      "AI/ML":
        "bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300",
      FinTech:
        "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300",
      BioTech:
        "bg-pink-100 dark:bg-pink-500/20 text-pink-700 dark:text-pink-300",
      Infrastructure:
        "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300",
      Security: "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300",
    };
    return (
      colors[type] ||
      "bg-slate-100 dark:bg-slate-500/20 text-slate-700 dark:text-slate-300"
    );
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "Low":
        return "text-emerald-600 dark:text-emerald-400";
      case "Moderate":
        return "text-amber-600 dark:text-amber-400";
      case "High":
        return "text-red-600 dark:text-red-400";
      default:
        return "text-slate-600 dark:text-slate-400";
    }
  };

  if (viewMode === "list") {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 hover:shadow-lg dark:hover:shadow-lg dark:hover:shadow-slate-900/50 transition-all">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          {/* Left Section - Name and Type */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white">
                {startup.name}
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`px-3 py-1 rounded-lg text-xs font-semibold ${getTypeBadgeColor(
                  startup.type,
                )}`}
              >
                {startup.type}
              </span>
              <span className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-1">
                📍 {startup.location}
              </span>
            </div>
          </div>

          {/* Middle Section - Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
            <div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">
                Readiness
              </p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">
                {startup.readiness}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">
                EVI
              </p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">
                {startup.evi}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">
                Revenue
              </p>
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                {startup.revenue}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">
                Risk Level
              </p>
              <p
                className={`text-lg font-bold ${getRiskColor(startup.riskLevel)}`}
              >
                {startup.riskLevel}
              </p>
            </div>
          </div>

          {/* Right Section - Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button className="px-4 py-2 bg-teal-500/20 hover:bg-teal-500/30 text-teal-600 dark:text-teal-400 font-semibold rounded-lg transition-all">
              Analyze
            </button>
            <button className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-600 dark:text-blue-400 font-semibold rounded-lg transition-all flex items-center gap-1">
              <Eye className="w-4 h-4" />
              Watch
            </button>
            <button className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-600 dark:text-purple-400 font-semibold rounded-lg transition-all">
              Simulate
            </button>
          </div>
        </div>

        {/* Bottom Row - Founder Score */}
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <span className="text-sm text-slate-600 dark:text-slate-400">
            Founder Score
          </span>
          <span className="text-lg font-bold text-slate-900 dark:text-white">
            {startup.founder}
          </span>
        </div>
      </div>
    );
  }

  // Grid View
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 hover:shadow-lg dark:hover:shadow-lg dark:hover:shadow-slate-900/50 transition-all h-full flex flex-col">
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
          {startup.name}
        </h3>
        <span
          className={`inline-block px-3 py-1 rounded-lg text-xs font-semibold ${getTypeBadgeColor(
            startup.type,
          )}`}
        >
          {startup.type}
        </span>
      </div>

      {/* Location */}
      <div className="mb-4 text-sm text-slate-600 dark:text-slate-400">
        <span>📍 {startup.location}</span>
      </div>

      {/* Metrics */}
      <div className="space-y-3 flex-1 mb-4">
        <div className="flex justify-between">
          <span className="text-slate-600 dark:text-slate-400">Readiness</span>
          <span className="font-bold text-slate-900 dark:text-white">
            {startup.readiness}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600 dark:text-slate-400">EVI</span>
          <span className="font-bold text-slate-900 dark:text-white">
            {startup.evi}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600 dark:text-slate-400">Revenue</span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400">
            {startup.revenue}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600 dark:text-slate-400">Risk Level</span>
          <span className={`font-bold ${getRiskColor(startup.riskLevel)}`}>
            {startup.riskLevel}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600 dark:text-slate-400">Founder</span>
          <span className="font-bold text-slate-900 dark:text-white">
            {startup.founder}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-2 pt-4 border-t border-slate-200 dark:border-slate-700">
        <div className="flex gap-2">
          <button className="flex-1 px-3 py-2 bg-teal-500/20 hover:bg-teal-500/30 text-teal-600 dark:text-teal-400 font-semibold text-sm rounded-lg transition-all">
            Analyze
          </button>
          <button className="flex-1 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-600 dark:text-blue-400 font-semibold text-sm rounded-lg transition-all flex items-center justify-center gap-1">
            <Eye className="w-4 h-4" />
            Watch
          </button>
          <button className="flex-1 px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-600 dark:text-purple-400 font-semibold text-sm rounded-lg transition-all">
            Simulate
          </button>
        </div>
      </div>
    </div>
  );
}
