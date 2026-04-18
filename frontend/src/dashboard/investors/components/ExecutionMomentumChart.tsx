export function ExecutionMomentumChart() {
  // Data points for the chart
  const weeks = ["W1", "W2", "W3", "W4", "W5", "W6"];
  const readinessData = [75, 76, 78, 79, 81, 82];
  const betaRevenueData = [15, 17, 19, 21, 25, 28];

  // Chart dimensions
  const chartWidth = 600;
  const chartHeight = 280;
  const padding = 40;
  const innerWidth = chartWidth - padding * 2;
  const innerHeight = chartHeight - padding * 2;

  // Calculate scales
  const maxReadiness = 100;
  const maxBeta = 35;

  const getXPos = (index: number) =>
    padding + (index / (weeks.length - 1)) * innerWidth;
  const getYPos = (value: number, max: number) =>
    padding + innerHeight - (value / max) * innerHeight;

  // Create path strings
  const readinessPath =
    "M " +
    readinessData
      .map((val, idx) => `${getXPos(idx)},${getYPos(val, maxReadiness)}`)
      .join(" L ");

  const betaPath =
    "M " +
    betaRevenueData
      .map((val, idx) => `${getXPos(idx)},${getYPos(val, maxBeta)}`)
      .join(" L ");

  return (
    <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
      <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">
        Execution Momentum
      </h3>

      <div className="overflow-x-auto">
        <svg
          width={chartWidth}
          height={chartHeight}
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="min-w-full"
        >
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((val) => (
            <line
              key={`grid-${val}`}
              x1={padding}
              y1={getYPos(val, maxReadiness)}
              x2={chartWidth - padding}
              y2={getYPos(val, maxReadiness)}
              stroke="#cbd5e1"
              strokeDasharray="4,4"
              strokeWidth="1"
              opacity="0.5"
            />
          ))}

          {/* Y-axis */}
          <line
            x1={padding}
            y1={padding}
            x2={padding}
            y2={chartHeight - padding}
            stroke="#94a3b8"
            strokeWidth="2"
          />

          {/* X-axis */}
          <line
            x1={padding}
            y1={chartHeight - padding}
            x2={chartWidth - padding}
            y2={chartHeight - padding}
            stroke="#94a3b8"
            strokeWidth="2"
          />

          {/* Y-axis labels */}
          {[0, 25, 50, 75, 100].map((val) => (
            <text
              key={`label-${val}`}
              x={padding - 10}
              y={getYPos(val, maxReadiness) + 5}
              textAnchor="end"
              fontSize="12"
              fill="#64748b"
            >
              {val}
            </text>
          ))}

          {/* X-axis labels */}
          {weeks.map((week, idx) => (
            <text
              key={`week-${week}`}
              x={getXPos(idx)}
              y={chartHeight - padding + 25}
              textAnchor="middle"
              fontSize="12"
              fill="#64748b"
            >
              {week}
            </text>
          ))}

          {/* Green line - Portfolio Readiness */}
          <path
            d={readinessPath}
            fill="none"
            stroke="#10b981"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Green dots */}
          {readinessData.map((val, idx) => (
            <circle
              key={`readiness-dot-${idx}`}
              cx={getXPos(idx)}
              cy={getYPos(val, maxReadiness)}
              r="4"
              fill="#10b981"
              stroke="#ffffff"
              strokeWidth="2"
            />
          ))}

          {/* Blue line - Beta-to-Revenue */}
          <path
            d={betaPath}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Blue dots */}
          {betaRevenueData.map((val, idx) => (
            <circle
              key={`beta-dot-${idx}`}
              cx={getXPos(idx)}
              cy={getYPos(val, maxBeta)}
              r="4"
              fill="#3b82f6"
              stroke="#ffffff"
              strokeWidth="2"
            />
          ))}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex gap-6 mt-6">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
          <span className="text-sm text-slate-600 dark:text-slate-400">
            Avg Portfolio Readiness
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span className="text-sm text-slate-600 dark:text-slate-400">
            Beta-to-Revenue %
          </span>
        </div>
      </div>
    </div>
  );
}
