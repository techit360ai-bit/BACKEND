import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Trophy,
  Calendar,
  Users,
  Sparkles,
  DollarSign,
  Activity,
  Gavel,
  FileText,
  ClipboardList,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  UserPlus,
  Mail,
  Flame,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Award,
} from "lucide-react";
import {
  fetchHackathonOverview, fetchHackathonVelocity,
  type HackathonOverview, type VelocityCell,
} from "@/lib/api/hackathon";

type TabId = "overview" | "registration" | "live" | "judging" | "report";

const tabs: { id: TabId; label: string; icon: typeof Trophy }[] = [
  { id: "overview", label: "Overview", icon: ClipboardList },
  { id: "registration", label: "Registration & Teams", icon: Users },
  { id: "live", label: "Live Command Centre", icon: Activity },
  { id: "judging", label: "Judging", icon: Gavel },
  { id: "report", label: "Intelligence Report", icon: FileText },
];

export function HackathonDetail() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<TabId>("overview");

  // Mock event metadata — in production this comes from the API by id
  const event = {
    id: id ?? "ai-for-africa-2026",
    title: id?.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) ?? "Hackathon",
    theme: "AI agents that solve a real African problem",
    startDate: "2026-06-12",
    endDate: "2026-06-14",
    durationHours: 48,
    registrants: 420,
    teamsFormed: 87,
    soloRegistrants: 64,
    prizePool: "$50,000",
    partners: ["TechIT", "Google for Startups", "Lagos Innovation Hub"],
    status: "live" as "upcoming" | "live" | "judging" | "completed",
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
      <Link
        to="/org/hackathons"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-indigo-600 transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        All hackathons
      </Link>

      {/* Event header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <span className="bg-indigo-100 p-2 rounded-lg">
                <Trophy className="w-6 h-6 text-indigo-600" />
              </span>
              <h1 className="text-2xl font-bold text-gray-900">
                {event.title}
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            </div>
            <p className="text-sm text-gray-600 mb-4">{event.theme}</p>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-gray-500">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                {event.startDate} → {event.endDate} ({event.durationHours}h)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                {event.registrants} registrants
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                {event.teamsFormed} teams
              </span>
              <span className="inline-flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5" />
                {event.prizePool} prizes
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-[10px] font-mono uppercase tracking-wider text-gray-400">
              Partners
            </p>
            <div className="flex flex-wrap gap-1.5">
              {event.partners.map((p) => (
                <span
                  key={p}
                  className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 font-medium"
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex overflow-x-auto gap-1 mb-6 border-b border-gray-200 -mb-px">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                active
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-900"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === "overview" && <OverviewTab />}
      {tab === "registration" && <RegistrationTab hackathonId={event.id} />}
      {tab === "live" && <LiveCommandCentreTab hackathonId={event.id} />}
      {tab === "judging" && <JudgingTab />}
      {tab === "report" && <IntelligenceReportTab />}
    </div>
  );
}

// ─── Overview ─────────────────────────────────────────────────

function OverviewTab() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2" title="Event timeline" icon={Calendar}>
        <ol className="space-y-3">
          {[
            { time: "T−7 days", event: "Registration opens" },
            { time: "T−24h", event: "Team formation deadline" },
            { time: "T0", event: "Build window begins" },
            { time: "T+12h", event: "First mentor check-in" },
            { time: "T+24h", event: "Mid-event problem brief due" },
            { time: "T+48h", event: "Prototype demo submission" },
            { time: "T+50h", event: "Judging begins" },
          ].map((row, i) => (
            <li key={i} className="flex gap-3 items-start text-sm">
              <span className="w-16 flex-shrink-0 text-[10px] font-mono uppercase tracking-wider text-indigo-600 font-semibold pt-0.5">
                {row.time}
              </span>
              <span className="text-gray-700">{row.event}</span>
            </li>
          ))}
        </ol>
      </Card>

      <Card title="Prize structure" icon={DollarSign}>
        <ul className="space-y-2.5">
          {[
            { rank: "1st place", amount: "$25,000", color: "text-amber-600" },
            { rank: "2nd place", amount: "$15,000", color: "text-gray-600" },
            { rank: "3rd place", amount: "$10,000", color: "text-orange-600" },
          ].map((p) => (
            <li
              key={p.rank}
              className="flex items-center justify-between p-3 rounded-lg bg-gray-50"
            >
              <span className={`text-sm font-semibold ${p.color}`}>
                {p.rank}
              </span>
              <span className="text-sm font-bold text-gray-900">
                {p.amount}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

// ─── Stage 1: Registration & Teams ────────────────────────────

function RegistrationTab({ hackathonId }: { hackathonId: string }) {
  // Real registrant/team/solo counts from ai-router, polled for live-ness.
  const [overview, setOverview] = useState<HackathonOverview | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => fetchHackathonOverview(hackathonId).then((o) => { if (alive) setOverview(o); });
    load();
    const t = setInterval(load, 15000);
    return () => { alive = false; clearInterval(t); };
  }, [hackathonId]);

  const soloRegistrants = [
    { name: "Adaeze O.", role: "Backend Dev", cbs: 82, tss: "React, Node", crs: 91 },
    { name: "Liam W.", role: "Product Designer", cbs: 78, tss: "Figma, UX", crs: 88 },
    { name: "Noor K.", role: "ML Engineer", cbs: 85, tss: "PyTorch, NLP", crs: 86 },
  ];
  const teams = [
    {
      name: "Loom Health",
      members: ["AO", "LW", "NK"],
      avgCBS: 82,
      avgCRS: 88,
      formed: "12 mins ago",
    },
    {
      name: "Solaris",
      members: ["SR", "MH", "TC", "JL"],
      avgCBS: 76,
      avgCRS: 81,
      formed: "1 hour ago",
    },
    {
      name: "Verdant",
      members: ["RB", "EF"],
      avgCBS: 71,
      avgCRS: 92,
      formed: "3 hours ago",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Stat label="Total registrants" value={String(overview?.registrants ?? 420)} delta="live" />
        <Stat label="Teams formed" value={String(overview?.teamsFormed ?? 87)} delta="solo → team 64% conv." />
        <Stat label="Still solo" value={String(overview?.stillSolo ?? 64)} delta="needs match" tone="warn" />
      </div>

      <Card title="MatchScore — solo registrants" icon={UserPlus}>
        <p className="text-xs text-gray-500 mb-4">
          Same algorithm used for startup team matching. Builders are paired by
          complementary skills and platform scores.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
                <th className="text-left font-semibold py-2 px-3">Builder</th>
                <th className="text-left font-semibold py-2 px-3">Role</th>
                <th className="text-left font-semibold py-2 px-3">CBS</th>
                <th className="text-left font-semibold py-2 px-3">TSS</th>
                <th className="text-left font-semibold py-2 px-3">CRS</th>
                <th className="text-left font-semibold py-2 px-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {soloRegistrants.map((r) => (
                <tr key={r.name} className="border-b border-gray-100">
                  <td className="py-3 px-3 font-semibold text-gray-900">
                    {r.name}
                  </td>
                  <td className="py-3 px-3 text-gray-700">{r.role}</td>
                  <td className="py-3 px-3 text-emerald-600 font-bold tabular-nums">
                    {r.cbs}
                  </td>
                  <td className="py-3 px-3 text-gray-700">{r.tss}</td>
                  <td className="py-3 px-3 text-blue-600 font-bold tabular-nums">
                    {r.crs}
                  </td>
                  <td className="py-3 px-3">
                    <button className="text-xs font-semibold px-3 py-1.5 rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors inline-flex items-center gap-1">
                      Suggest matches
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Teams formalised on the platform" icon={Users}>
        <p className="text-xs text-gray-500 mb-4">
          Team composition is recorded. Every member's CBS, TSS and CRS are
          visible before commit — no more discovering an unreliable teammate on
          day three.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {teams.map((t) => (
            <div
              key={t.name}
              className="rounded-lg border border-gray-200 p-4 hover:border-indigo-200 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-bold text-gray-900">{t.name}</h4>
                <span className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">
                  {t.formed}
                </span>
              </div>
              <div className="flex -space-x-2 mb-3">
                {t.members.map((m) => (
                  <span
                    key={m}
                    className="w-7 h-7 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-indigo-700"
                  >
                    {m}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="rounded-md bg-emerald-50 px-2 py-1.5">
                  <p className="text-emerald-700 font-mono uppercase tracking-wider">
                    Avg CBS
                  </p>
                  <p className="text-base font-bold text-emerald-900">
                    {t.avgCBS}
                  </p>
                </div>
                <div className="rounded-md bg-blue-50 px-2 py-1.5">
                  <p className="text-blue-700 font-mono uppercase tracking-wider">
                    Avg CRS
                  </p>
                  <p className="text-base font-bold text-blue-900">{t.avgCRS}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── Live Command Centre ──────────────────────────────────────

function LiveCommandCentreTab({ hackathonId }: { hackathonId: string }) {
  // Real build-velocity from ai-router check-ins, polled every 10s for live-ness.
  // Replaces the previous Math.random() placeholder.
  const [velocity, setVelocity] = useState<VelocityCell[]>([]);
  const [overview, setOverview] = useState<HackathonOverview | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => {
      fetchHackathonVelocity(hackathonId).then((v) => { if (alive) setVelocity(v); });
      fetchHackathonOverview(hackathonId).then((o) => { if (alive) setOverview(o); });
    };
    load();
    const t = setInterval(load, 10000);
    return () => { alive = false; clearInterval(t); };
  }, [hackathonId]);

  // Build the heatmap from real cells; fall back to a deterministic placeholder
  // grid (no randomness) when the backend has no data yet.
  const heatmap = velocity.length
    ? velocity.map((c, i) => ({ team: c.name?.slice(0, 6) || `T${i + 1}`, activity: c.activity }))
    : Array.from({ length: 30 }, (_, i) => ({
        team: `T${(i + 1).toString().padStart(2, "0")}`,
        activity: (i * 37) % 100,
      }));

  const avgVelocity = overview ? Math.round(overview.avgBuildVelocity) : 64;
  const ideaSubs = overview ? `${overview.ideaSubmissions} / ${overview.totalTeams}` : "58 / 87";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Stat
          label="Team formation rate"
          value="78%"
          delta="+12% in last hour"
          tone="good"
        />
        <Stat
          label="Idea submissions"
          value={ideaSubs}
          delta="live"
          tone="warn"
        />
        <Stat
          label="Mentor sessions booked"
          value="34"
          delta="71% completed"
        />
        <Stat
          label="Avg build velocity"
          value={String(avgVelocity)}
          delta="live from check-ins"
          tone="good"
        />
      </div>

      <Card title="Build velocity heatmap" icon={Flame}>
        <p className="text-xs text-gray-500 mb-4">
          Each cell is a team's 4-hour check-in score. Green = high activity,
          amber = medium, red = stalled. Mentors are auto-routed to red cells.
        </p>
        <div className="grid grid-cols-10 gap-1.5">
          {heatmap.map((c) => {
            const color =
              c.activity > 66
                ? "bg-emerald-500"
                : c.activity > 33
                  ? "bg-amber-400"
                  : "bg-red-500";
            return (
              <div
                key={c.team}
                className={`aspect-square rounded ${color} flex items-center justify-center text-[8px] font-mono text-white font-bold`}
                title={`${c.team}: ${c.activity}%`}
              >
                {c.team}
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-4 text-[10px] text-gray-500 font-mono uppercase tracking-wider">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded bg-emerald-500" /> High
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded bg-amber-400" /> Medium
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded bg-red-500" /> Stalled
          </span>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Idea submission progress" icon={ClipboardList}>
          <div className="space-y-3">
            <Progress label="Submitted" value={58} total={87} color="bg-emerald-500" />
            <Progress label="Draft in progress" value={20} total={87} color="bg-amber-400" />
            <Progress label="Not started" value={9} total={87} color="bg-red-500" />
          </div>
          <button className="mt-4 text-xs font-semibold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1">
            <Mail className="w-3.5 h-3.5" />
            Nudge teams without submission
          </button>
        </Card>

        <Card title="Problem diversity" icon={Layers}>
          <p className="text-xs text-gray-500 mb-3">
            Clustering of submitted ideas by sector.
          </p>
          <ul className="space-y-2">
            {[
              { sector: "FinTech", count: 22, pct: 30 },
              { sector: "Health", count: 18, pct: 24 },
              { sector: "Climate", count: 11, pct: 15 },
              { sector: "Logistics", count: 9, pct: 12 },
              { sector: "Education", count: 8, pct: 11 },
              { sector: "Other", count: 6, pct: 8 },
            ].map((s) => (
              <li key={s.sector} className="flex items-center gap-3">
                <span className="w-20 text-sm text-gray-700 font-medium">
                  {s.sector}
                </span>
                <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full bg-indigo-500"
                    style={{ width: `${s.pct}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500 tabular-nums w-12 text-right">
                  {s.count}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="Mentor utilisation" icon={Award}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <Stat label="Sessions booked" value="34" />
          <Stat label="Completed" value="24" />
          <Stat label="Avg rating" value="4.6 / 5" />
        </div>
        <div className="rounded-md bg-amber-50 border border-amber-200 p-3 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-900">
            <span className="font-semibold">8 teams</span> have not booked any
            mentor session. Historically this correlates with lower conversion —
            consider routing a mentor proactively.
          </p>
        </div>
      </Card>
    </div>
  );
}

// ─── Stage 4: Judging ─────────────────────────────────────────

function JudgingTab() {
  const sampleTeam = {
    name: "Loom Health",
    judgeScores: {
      problem_clarity: 8.5,
      solution_innovation: 9.2,
      technical_execution: 7.8,
      team_communication: 8.0,
      commercial_viability: 8.7,
    },
    platformScores: {
      problem_clarity_score: 91,
      team_momentum_score: 84,
      demo_readiness_hours: 6, // hours before deadline
    },
  };

  // Composite Hackathon Score formula (illustrative weighting)
  const judgeAvg =
    Object.values(sampleTeam.judgeScores).reduce((a, b) => a + b, 0) /
    Object.values(sampleTeam.judgeScores).length;
  const judgePct = (judgeAvg / 10) * 100;
  const platformAvg =
    (sampleTeam.platformScores.problem_clarity_score +
      sampleTeam.platformScores.team_momentum_score +
      Math.min(100, sampleTeam.platformScores.demo_readiness_hours * 6)) /
    3;
  const composite = Math.round(judgePct * 0.5 + platformAvg * 0.5);

  return (
    <div className="space-y-6">
      <Card title="Composite Hackathon Score — formula" icon={Gavel}>
        <p className="text-xs text-gray-500 mb-4">
          A team that pivoted three times, had low build velocity and finished
          their prototype in the last hour gets scored lower on the platform
          metrics even if judges loved the demo.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-4">
            <p className="text-[10px] font-mono uppercase tracking-wider text-indigo-600 mb-2">
              50% — Judge scores
            </p>
            <ul className="space-y-1.5 text-sm">
              <li className="flex justify-between">
                <span className="text-gray-700">Problem Clarity</span>
                <span className="font-bold text-gray-900">1–10</span>
              </li>
              <li className="flex justify-between">
                <span className="text-gray-700">Solution Innovation</span>
                <span className="font-bold text-gray-900">1–10</span>
              </li>
              <li className="flex justify-between">
                <span className="text-gray-700">Technical Execution</span>
                <span className="font-bold text-gray-900">1–10</span>
              </li>
              <li className="flex justify-between">
                <span className="text-gray-700">Team Communication</span>
                <span className="font-bold text-gray-900">1–10</span>
              </li>
              <li className="flex justify-between">
                <span className="text-gray-700">Commercial Viability</span>
                <span className="font-bold text-gray-900">1–10</span>
              </li>
            </ul>
          </div>
          <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-4">
            <p className="text-[10px] font-mono uppercase tracking-wider text-emerald-700 mb-2">
              50% — Platform-computed
            </p>
            <ul className="space-y-1.5 text-sm">
              <li className="flex justify-between">
                <span className="text-gray-700">Problem Clarity Score</span>
                <span className="font-bold text-gray-900">0–100</span>
              </li>
              <li className="flex justify-between">
                <span className="text-gray-700">Team Momentum Score</span>
                <span className="font-bold text-gray-900">0–100</span>
              </li>
              <li className="flex justify-between">
                <span className="text-gray-700">Demo Readiness time</span>
                <span className="font-bold text-gray-900">earlier = higher</span>
              </li>
            </ul>
          </div>
        </div>
      </Card>

      <Card
        title={`Composite score example — ${sampleTeam.name}`}
        icon={Sparkles}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          <div className="rounded-lg border border-gray-200 p-4 bg-white">
            <p className="text-[10px] font-mono uppercase tracking-wider text-gray-500 mb-1">
              Judge average
            </p>
            <p className="text-3xl font-bold text-indigo-600">
              {judgeAvg.toFixed(1)}
              <span className="text-base text-gray-400">/10</span>
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 p-4 bg-white">
            <p className="text-[10px] font-mono uppercase tracking-wider text-gray-500 mb-1">
              Platform metrics avg
            </p>
            <p className="text-3xl font-bold text-emerald-600">
              {platformAvg.toFixed(0)}
              <span className="text-base text-gray-400">/100</span>
            </p>
          </div>
          <div className="rounded-lg border-2 border-indigo-300 p-4 bg-gradient-to-br from-indigo-50 to-emerald-50">
            <p className="text-[10px] font-mono uppercase tracking-wider text-indigo-600 mb-1">
              Composite Hackathon Score
            </p>
            <p className="text-3xl font-bold text-gray-900">
              {composite}
              <span className="text-base text-gray-400">/100</span>
            </p>
          </div>
        </div>
        <p className="text-xs text-gray-500">
          Prototype submitted{" "}
          <span className="font-semibold">
            {sampleTeam.platformScores.demo_readiness_hours}h before deadline
          </span>{" "}
          — counted positively against last-hour scramblers.
        </p>
      </Card>
    </div>
  );
}

// ─── Post-Event Intelligence Report ───────────────────────────

function IntelligenceReportTab() {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-emerald-900">
            Auto-generated within 24 hours of the event ending
          </p>
          <p className="text-xs text-emerald-700 mt-0.5">
            A real ROI document — not a thank-you slide deck. Refreshes every
            6 months for cohort trajectory.
          </p>
        </div>
      </div>

      <Card title="Participation summary" icon={Users}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <Stat label="Registrants" value="420" />
          <Stat label="Teams formed" value="87" />
          <Stat label="Solo → team conv." value="64%" tone="good" />
          <Stat label="Dropout rate" value="11%" tone="warn" />
          <Stat label="Completion rate" value="79%" tone="good" />
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Problem landscape" icon={Layers}>
          <p className="text-xs text-gray-500 mb-3">
            Thematic clustering of all submitted ideas by sector.
          </p>
          <ul className="space-y-2">
            {[
              { sector: "FinTech", count: 22, score: 78 },
              { sector: "Health", count: 18, score: 81 },
              { sector: "Climate", count: 11, score: 72 },
              { sector: "Logistics", count: 9, score: 69 },
              { sector: "Education", count: 8, score: 64 },
            ].map((s) => (
              <li
                key={s.sector}
                className="flex items-center justify-between p-2 rounded-md hover:bg-gray-50"
              >
                <span className="text-sm font-medium text-gray-700">
                  {s.sector}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 tabular-nums">
                    {s.count} ideas
                  </span>
                  <span className="text-xs font-semibold text-indigo-600 tabular-nums">
                    impact {s.score}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Execution quality distribution" icon={TrendingUp}>
          <p className="text-xs text-gray-500 mb-3">
            Histogram of Team Momentum Scores. Skewed low? Problem statement
            was too vague or the window too short.
          </p>
          <div className="space-y-2.5">
            {[
              { range: "80–100", count: 14, color: "bg-emerald-500" },
              { range: "60–79", count: 31, color: "bg-emerald-400" },
              { range: "40–59", count: 24, color: "bg-amber-400" },
              { range: "20–39", count: 13, color: "bg-orange-400" },
              { range: "0–19", count: 5, color: "bg-red-500" },
            ].map((b) => (
              <div key={b.range} className="flex items-center gap-3">
                <span className="w-14 text-xs text-gray-500 font-mono">
                  {b.range}
                </span>
                <div className="flex-1 h-5 rounded-md bg-gray-100 overflow-hidden">
                  <div
                    className={`h-full ${b.color}`}
                    style={{ width: `${(b.count / 31) * 100}%` }}
                  />
                </div>
                <span className="w-8 text-xs text-gray-700 tabular-nums text-right font-semibold">
                  {b.count}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Conversion pipeline" icon={ArrowUpRight}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <PipelineCell label="CRS > 7" value="14 teams" delta="incubation invites" />
          <PipelineCell label="CRS 4–6" value="31 teams" delta="prototype track" />
          <PipelineCell label="CRS < 4" value="42 teams" delta="back to learning" tone="dim" />
          <PipelineCell
            label="Accepted incubation"
            value="9 of 14"
            delta="64% close rate"
            tone="good"
          />
        </div>
      </Card>

      <Card title="Cohort trajectory tracking" icon={Activity}>
        <p className="text-xs text-gray-500 mb-3">
          6 months after this event the platform tracks every team from this
          cohort: still active, current stage, current GSIS.
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
              <th className="text-left font-semibold py-2">Team</th>
              <th className="text-left font-semibold py-2">Status</th>
              <th className="text-left font-semibold py-2">Stage</th>
              <th className="text-left font-semibold py-2">GSIS</th>
              <th className="text-left font-semibold py-2">Trend</th>
            </tr>
          </thead>
          <tbody>
            {[
              { name: "Loom Health", status: "Active", stage: "MVP", gsis: 82, up: true },
              { name: "Solaris", status: "Active", stage: "Seed", gsis: 76, up: true },
              { name: "Verdant", status: "Stalled", stage: "Idea", gsis: 41, up: false },
              { name: "Northwind", status: "Acquired", stage: "—", gsis: 91, up: true },
            ].map((row) => (
              <tr key={row.name} className="border-b border-gray-100">
                <td className="py-3 font-semibold text-gray-900">{row.name}</td>
                <td className="py-3 text-gray-700">{row.status}</td>
                <td className="py-3 text-gray-700">{row.stage}</td>
                <td className="py-3 font-bold tabular-nums text-gray-900">
                  {row.gsis}
                </td>
                <td className="py-3">
                  {row.up ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      up
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-red-600 font-semibold">
                      <ArrowDownRight className="w-3.5 h-3.5" />
                      down
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Sponsor & partner reporting" icon={Award}>
        <p className="text-xs text-gray-500 mb-3">
          Auto-generated for each sponsor. The honest ROI document — what their
          money produced.
        </p>
        <div className="space-y-3">
          {[
            { partner: "Google for Startups", teams: 87, ideas: 87, prototypes: 68, launched: 4 },
            { partner: "Lagos Innovation Hub", teams: 87, ideas: 87, prototypes: 68, launched: 4 },
          ].map((s) => (
            <div
              key={s.partner}
              className="rounded-lg border border-gray-200 p-4 bg-white"
            >
              <p className="font-semibold text-gray-900 mb-2">{s.partner}</p>
              <div className="grid grid-cols-4 gap-2 text-center">
                <PartnerStat label="Teams formed" value={s.teams} />
                <PartnerStat label="Ideas submitted" value={s.ideas} />
                <PartnerStat label="Prototypes built" value={s.prototypes} />
                <PartnerStat label="Companies launched" value={s.launched} tone="good" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── Small primitives ─────────────────────────────────────────

function Card({
  icon: Icon,
  title,
  children,
  className = "",
}: {
  icon: typeof Trophy;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-white border border-gray-200 rounded-xl p-5 ${className}`}
    >
      <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-4">
        <Icon className="w-5 h-5 text-indigo-600" />
        {title}
      </h3>
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  delta,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  delta?: string;
  tone?: "good" | "warn" | "neutral";
}) {
  const toneColor =
    tone === "good"
      ? "text-emerald-600"
      : tone === "warn"
        ? "text-amber-600"
        : "text-gray-500";
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-[10px] font-mono uppercase tracking-wider text-gray-400 mb-1">
        {label}
      </p>
      <p className="text-2xl font-bold text-gray-900 tabular-nums">{value}</p>
      {delta && <p className={`text-xs mt-1 ${toneColor}`}>{delta}</p>}
    </div>
  );
}

function Progress({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = (value / total) * 100;
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-600 mb-1">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums">
          {value} / {total}
        </span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function PipelineCell({
  label,
  value,
  delta,
  tone = "neutral",
}: {
  label: string;
  value: string;
  delta: string;
  tone?: "good" | "dim" | "neutral";
}) {
  const valueColor =
    tone === "good"
      ? "text-emerald-700"
      : tone === "dim"
        ? "text-gray-500"
        : "text-indigo-700";
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
      <p className="text-[10px] font-mono uppercase tracking-wider text-gray-400 mb-1">
        {label}
      </p>
      <p className={`text-lg font-bold ${valueColor}`}>{value}</p>
      <p className="text-[10px] text-gray-500 mt-1">{delta}</p>
    </div>
  );
}

function PartnerStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "good";
}) {
  return (
    <div className="rounded-md bg-gray-50 p-2">
      <p className="text-[10px] font-mono uppercase tracking-wider text-gray-500">
        {label}
      </p>
      <p
        className={`text-lg font-bold tabular-nums ${tone === "good" ? "text-emerald-600" : "text-gray-900"}`}
      >
        {value}
      </p>
    </div>
  );
}
