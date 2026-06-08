// frontend/src/dashboard/founders/section/components/founder/Dashboard.tsx
import { Link, useNavigate } from "react-router-dom";
import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { ArrowRight, CheckCircle, TrendingUp, Plus } from "lucide-react";
import { useFounderProfile } from "@/contexts/UserContext";
import { fetchDashboardIntelligence, type DashboardIntelligence } from "@/lib/api/gsis";
import { fetchAudioBriefing } from "@/lib/api/audio";
import { runAnomalyScan, type RiskFlag } from "@/lib/api/alerts";
import { fetchFounderProjects, type FounderProject } from "@/lib/api/projects";
import { formatRelative } from "@/lib/formatRelative";
import { OPPORTUNITIES } from "@/dashboard/_shared/opportunities/data";
import type { Hackathon } from "@/dashboard/_shared/opportunities/types";
import { computeMomentum, momentumColor } from "@/dashboard/_shared/hackathon/momentum";
import {
  signals, tasks as initialTasks, activeBuilds as initialBuilds,
  recentActivity, journey,
  type Build,
} from "@/dashboard/founders/section/data/mockData";

// Captured at module load — stable reference, satisfies react-hooks/purity
const NOW_MS = Date.now();

const stageStyles: Record<string, string> = {
  Idea:    "bg-slate-100 text-slate-700",
  MVP:     "bg-violet-50 text-violet-700",
  Beta:    "bg-amber-50 text-amber-700",
  Launch:  "bg-emerald-50 text-emerald-700",
  Growth:  "bg-emerald-50 text-emerald-700",
};

const priorityStyles: Record<string, string> = {
  overdue:    "bg-red-50 text-red-700",
  "due-soon": "bg-amber-50 text-amber-700",
  "this-week": "bg-slate-100 text-slate-700",
};

export function Dashboard() {
  const navigate = useNavigate();
  const { founderProfile: p } = useFounderProfile();
  const [tasks, setTasks]     = useState(initialTasks);
  const [builds, setBuilds]   = useState(initialBuilds);
  const [openStage, setOpenStage] = useState<string | null>(null);

  // GSIS master score + alerts from ai-router (surfaced for the first time).
  const [intel, setIntel] = useState<DashboardIntelligence | null>(null);
  useEffect(() => {
    let alive = true;
    fetchDashboardIntelligence().then((d) => { if (alive) setIntel(d); });
    return () => { alive = false; };
  }, []);

  // B4 — anomaly risk flags from the engine over this founder's execution signals.
  const [riskFlags, setRiskFlags] = useState<RiskFlag[]>([]);
  useEffect(() => {
    let alive = true;
    runAnomalyScan([{ kind: "founder_execution", source: "dashboard" }])
      .then((r) => { if (alive) setRiskFlags(r.risk_flags ?? []); });
    return () => { alive = false; };
  }, []);

  // B5 — momentum audio briefing (TTS) on demand.
  const [briefingUrl, setBriefingUrl] = useState<string | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const playBriefing = async () => {
    setBriefingLoading(true);
    const b = await fetchAudioBriefing(`Momentum briefing for ${firstName}: keep your build moving.`);
    setBriefingLoading(false);
    if (b?.audio_url) {
      setBriefingUrl(b.audio_url);
      try { void new Audio(b.audio_url).play(); } catch { /* autoplay may be blocked */ }
    } else {
      toast("Audio briefing unavailable right now.");
    }
  };

  // S7 — founder venture portfolio (multiple separate startups).
  const [ventures, setVentures] = useState<FounderProject[]>([]);
  const [activeVentureId, setActiveVentureId] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetchFounderProjects().then((list) => {
      if (!alive) return;
      setVentures(list);
      setActiveVentureId((list.find((v) => v.isPrimary) ?? list[0])?.id ?? null);
    });
    return () => { alive = false; };
  }, []);

  const firstName = p.name.split(" ")[0];
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const weeksBuilding = useMemo(
    () => Math.max(1, Math.floor((NOW_MS - new Date(`${p.foundingYear}-01-01`).getTime()) / (7 * 86_400_000))),
    [p.foundingYear],
  );

  const toggleTask = (id: string) => {
    setTasks((cur) => cur.map((t) => t.id === id ? { ...t, done: !t.done } : t));
    toast("Marked complete");
  };

  const startSideBet = () => {
    const newBuild: Build = {
      id: `b-${Date.now()}`,
      name: "New side bet",
      logoEmoji: "✨",
      stage: "Idea",
      oneLiner: "",
      progress: 0,
      isPrimary: false,
    };
    setBuilds((cur) => [...cur, newBuild]);
    toast("Side bet started");
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Good morning, {firstName}.</h1>
        <p className="text-sm text-slate-500 mt-0.5">{today} · Week {weeksBuilding} of building</p>
      </div>

      {/* Your ventures — multi-project portfolio (S7) */}
      {ventures.length > 0 && (
        <div className="border border-slate-200 bg-white rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700">Your ventures</h2>
            <button
              type="button"
              onClick={() => navigate("/incubation-hub")}
              className="text-xs text-violet-600 hover:underline"
            >
              + Analyze a new idea
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {ventures.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setActiveVentureId(v.id)}
                className={`text-left rounded-lg border px-3 py-2 transition-colors ${
                  activeVentureId === v.id
                    ? "border-violet-400 bg-violet-50"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">{v.title}</span>
                  {v.isPrimary && <span className="text-[10px] uppercase tracking-wide text-violet-600">Primary</span>}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-slate-500 capitalize">{v.stage}</span>
                  <span className="text-xs text-slate-400">GSIS {Math.round(v.gsisScore)}</span>
                  <span className={`text-xs ${v.hasWorkspace ? "text-emerald-600" : "text-slate-400"}`}>
                    {v.hasWorkspace ? "● workspace" : "no workspace"}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Startup hero */}
      <Link to="/incubation-hub" className="block group border border-slate-200 bg-white rounded-xl p-6 hover:border-violet-300 transition-colors">
        <div className="flex items-start gap-4">
          <span className="text-4xl">{p.logoEmoji}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-xl font-bold text-slate-900">{p.startupName}</h2>
              <span className={`text-xs px-2 py-0.5 rounded-full ${stageStyles[p.stage] ?? "bg-slate-100 text-slate-700"}`}>{p.stage}</span>
            </div>
            <p className="text-sm text-slate-600 mb-3">{p.oneLiner}</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-2xl font-bold text-slate-900 tabular-nums">{p.users.toLocaleString()}</p>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Active users</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 tabular-nums">${p.revenueMonthly.toLocaleString()}/mo</p>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Revenue</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 tabular-nums">{p.openRoles.length} of 5</p>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Open roles</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 tabular-nums">—</p>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Top investor fit</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-100 text-sm">
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); navigate("/founder/settings#startup"); }}
            className="text-violet-600 hover:underline"
          >
            Edit startup details →
          </button>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); navigate("/founder/profile"); }}
            className="text-violet-600 hover:underline"
          >
            View public profile →
          </button>
        </div>
      </Link>

      {/* GSIS — Global Startup Intelligence Score (from ai-router) */}
      {intel?.gsis && (
        <div className="border border-slate-200 bg-white rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-700">Global Startup Intelligence Score</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {intel.gsis.classification ?? "Master composite"} · live from the AI engine
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-violet-700 tabular-nums leading-none">
                {Math.round(intel.gsis.gsis)}
              </p>
              <p className="text-xs text-slate-400 mt-1">/ 100</p>
            </div>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden mt-4">
            <div className="h-full bg-gradient-to-r from-violet-500 to-indigo-500"
              style={{ width: `${Math.min(100, Math.round(intel.gsis.gsis))}%` }} />
          </div>
          {intel.gsis.components && (
            <div className="grid grid-cols-3 gap-3 mt-4">
              {Object.entries(intel.gsis.components).slice(0, 3).map(([k, v]) => (
                <div key={k}>
                  <p className="text-lg font-bold text-slate-900 tabular-nums">{Math.round(Number(v))}</p>
                  <p className="text-xs text-slate-500 capitalize">{k.replace(/([A-Z])/g, " $1")}</p>
                </div>
              ))}
            </div>
          )}
          {intel.alerts?.length > 0 && (
            <ul className="mt-4 space-y-1.5">
              {intel.alerts.slice(0, 3).map((a, i) => (
                <li key={a.id ?? i} className="text-xs text-amber-700 flex items-start gap-1.5">
                  <span className="mt-0.5">•</span><span>{a.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Momentum briefing (B5) + risk alerts (B4) from the AI engine */}
      <div className="border border-slate-200 bg-white rounded-xl p-4 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={playBriefing}
          disabled={briefingLoading}
          className="text-sm px-3 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-500 disabled:bg-slate-300"
        >
          {briefingLoading ? "Preparing…" : "▶ Play momentum briefing"}
        </button>
        {briefingUrl && <span className="text-xs text-slate-400">Audio ready</span>}
        {riskFlags.length > 0 && (
          <div className="flex-1 min-w-[12rem]">
            <p className="text-xs font-semibold text-amber-700 mb-1">Engine risk alerts</p>
            <ul className="space-y-0.5">
              {riskFlags.slice(0, 3).map((f, i) => (
                <li key={i} className="text-xs text-amber-700 flex items-start gap-1.5">
                  <span className="mt-0.5">⚠</span>
                  <span>{f.message ?? f.type ?? "Risk flag"}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Journey strip */}
      <div className="border border-slate-200 bg-white rounded-xl p-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Journey</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {journey.map((s) => {
            const isOpen = openStage === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setOpenStage(isOpen ? null : s.id)}
                className={`text-left p-3 rounded-lg border transition-colors ${
                  s.status === "complete" ? "border-violet-200 bg-white" :
                  s.status === "active"   ? "border-violet-200 bg-violet-50" :
                                            "border-slate-200 bg-slate-50"
                }`}
              >
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{s.label}</p>
                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${
                      s.status === "complete" ? "bg-violet-200" :
                      s.status === "active"   ? "bg-violet-600" :
                                                "bg-slate-200"
                    }`}
                    style={{ width: `${s.progress}%` }}
                  />
                </div>
                <p className="text-xs text-slate-700 mt-1.5 tabular-nums">{s.progress}%</p>
              </button>
            );
          })}
        </div>
        {openStage && (
          <div className="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700">
            {journey.find((j) => j.id === openStage)?.detail}
          </div>
        )}
      </div>

      {/* Today's focus + Signals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 border border-slate-200 bg-white rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700">Today's focus</h2>
            <Link to="/incubation-hub" className="text-xs text-violet-600 hover:underline">View all tasks →</Link>
          </div>
          <ul className="space-y-3">
            {tasks.map((t) => (
              <li key={t.id} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={t.done}
                  onChange={() => toggleTask(t.id)}
                  className="w-4 h-4 accent-violet-600 cursor-pointer"
                />
                <Link to={t.href} className={`flex-1 min-w-0 ${t.done ? "opacity-50 line-through" : ""}`}>
                  <p className="text-sm font-medium text-slate-900 truncate">{t.title}</p>
                  <p className="text-xs text-slate-500">{t.detail}</p>
                </Link>
                <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider ${priorityStyles[t.priority]}`}>{t.priority}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="border border-slate-200 bg-white rounded-xl p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Signals</h2>
          <ul className="space-y-3">
            {signals.map((s) => (
              <li key={s.id}>
                <Link to={s.href} className="flex items-start gap-2 text-sm text-slate-700 hover:text-violet-600 group">
                  <CheckCircle className="w-4 h-4 mt-0.5 text-slate-400 group-hover:text-violet-600 shrink-0" />
                  <span className="flex-1">{s.message}</span>
                  <ArrowRight className="w-4 h-4 mt-0.5 text-slate-300 group-hover:text-violet-600 shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Active builds */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Active builds</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {builds.map((b) => (
            <div key={b.id} className="border border-slate-200 bg-white rounded-xl p-4">
              <div className="flex items-start gap-3 mb-3">
                <span className="text-2xl">{b.logoEmoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{b.name}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${stageStyles[b.stage] ?? "bg-slate-100 text-slate-700"}`}>{b.stage}</span>
                </div>
              </div>
              {b.oneLiner && <p className="text-xs text-slate-600 mb-3">{b.oneLiner}</p>}
              <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden mb-3">
                <div className="h-full bg-violet-600" style={{ width: `${b.progress}%` }} />
              </div>
              <button
                type="button"
                onClick={() => navigate(`/workspaces/build?startup=${b.id}`)}
                className="text-xs text-violet-600 hover:underline"
              >
                Open workspace →
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={startSideBet}
            className="border border-dashed border-slate-300 rounded-xl p-4 text-sm text-slate-500 hover:border-violet-400 hover:text-violet-600 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Start a side bet
          </button>
        </div>
      </div>

      {/* Recent activity */}
      <div className="border border-slate-200 bg-white rounded-xl p-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Recent activity</h2>
        <ul className="space-y-2">
          {recentActivity.map((a) => (
            <li key={a.id} className="flex items-center gap-3 text-sm">
              <span className="text-base">{a.buildLogo}</span>
              <span className="font-medium text-slate-900">{a.buildName}</span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-700 flex-1 truncate">{a.message}</span>
              <span className="text-xs text-slate-500 shrink-0">{formatRelative(a.timestampISO)}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Hackathon Momentum */}
      {(() => {
        const regs = p.hackathonRegistrations;
        if (regs.length === 0) {
          return (
            <div className="border border-slate-200 bg-white rounded-xl p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-sm font-semibold text-slate-700">Hackathon Momentum</h2>
                    <TrendingUp className="w-4 h-4 text-slate-400" />
                  </div>
                  <p className="text-sm text-slate-600">
                    No active hackathons. Join a hackathon from the Opportunity Hub to see your team's momentum
                    tracker here — 4-hour check-ins, build velocity, blockers.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/opportunity-hub")}
                  className="text-xs font-medium text-violet-700 px-3 py-1.5 rounded-lg border border-violet-200 hover:bg-violet-50 flex items-center gap-2 shrink-0"
                >
                  Browse opportunities →
                </button>
              </div>
            </div>
          );
        }
        return (
          <div className="border border-slate-200 bg-white rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-sm font-semibold text-slate-700">Hackathon Momentum</h2>
              <TrendingUp className="w-4 h-4 text-slate-400" />
            </div>
            <ul className="space-y-3">
              {regs.map((r) => {
                const h = OPPORTUNITIES.find((o): o is Hackathon => o.type === "hackathon" && o.id === r.hackathonId);
                if (!h) return null;
                const memberCount = r.members.length + 1;
                const teamSize = memberCount + r.openRoles.length;
                const startMs = new Date(h.startDate).getTime() - Date.now();
                const days = Math.max(0, Math.ceil(startMs / (1000 * 60 * 60 * 24)));
                const startsLabel = days <= 7 ? `Starts in ${days} days` : `Starts ${h.startDate}`;
                const momentum = computeMomentum(r, Date.now());
                const momColor = momentumColor(momentum.score);
                const ctaLabel =
                  momentum.nextAction === "submit-brief" ? "Submit brief →"
                  : momentum.nextAction === "log-check-in" ? "Log check-in →"
                  : "Open team";
                const ctaStage = momentum.nextAction === "submit-brief" ? "brief" : "build";
                return (
                  <li key={r.teamId} className="flex items-start gap-3 border border-slate-100 rounded-lg p-3">
                    <span className="text-xl shrink-0" aria-hidden="true">{h.poster}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{h.title}</p>
                      <p className="text-xs text-slate-500">
                        {r.teamName} · {memberCount} of {teamSize} members · {startsLabel}
                      </p>
                      <p className="text-xs text-slate-600 mt-1 font-medium">{momentum.nextActionLabel}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-2xl font-bold leading-none ${momColor.text}`}>{momentum.score}</p>
                      <div className="h-1.5 w-16 rounded-full bg-slate-100 mt-1 ml-auto">
                        <div className={`h-1.5 rounded-full ${momColor.bar}`} style={{ width: `${momentum.score}%` }} />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(`/incubation-hub?panel=hackathon&stage=${ctaStage}`)}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 shrink-0 self-center"
                    >
                      {ctaLabel}
                    </button>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              onClick={() => navigate("/opportunity-hub")}
              className="mt-4 text-xs font-medium text-violet-700 hover:underline"
            >
              Browse more opportunities →
            </button>
          </div>
        );
      })()}
    </div>
  );
}
