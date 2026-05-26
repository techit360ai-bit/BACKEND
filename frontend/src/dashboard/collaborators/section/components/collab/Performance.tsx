// frontend/src/dashboard/collaborators/section/components/collab/Performance.tsx
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import {
  performanceMetrics, weeklyVelocity, tasks, projects,
} from "@/dashboard/collaborators/section/data/mockData";

type Range = "30" | "90" | "365";

export function Performance() {
  const navigate = useNavigate();
  const [range, setRange] = useState<Range>("90");

  // Per-project contribution: derive tasks shipped + impact avg + last contribution
  const perProject = useMemo(() => {
    return projects.map((p) => {
      const projTasks = tasks.filter((t) => t.projectId === p.id);
      const shipped = projTasks.filter((t) => t.status === "completed").length;
      const impactAvg = projTasks.length === 0 ? 0 : Math.round(projTasks.reduce((s, t) => s + t.impactScore, 0) / projTasks.length);
      const lastContribution = projTasks.length === 0
        ? "—"
        : projTasks.map((t) => t.deadline).sort().reverse()[0];
      return { ...p, shipped, impactAvg, lastContribution };
    });
  }, []);

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Performance</h1>
          <p className="text-sm text-slate-500 mt-0.5">How you're tracking across builds.</p>
        </div>
        <select value={range} onChange={(e) => setRange(e.target.value as Range)}
          className="h-9 border border-slate-300 rounded-lg px-3 text-sm bg-white">
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="365">Last 365 days</option>
        </select>
      </div>

      {/* Five core metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {performanceMetrics.map((m) => {
          const Arrow = m.trend === "up" ? TrendingUp : m.trend === "down" ? TrendingDown : Minus;
          const arrowColor = m.trend === "up" ? "text-emerald-600" : m.trend === "down" ? "text-red-600" : "text-slate-400";
          return (
            <div key={m.name} className="border border-slate-200 bg-white rounded-xl p-4">
              <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">{m.name}</p>
              <div className="flex items-baseline gap-2 mt-2">
                <p className="text-2xl font-bold text-slate-900 tabular-nums">{m.value}</p>
                <span className={`text-xs flex items-center gap-0.5 ${arrowColor}`}>
                  <Arrow className="w-3 h-3" />
                  {m.change > 0 ? `+${m.change}` : m.change}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Velocity chart */}
      <div className="border border-slate-200 bg-white rounded-xl p-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Velocity over time</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weeklyVelocity}>
              <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#64748b" }} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
              <Tooltip />
              <Line type="monotone" dataKey="tasks" stroke="#f59e0b" strokeWidth={2} dot={{ fill: "#f59e0b", r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Per-project contribution */}
      <div className="border border-slate-200 bg-white rounded-xl">
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">Per-project contribution</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wider text-slate-500 border-b border-slate-100">
              <th className="text-left px-5 py-3 font-semibold">Project</th>
              <th className="text-left px-5 py-3 font-semibold">Role</th>
              <th className="text-right px-5 py-3 font-semibold">Tasks shipped</th>
              <th className="text-right px-5 py-3 font-semibold">Impact avg</th>
              <th className="text-right px-5 py-3 font-semibold">Last contribution</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {perProject.map((p) => (
              <tr key={p.id} onClick={() => navigate(`/workspaces/build?startup=${p.id}`)}
                className="cursor-pointer hover:bg-slate-50">
                <td className="px-5 py-3"><span className="mr-2 text-lg">{p.logo}</span>{p.name}</td>
                <td className="px-5 py-3 text-slate-600">{p.role}</td>
                <td className="px-5 py-3 text-right tabular-nums">{p.shipped}</td>
                <td className="px-5 py-3 text-right tabular-nums">{p.impactAvg}</td>
                <td className="px-5 py-3 text-right text-slate-500">{p.lastContribution}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
