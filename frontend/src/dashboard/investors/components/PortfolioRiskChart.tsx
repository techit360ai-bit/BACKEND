import { Check } from "lucide-react";

export function PortfolioRiskChart() {
  const lowRiskPercentage = 50;
  const moderateRiskPercentage = 50;
  const highRiskPercentage = 0;

  const lowRiskCount = 3;
  const moderateRiskCount = 3;
  const highRiskCount = 0;

  return (
    <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
      <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">
        Portfolio Risk Distribution
      </h3>

      {/* Risk Bar */}
      <div className="mb-8">
        <div className="flex rounded-lg overflow-hidden h-12 border border-slate-300 dark:border-slate-700">
          {/* Low Risk Section */}
          <div
            className="bg-emerald-500 flex items-center justify-center text-white font-bold"
            style={{ width: `${lowRiskPercentage}%` }}
          >
            <span className="text-sm">{lowRiskPercentage}%</span>
          </div>

          {/* Moderate Risk Section */}
          <div
            className="bg-amber-500 flex items-center justify-center text-white font-bold"
            style={{ width: `${moderateRiskPercentage}%` }}
          >
            <span className="text-sm">{moderateRiskPercentage}%</span>
          </div>

          {/* High Risk Section */}
          {highRiskPercentage > 0 && (
            <div
              className="bg-red-500 flex items-center justify-center text-white font-bold"
              style={{ width: `${highRiskPercentage}%` }}
            >
              <span className="text-sm">{highRiskPercentage}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-emerald-500" />
            <span className="text-slate-700 dark:text-slate-300 font-medium">
              Low Risk ({lowRiskCount})
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-amber-500" />
            <span className="text-slate-700 dark:text-slate-300 font-medium">
              Moderate ({moderateRiskCount})
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-red-500" />
            <span className="text-slate-700 dark:text-slate-300 font-medium">
              High Risk ({highRiskCount})
            </span>
          </div>
        </div>
      </div>

      {/* Additional Info */}
      <div className="mt-6 p-4 bg-slate-100 dark:bg-slate-800/50 rounded-lg">
        <div className="flex items-start gap-2">
          <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Your portfolio maintains a balanced risk profile with majority of
            investments in low to moderate risk categories.
          </p>
        </div>
      </div>
    </div>
  );
}
