import { Zap, ArrowRight } from "lucide-react";

export function AIInsights() {
  return (
    <div className="bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-950 dark:to-slate-900/80 border border-slate-300 dark:border-slate-800 rounded-xl p-6">
      <div className="flex items-start gap-4">
        {/* AI Icon */}
        <div className="flex-shrink-0">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500">
            <Zap className="w-6 h-6 text-white" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-grow">
          <h3 className="text-slate-900 dark:text-white font-bold text-lg mb-3">
            AI INSIGHTS
          </h3>

          <div className="space-y-3">
            <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
              <span className="font-semibold text-slate-900 dark:text-white">
                3 startups in your watchlist increased milestone velocity by 24%
                this week.
              </span>{" "}
              This signals strong execution momentum across your portfolio.
            </p>

            <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
              <span className="font-semibold text-slate-900 dark:text-white">
                2 projects moved from 78 to 84 readiness.
              </span>{" "}
              QuantumAPI and CloudMesh show strong revenue acceleration
              patterns.
            </p>

            <button className="inline-flex items-center gap-2 mt-4 text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 font-semibold text-sm transition-colors">
              View detailed analysis <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
