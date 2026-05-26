// frontend/src/dashboard/collaborators/section/components/collab/Dashboard.tsx
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";
import { TrendingUp, ArrowRight, CheckCircle } from "lucide-react";
import {
  equityHoldings, equityTotals,
  cashTotals,
  projects, tasks, signals, recentActivity,
} from "@/dashboard/collaborators/section/data/mockData";
import { useCollaboratorProfile } from "@/contexts/UserContext";

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

export function Dashboard() {
  const navigate = useNavigate();
  const { collaboratorProfile } = useCollaboratorProfile();
  const [activity, setActivity] = useState(recentActivity);

  const firstName = collaboratorProfile.name.split(" ")[0];
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  const urgentTasks = [...tasks]
    .filter((t) => t.status !== "completed")
    .sort((a, b) => (b.impactScore - a.impactScore))
    .slice(0, 3);

  const handleStandup = (projectName: string) => {
    setActivity((cur) => [
      { id: `ra-${Date.now()}`, projectName, projectLogo: projects.find((p) => p.name === projectName)?.logo ?? "•", message: "Standup logged", timestampISO: new Date().toISOString() },
      ...cur,
    ]);
    toast("Standup logged");
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Good morning, {firstName}.</h1>
        <p className="text-sm text-slate-500 mt-0.5">{today} · {projects.length} active builds</p>
      </div>

      {/* Equity hero + Earnings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Equity hero — 2 cols */}
        <Link to="/collaborator/equity" className="lg:col-span-2 group border border-slate-200 bg-white rounded-xl p-6 hover:border-amber-300 transition-colors">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Building for Equity</p>
            <span className="text-amber-600 text-sm group-hover:translate-x-0.5 transition-transform">View full equity →</span>
          </div>
          <div className="flex items-baseline gap-6 mt-2">
            <div>
              <p className="text-3xl font-bold text-slate-900 tabular-nums">${(equityTotals.totalValueUSD / 1000).toFixed(1)}K</p>
              <p className="text-xs text-slate-500 mt-0.5">Total ownership value</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-slate-900 tabular-nums">{equityTotals.blendedEquityPercent}%</p>
              <p className="text-xs text-slate-500 mt-0.5">Blended equity across {equityHoldings.length} startups</p>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            {equityHoldings.map((h) => (
              <div key={h.projectId} className="flex items-center text-sm">
                <span className="text-lg mr-2">{h.projectLogo}</span>
                <span className="flex-1 text-slate-700">{h.projectName}</span>
                <span className="w-16 text-right tabular-nums text-slate-900">{h.equityPercent}%</span>
                <span className="w-20 text-right tabular-nums text-slate-700">${(h.valueUSD / 1000).toFixed(1)}K</span>
                <span className="w-24 text-right text-xs text-slate-500">vested {h.vestedPercent}%</span>
              </div>
            ))}
          </div>

          {equityTotals.nextVest && (
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 text-sm">
              <TrendingUp className="w-4 h-4 text-amber-500" />
              <span className="text-slate-700">
                Next vest <span className="font-semibold">{equityTotals.nextVest.date}</span> · +{equityTotals.nextVest.deltaPercent}% {equityTotals.nextVest.startup}
              </span>
            </div>
          )}
        </Link>

        {/* Earnings — 1 col */}
        <Link to="/collaborator/earnings" className="group border border-slate-200 bg-white rounded-xl p-6 hover:border-amber-300 transition-colors">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">Cash earned</p>
          <p className="text-3xl font-bold text-slate-900 tabular-nums">${(cashTotals.lifetimeUSD / 1000).toFixed(0)}K</p>
          <p className="text-xs text-slate-500">Lifetime</p>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-600">Pending payout</span><span className="font-semibold tabular-nums text-slate-900">${cashTotals.pendingUSD.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">Revenue share (TTM)</span><span className="font-semibold tabular-nums text-slate-900">${cashTotals.revenueShareTTMUsd.toLocaleString()}</span></div>
          </div>
          <p className="text-amber-600 text-sm mt-4 group-hover:translate-x-0.5 transition-transform">View earnings →</p>
        </Link>
      </div>

      {/* Active Builds */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Active Builds</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {projects.map((p) => {
            const statusStyles = p.status === "critical"
              ? "bg-red-50 text-red-700"
              : p.status === "risk"
              ? "bg-amber-50 text-amber-700"
              : "bg-emerald-50 text-emerald-700";
            return (
              <div key={p.id} className="border border-slate-200 bg-white rounded-xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{p.logo}</span>
                    <div>
                      <h3 className="font-semibold text-slate-900 text-sm">{p.name}</h3>
                      <p className="text-xs text-slate-500">{p.role}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusStyles}`}>{p.status}</span>
                </div>
                <div className="text-xs text-slate-600 mb-2">{p.sprintGoal}</div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-1">
                  <div className="h-full bg-amber-500" style={{ width: `${p.progress}%` }} />
                </div>
                <div className="flex justify-between text-xs text-slate-500 mb-3">
                  <span>{p.progress}%</span><span>Due {p.deadline}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => navigate(`/workspaces/build?startup=${p.id}`)}
                    className="flex-1 px-3 py-1.5 text-xs bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors">Open workspace</button>
                  <button onClick={() => handleStandup(p.name)}
                    className="px-3 py-1.5 text-xs border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors">Standup</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Today's focus + Signals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="border border-slate-200 bg-white rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700">Today's focus</h2>
            <Link to="/collaborator/tasks" className="text-xs text-amber-600 hover:underline">View all tasks</Link>
          </div>
          <ul className="space-y-3">
            {urgentTasks.map((t) => (
              <li key={t.id} className="flex items-start gap-3 text-sm">
                <input type="checkbox" className="mt-0.5 accent-amber-500" />
                <div className="flex-1">
                  <p className="text-slate-900">{t.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{t.projectName} · Due {t.deadline} · Impact {t.impactScore}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  t.priority === "critical" ? "bg-red-50 text-red-700" :
                  t.priority === "high"     ? "bg-amber-50 text-amber-700" :
                                              "bg-slate-100 text-slate-700"}`}>{t.priority}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="border border-slate-200 bg-white rounded-xl p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Signals</h2>
          <ul className="space-y-2">
            {signals.map((s) => (
              <li key={s.id}>
                <Link to={s.href} className="flex items-center gap-3 p-3 -mx-3 rounded-lg hover:bg-slate-50 transition-colors text-sm">
                  <CheckCircle className="w-4 h-4 text-slate-400" />
                  <span className="flex-1 text-slate-700">{s.message}</span>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Recent activity */}
      <div className="border border-slate-200 bg-white rounded-xl p-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Recent activity</h2>
        <ul className="space-y-2">
          {activity.map((a) => (
            <li key={a.id} className="flex items-center gap-3 text-sm py-1.5">
              <span className="text-lg">{a.projectLogo}</span>
              <span className="text-slate-700 font-medium">{a.projectName}</span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-600 flex-1">{a.message}</span>
              <span className="text-xs text-slate-400">{formatRelative(a.timestampISO)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
