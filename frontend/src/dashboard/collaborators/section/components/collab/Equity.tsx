// frontend/src/dashboard/collaborators/section/components/collab/Equity.tsx
import { useState } from "react";
import { toast } from "sonner";
import { TrendingUp, X } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { equityHoldings, equityTotals, vestingTimeline, type EquityHolding } from "@/dashboard/collaborators/section/data/mockData";

export function Equity() {
  const [capHolding, setCapHolding] = useState<EquityHolding | null>(null);

  const chartData = (() => {
    const months = vestingTimeline[0]?.points.map((p) => p.monthIso) ?? [];
    return months.map((m, i) => {
      const row: Record<string, number | string> = { month: m };
      vestingTimeline.forEach((s) => { row[s.projectName] = s.points[i]?.vestedPercent ?? 0; });
      return row;
    });
  })();
  const seriesColors = ["#f59e0b", "#10b981", "#6366f1"]; // amber, emerald, indigo

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Equity</h1>
          <p className="text-sm text-slate-500 mt-0.5">Ownership you've earned across {equityHoldings.length} startups.</p>
        </div>
        <a href="#equity-philosophy" className="text-sm text-amber-600 hover:underline">Equity philosophy →</a>
      </div>

      {/* Hero stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Total value"          value={`$${(equityTotals.totalValueUSD / 1000).toFixed(1)}K`} />
        <Stat label="Blended equity"        value={`${equityTotals.blendedEquityPercent}%`} />
        <Stat label="Vested this quarter"   value={`$${(equityTotals.vestedThisQuarterUSD / 1000).toFixed(1)}K`} />
        <Stat label="Next vest" value={equityTotals.nextVest?.date ?? "—"} sub={equityTotals.nextVest ? `+${equityTotals.nextVest.deltaPercent}% ${equityTotals.nextVest.startup}` : undefined} />
      </div>

      {/* Vesting timeline */}
      <div className="border border-slate-200 bg-white rounded-xl p-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Vesting timeline (48-month horizon)</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(m) => String(m).slice(2)} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(v) => `${v}%`} />
              <Tooltip />
              <Legend />
              {vestingTimeline.map((s, i) => (
                <Line key={s.projectId} type="monotone" dataKey={s.projectName} stroke={seriesColors[i % seriesColors.length]} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Per-startup cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {equityHoldings.map((h) => (
          <div key={h.projectId} id={`startup-${h.projectId}`} className="border border-slate-200 bg-white rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">{h.projectLogo}</span>
              <h3 className="font-semibold text-slate-900">{h.projectName}</h3>
            </div>
            <div className="flex items-baseline gap-3 mb-2">
              <p className="text-2xl font-bold text-slate-900 tabular-nums">{h.equityPercent}%</p>
              <p className="text-sm text-slate-600 tabular-nums">${(h.valueUSD / 1000).toFixed(1)}K</p>
            </div>
            <p className="text-xs text-slate-500 mb-3">Vested {h.vestedPercent}% · {h.vestingSchedule.years}y/{h.vestingSchedule.cliffMonths}m cliff</p>
            <p className="text-xs text-slate-500 mb-4">Granted {h.grantDate}</p>
            {h.nextVest && (
              <p className="text-xs text-amber-600 mb-4 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Next vest {h.nextVest.date} · +{h.nextVest.deltaPercent}%</p>
            )}
            <div className="flex gap-2">
              <button onClick={() => setCapHolding(h)} className="flex-1 text-xs px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50">View cap table</button>
              <button onClick={() => toast("Grant document downloaded (mock PDF)")} className="flex-1 text-xs px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50">Grant document →</button>
            </div>
          </div>
        ))}
      </div>

      {/* Philosophy explainer */}
      <details id="equity-philosophy" className="border border-slate-200 bg-white rounded-xl p-6">
        <summary className="cursor-pointer text-sm font-semibold text-slate-700">How equity works on TechIT</summary>
        <ul className="mt-3 space-y-2 text-sm text-slate-600 list-disc list-inside">
          <li>Every grant follows your chosen vesting schedule. We track it on your behalf and surface upcoming events here.</li>
          <li>Dilution protection: equity already vested cannot be diluted without your consent. Future grants are protected up to a threshold defined at signing.</li>
          <li>TechIT acts as the cap-table custodian. You get a copy of every grant document; we keep the canonical ledger so founders and collaborators have a single source of truth.</li>
        </ul>
      </details>

      {/* Cap table dialog */}
      {capHolding && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setCapHolding(null)}>
          <div className="bg-white rounded-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900">{capHolding.projectName} · Cap table</h3>
              <button onClick={() => setCapHolding(null)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
            </div>
            <ul className="space-y-2">
              {capHolding.capTable.map((row) => (
                <li key={row.label} className={`flex justify-between text-sm p-2 rounded ${row.highlighted ? "bg-amber-50" : ""}`}>
                  <span className={row.highlighted ? "font-semibold text-amber-700" : "text-slate-700"}>{row.label}</span>
                  <span className="tabular-nums">{row.percent}%</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border border-slate-200 bg-white rounded-xl p-5">
      <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">{label}</p>
      <p className="text-2xl font-bold text-slate-900 tabular-nums mt-2">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}
