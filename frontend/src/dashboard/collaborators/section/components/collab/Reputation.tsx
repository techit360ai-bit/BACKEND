import { useState } from "react";
import {
  endorsements, badges, leaderboard, performanceMetrics,
} from "@/dashboard/collaborators/section/data/mockData";
import type { Badge } from "@/dashboard/collaborators/section/types";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/dashboard/collaborators/section/components/ui/dialog";

type Range = "month" | "quarter" | "all";
const RANGES: { value: Range; label: string }[] = [
  { value: "month",   label: "This month" },
  { value: "quarter", label: "This quarter" },
  { value: "all",     label: "All time" },
];

const ENDORSEMENTS_PER_PAGE = 5;

export function Reputation() {
  const [page, setPage] = useState(0);
  const [openBadge, setOpenBadge] = useState<Badge | null>(null);
  const [range, setRange] = useState<Range>("all"); // visual only — leaderboard data is static (documented in spec)

  const totalPages = Math.max(1, Math.ceil(endorsements.length / ENDORSEMENTS_PER_PAGE));
  const pageItems  = endorsements.slice(page * ENDORSEMENTS_PER_PAGE, (page + 1) * ENDORSEMENTS_PER_PAGE);

  const compositeScore = 94;
  const highest = [...performanceMetrics].sort((a, b) => b.value - a.value)[0];

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reputation</h1>
          <p className="text-sm text-slate-500 mt-0.5">Earned through shipping, not claimed.</p>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-semibold">Top 1%</span>
      </div>

      {/* Score breakdown */}
      <div className="border border-slate-200 bg-white rounded-xl p-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Reputation score breakdown</h2>
        <div className="flex items-start gap-8">
          <div className="text-center">
            <p className="text-5xl font-bold text-slate-900 tabular-nums">{compositeScore}</p>
            <p className="text-xs text-slate-500 mt-1">Composite</p>
          </div>
          <div className="flex-1 space-y-3">
            {performanceMetrics.map((m) => (
              <div key={m.name}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-700">{m.name}</span>
                  <span className="tabular-nums text-slate-900 font-semibold">{m.value}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${m.name === highest.name ? "bg-amber-500" : "bg-slate-300"}`} style={{ width: `${m.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Endorsements */}
      <div className="border border-slate-200 bg-white rounded-xl">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Endorsements ({endorsements.length})</h2>
          {totalPages > 1 && (
            <div className="flex items-center gap-2 text-xs">
              <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
                className="px-2 py-1 text-slate-600 hover:bg-slate-100 rounded disabled:opacity-40">← Prev</button>
              <span className="text-slate-500">Page {page + 1} of {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
                className="px-2 py-1 text-slate-600 hover:bg-slate-100 rounded disabled:opacity-40">Next →</button>
            </div>
          )}
        </div>
        <ul className="divide-y divide-slate-100">
          {pageItems.map((e) => (
            <li key={e.id} className="p-5 flex gap-4">
              <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-700 font-semibold flex items-center justify-center text-sm shrink-0">{e.fromAvatar}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-900">"{e.quote}"</p>
                <p className="text-xs text-slate-500 mt-1">— {e.fromName} · {e.fromRole} · {e.projectName} · {e.date}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Badges */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Badges</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {badges.map((b) => (
            <button key={b.id} onClick={() => setOpenBadge(b)}
              className={`border rounded-xl p-4 text-center transition-all ${
                b.earned
                  ? "border-slate-200 bg-white hover:border-amber-300"
                  : "border-slate-200 bg-slate-50 opacity-60"}`}>
              <div className="text-3xl mb-2">{b.icon}</div>
              <p className="text-xs font-semibold text-slate-900">{b.title}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Leaderboard */}
      <div className="border border-slate-200 bg-white rounded-xl">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Leaderboard (Top {leaderboard.length})</h2>
          <select value={range} onChange={(e) => setRange(e.target.value as Range)}
            className="h-8 border border-slate-300 rounded-lg px-2 text-xs bg-white">
            {RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wider text-slate-500 border-b border-slate-100">
              <th className="text-left px-5 py-3 font-semibold">Rank</th>
              <th className="text-left px-5 py-3 font-semibold">Name</th>
              <th className="text-right px-5 py-3 font-semibold">Score</th>
              <th className="text-right px-5 py-3 font-semibold">Earnings</th>
              <th className="text-right px-5 py-3 font-semibold">Projects</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leaderboard.map((r) => (
              <tr key={r.rank} className={r.isCurrentUser ? "bg-amber-50" : ""}>
                <td className="px-5 py-3 tabular-nums">{r.rank}</td>
                <td className="px-5 py-3 text-slate-900">{r.name}{r.isCurrentUser && <span className="ml-2 text-xs text-amber-700">(you)</span>}</td>
                <td className="px-5 py-3 text-right tabular-nums">{r.score}</td>
                <td className="px-5 py-3 text-right tabular-nums">${(r.earnings / 1000).toFixed(0)}K</td>
                <td className="px-5 py-3 text-right tabular-nums">{r.projects}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={openBadge !== null} onOpenChange={(o) => !o && setOpenBadge(null)}>
        <DialogContent className="max-w-sm">
          {openBadge && (
            <>
              <DialogHeader>
                <DialogTitle>{openBadge.title}</DialogTitle>
              </DialogHeader>
              <div className="text-center py-4">
                <div className="text-5xl mb-3">{openBadge.icon}</div>
                <p className="text-sm text-slate-600">{openBadge.description}</p>
                <p className={`mt-4 text-xs font-semibold ${openBadge.earned ? "text-emerald-700" : "text-slate-500"}`}>
                  {openBadge.earned ? "✓ Earned" : "Not yet earned"}
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
