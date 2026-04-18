import { TrendingUp, AlertCircle, Eye } from "lucide-react";

interface StartupData {
  name: string;
  type: string;
  velocitySpike: string;
  riskLevel: string;
  investorsWatching: number;
}

const startupData: StartupData[] = [
  {
    name: "QuantumAPI",
    type: "SaaS",
    velocitySpike: "+24%",
    riskLevel: "Low",
    investorsWatching: 7,
  },
  {
    name: "NeuralEdge AI",
    type: "AI/ML",
    velocitySpike: "+31%",
    riskLevel: "Low",
    investorsWatching: 12,
  },
  {
    name: "CloudMesh",
    type: "Infrastructure",
    velocitySpike: "+27%",
    riskLevel: "Low",
    investorsWatching: 9,
  },
];

export function HighMomentumCard() {
  const getRiskColor = (level: string) => {
    switch (level.toLowerCase()) {
      case "low":
        return "text-emerald-600 dark:text-emerald-400";
      case "medium":
        return "text-yellow-600 dark:text-yellow-400";
      case "high":
        return "text-red-600 dark:text-red-400";
      default:
        return "text-slate-600 dark:text-slate-400";
    }
  };

  const getTypeBgColor = (type: string) => {
    switch (type) {
      case "SaaS":
        return "bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300";
      case "AI/ML":
        return "bg-pink-100 dark:bg-pink-500/20 text-pink-700 dark:text-pink-300";
      case "Infrastructure":
        return "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300";
      default:
        return "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300";
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
        High Momentum This Week
      </h3>

      {startupData.map((startup) => (
        <div
          key={startup.name}
          className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 dark:border-slate-800 rounded-lg p-4 hover:border-teal-400 dark:hover:border-teal-500/50 transition-all"
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <h4 className="text-slate-900 dark:text-white font-bold">
                {startup.name}
              </h4>
              <span
                className={`inline-block mt-1 px-2 py-1 rounded text-xs font-medium ${getTypeBgColor(startup.type)}`}
              >
                {startup.type}
              </span>
            </div>
            <button className="px-3 py-2 bg-teal-500/20 hover:bg-teal-500/30 text-teal-600 dark:text-teal-300 text-sm font-medium rounded transition-all">
              Analyze →
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            {/* Velocity Spike */}
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <div className="text-sm">
                <p className="text-slate-600 dark:text-slate-500 text-xs">
                  Velocity Spike
                </p>
                <p className="text-teal-600 dark:text-teal-400 font-bold">
                  {startup.velocitySpike}
                </p>
              </div>
            </div>

            {/* Risk Level */}
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              <div className="text-sm">
                <p className="text-slate-600 dark:text-slate-500 text-xs">
                  Risk Level
                </p>
                <p className={`font-bold ${getRiskColor(startup.riskLevel)}`}>
                  {startup.riskLevel}
                </p>
              </div>
            </div>

            {/* Investors Watching */}
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              <div className="text-sm">
                <p className="text-slate-600 dark:text-slate-500 text-xs">
                  Investors
                </p>
                <p className="text-slate-900 dark:text-slate-300 font-bold">
                  {startup.investorsWatching}
                </p>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
