// frontend/src/dashboard/collaborators/section/components/collab/Earnings.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import {
  cashEarnings, cashTotals as initialTotals, payouts as initialPayouts,
} from "@/dashboard/collaborators/section/data/mockData";
import { fetchCollaboratorEarnings, requestWithdrawal } from "@/lib/api/earnings";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/dashboard/collaborators/section/components/ui/dialog";

export function Earnings() {
  const [earnings, setEarnings] = useState(cashEarnings);
  const [totals, setTotals]     = useState(initialTotals);
  const [payoutList, setPayoutList] = useState(initialPayouts);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [amount, setAmount] = useState<number>(totals.pendingUSD);

  // Load from ai-router; initial state is the bundled mock so the screen renders
  // unchanged on first paint and survives the backend being unavailable.
  useEffect(() => {
    let alive = true;
    fetchCollaboratorEarnings().then((data) => {
      if (!alive) return;
      setEarnings(data.cashEarnings);
      setPayoutList(data.payouts);
      setTotals(data.totals);
      setAmount(data.totals.pendingUSD);
    });
    return () => { alive = false; };
  }, []);

  const handleWithdraw = async () => {
    if (amount <= 0 || amount > totals.pendingUSD) return;
    const month = new Date().toISOString().slice(0, 7);
    const res = await requestWithdrawal({ amount, monthIso: month, idemKey: `p-${Date.now()}` });
    if (!res.ok) {
      toast(`Withdrawal failed${res.available != null ? ` — up to $${res.available.toLocaleString()} available` : ""}.`);
      return;
    }
    const payout = res.payout ?? { id: `p-${Date.now()}`, monthIso: month, amount, status: "processing" as const };
    setPayoutList((cur) => [payout, ...cur]);
    setTotals((cur) => ({ ...cur, pendingUSD: res.newPendingUSD ?? cur.pendingUSD - amount }));
    toast(`Withdrawal initiated — $${amount.toLocaleString()} to ${res.destination ?? "•••1234"}. Funds arrive in 1–3 business days.`);
    setWithdrawOpen(false);
  };

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Earnings</h1>
          <p className="text-sm text-slate-500 mt-0.5">Cash earned across all engagements.</p>
        </div>
        <button onClick={() => { setAmount(totals.pendingUSD); setWithdrawOpen(true); }}
          disabled={totals.pendingUSD <= 0}
          className="h-9 px-4 bg-amber-500 hover:bg-amber-400 text-slate-900 rounded-lg text-sm font-semibold disabled:bg-slate-200 disabled:text-slate-400">
          Withdraw funds
        </button>
      </div>

      {/* Three stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Stat label="Lifetime"        value={`$${(totals.lifetimeUSD / 1000).toFixed(0)}K`} sub="Total cash earned" />
        <Stat label="Pending"          value={`$${totals.pendingUSD.toLocaleString()}`}      sub="Awaiting payout" />
        <Stat label="Revenue share (TTM)" value={`$${totals.revenueShareTTMUsd.toLocaleString()}`} sub="Trailing 12 months" />
      </div>

      {/* Per-startup breakdown */}
      <div className="border border-slate-200 bg-white rounded-xl">
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">Per-startup breakdown</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wider text-slate-500 border-b border-slate-100">
              <th className="text-left px-5 py-3 font-semibold">Project</th>
              <th className="text-right px-5 py-3 font-semibold">Earned</th>
              <th className="text-right px-5 py-3 font-semibold">Pending</th>
              <th className="text-right px-5 py-3 font-semibold">Rev share</th>
              <th className="text-left px-5 py-3 font-semibold">Contribution</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {earnings.map((c) => (
              <tr key={c.projectId} className="hover:bg-slate-50">
                <td className="px-5 py-3 text-slate-900">{c.projectName}</td>
                <td className="px-5 py-3 text-right tabular-nums">${c.earned.toLocaleString()}</td>
                <td className="px-5 py-3 text-right tabular-nums">${c.pending.toLocaleString()}</td>
                <td className="px-5 py-3 text-right tabular-nums">{c.revenueSharePercent}%</td>
                <td className="px-5 py-3 text-slate-500 text-xs">{c.contributionNote}</td>
                <td className="px-5 py-3 text-right">
                  <Link to={`/collaborator/equity#startup-${c.projectId}`}
                    className="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 hover:bg-amber-100">
                    Equity →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Payout history chart */}
      <div className="border border-slate-200 bg-white rounded-xl p-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Payout history</h2>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={[...payoutList].reverse()}>
              <XAxis dataKey="monthIso" tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(m) => String(m).slice(2)} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
              <Bar dataKey="amount">
                {payoutList.map((p) => (
                  <Cell key={p.id} fill={p.status === "processing" ? "#fbbf24" : "#f59e0b"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <ul className="mt-6 divide-y divide-slate-100">
          {payoutList.map((p) => (
            <li key={p.id} className="py-2.5 flex items-center justify-between text-sm">
              <span className="text-slate-700">{p.monthIso}</span>
              <span className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded-full ${p.status === "processing" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{p.status}</span>
                <span className="font-semibold tabular-nums text-slate-900">${p.amount.toLocaleString()}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Withdraw dialog */}
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Withdraw funds</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Destination</label>
              <div className="p-3 border-2 border-amber-500 bg-amber-50 rounded-lg text-sm">
                <p className="font-semibold text-slate-900">Wells Fargo · checking</p>
                <p className="text-xs text-slate-600 mt-0.5">•••1234</p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Amount</label>
              <input type="number" min={0} max={totals.pendingUSD} value={amount}
                onChange={(e) => setAmount(Number(e.target.value) || 0)}
                className="w-full h-10 border border-slate-300 rounded-lg px-3 text-sm tabular-nums focus:outline-none focus:border-amber-500" />
              <p className="text-xs text-slate-500 mt-1">Up to ${totals.pendingUSD.toLocaleString()} available</p>
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setWithdrawOpen(false)} className="px-4 py-2 text-sm rounded-lg text-slate-700 hover:bg-slate-100">Cancel</button>
            <button onClick={handleWithdraw} disabled={amount <= 0 || amount > totals.pendingUSD}
              className="px-4 py-2 text-sm rounded-lg bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 disabled:bg-slate-200 disabled:text-slate-400">
              Withdraw
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="border border-slate-200 bg-white rounded-xl p-5">
      <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">{label}</p>
      <p className="text-2xl font-bold text-slate-900 tabular-nums mt-2">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{sub}</p>
    </div>
  );
}
