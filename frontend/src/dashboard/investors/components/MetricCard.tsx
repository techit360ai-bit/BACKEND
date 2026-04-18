import React from "react";

interface MetricCardProps {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  badge?: string;
  backgroundColor?: string;
  borderColor?: string;
  iconBgColor?: string;
}

export function MetricCard({
  icon,
  value,
  label,
  badge,
  backgroundColor = "from-blue-500/5 to-blue-600/5",
  borderColor = "from-blue-500/30 to-blue-600/30",
  iconBgColor = "from-blue-500 to-blue-600",
}: MetricCardProps) {
  return (
    <div
      className={`bg-gradient-to-br ${backgroundColor} border dark:border-slate-700 rounded-xl p-6 hover:shadow-lg transition-all duration-300`}
      style={{
        borderColor: borderColor.includes("from") ? "transparent" : undefined,
      }}
    >
      <div className="flex items-start justify-between mb-6">
        <div
          className={`bg-gradient-to-br ${iconBgColor} p-3 rounded-lg text-white shadow-lg`}
        >
          {icon}
        </div>
        {badge && (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm">
            {badge}
          </span>
        )}
      </div>

      <p className="text-4xl font-bold text-slate-900 dark:text-white mb-2">
        {value}
      </p>
      <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
        {label}
      </p>
    </div>
  );
}
