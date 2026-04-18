import { useState } from "react";
import { ChevronUp, RotateCcw } from "lucide-react";

export function DealIntelligenceFilters() {
  const [expandedSections, setExpandedSections] = useState({
    execution: true,
    risk: false,
    behavioral: false,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const [executionMetrics, setExecutionMetrics] = useState({
    marketReadiness: 50,
    executionVelocity: 50,
    betaRetention: 50,
    revenueGrowth: 50,
  });

  const handleMetricChange = (metric: string, value: number) => {
    setExecutionMetrics((prev) => ({
      ...prev,
      [metric]: value,
    }));
  };

  const resetFilters = () => {
    setExecutionMetrics({
      marketReadiness: 50,
      executionVelocity: 50,
      betaRetention: 50,
      revenueGrowth: 50,
    });
  };

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-8">
        <div className="w-5 h-5 text-teal-500">⚙️</div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Advanced Filters
        </h2>
      </div>

      {/* Execution Metrics Section */}
      <div className="mb-6">
        <button
          onClick={() => toggleSection("execution")}
          className="w-full flex items-center justify-between py-3 px-4 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-all mb-2"
        >
          <h3 className="font-bold text-slate-900 dark:text-white">
            Execution Metrics
          </h3>
          <ChevronUp
            className={`w-5 h-5 text-slate-600 dark:text-slate-400 transition-transform ${
              !expandedSections.execution ? "rotate-180" : ""
            }`}
          />
        </button>

        {expandedSections.execution && (
          <div className="space-y-4 pl-4">
            {/* Market Readiness */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm text-slate-600 dark:text-slate-400">
                  Market Readiness
                </label>
                <span className="text-sm font-semibold text-teal-500">
                  {executionMetrics.marketReadiness}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={executionMetrics.marketReadiness}
                onChange={(e) =>
                  handleMetricChange(
                    "marketReadiness",
                    parseInt(e.target.value),
                  )
                }
                className="w-full h-2 bg-slate-300 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-500"
              />
            </div>

            {/* Execution Velocity */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm text-slate-600 dark:text-slate-400">
                  Execution Velocity
                </label>
                <span className="text-sm font-semibold text-teal-500">
                  {executionMetrics.executionVelocity}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={executionMetrics.executionVelocity}
                onChange={(e) =>
                  handleMetricChange(
                    "executionVelocity",
                    parseInt(e.target.value),
                  )
                }
                className="w-full h-2 bg-slate-300 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-500"
              />
            </div>

            {/* Beta Retention % */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm text-slate-600 dark:text-slate-400">
                  Beta Retention %
                </label>
                <span className="text-sm font-semibold text-teal-500">
                  {executionMetrics.betaRetention}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={executionMetrics.betaRetention}
                onChange={(e) =>
                  handleMetricChange("betaRetention", parseInt(e.target.value))
                }
                className="w-full h-2 bg-slate-300 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-500"
              />
            </div>

            {/* Revenue Growth % */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm text-slate-600 dark:text-slate-400">
                  Revenue Growth %
                </label>
                <span className="text-sm font-semibold text-teal-500">
                  {executionMetrics.revenueGrowth}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={executionMetrics.revenueGrowth}
                onChange={(e) =>
                  handleMetricChange("revenueGrowth", parseInt(e.target.value))
                }
                className="w-full h-2 bg-slate-300 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Risk Controls Section */}
      <div className="mb-6">
        <button
          onClick={() => toggleSection("risk")}
          className="w-full flex items-center justify-between py-3 px-4 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-all mb-2"
        >
          <h3 className="font-bold text-slate-900 dark:text-white">
            Risk Controls
          </h3>
          <ChevronUp
            className={`w-5 h-5 text-slate-600 dark:text-slate-400 transition-transform ${
              !expandedSections.risk ? "rotate-180" : ""
            }`}
          />
        </button>

        {expandedSections.risk && (
          <div className="pl-4 space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                defaultChecked
                className="w-4 h-4 accent-teal-500 rounded"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">
                Low Risk Only
              </span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                defaultChecked
                className="w-4 h-4 accent-teal-500 rounded"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">
                Moderate Risk
              </span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 accent-teal-500 rounded"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">
                High Risk
              </span>
            </label>
          </div>
        )}
      </div>

      {/* Behavioral Patterns Section */}
      <div className="mb-8">
        <button
          onClick={() => toggleSection("behavioral")}
          className="w-full flex items-center justify-between py-3 px-4 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-all mb-2"
        >
          <h3 className="font-bold text-slate-900 dark:text-white">
            Behavioral Patterns
          </h3>
          <ChevronUp
            className={`w-5 h-5 text-slate-600 dark:text-slate-400 transition-transform ${
              !expandedSections.behavioral ? "rotate-180" : ""
            }`}
          />
        </button>

        {expandedSections.behavioral && (
          <div className="pl-4 space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                defaultChecked
                className="w-4 h-4 accent-teal-500 rounded"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">
                High Growth
              </span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                defaultChecked
                className="w-4 h-4 accent-teal-500 rounded"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">
                Profitable
              </span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                defaultChecked
                className="w-4 h-4 accent-teal-500 rounded"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">
                Innovative
              </span>
            </label>
          </div>
        )}
      </div>

      {/* Reset Button */}
      <button
        onClick={resetFilters}
        className="w-full mt-auto py-3 px-4 bg-slate-800 dark:bg-slate-800 hover:bg-slate-700 dark:hover:bg-slate-700 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-all mb-4"
      >
        <RotateCcw className="w-4 h-4" />
        Reset Filters
      </button>
    </div>
  );
}
