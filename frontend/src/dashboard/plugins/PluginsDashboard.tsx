import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import {
  Boxes,
  ShieldCheck,
  ScrollText,
  Activity,
  AlertTriangle,
  Play,
  Check,
  RefreshCw,
  Wifi,
  WifiOff,
  ArrowLeft,
  CircleCheck,
  CircleX,
  Clock,
  Ban,
  Plug,
  GitPullRequest,
  Bot,
  User,
} from "lucide-react";
import {
  techitApi,
  type ApprovalRequest,
  type AuditEntry,
  type CatalogueEntry,
  type ContributionEvent,
  type InvokeResult,
} from "@/lib/techitApi";

const heading = { fontFamily: "Space Grotesk, sans-serif" } as const;
const POLL_MS = 4000;

const timeOf = (ts: string) => ts.slice(11, 19);

/* ------------------------------------------------------------------ */
/* Status pill — color + icon (never color alone), dark-aware          */
/* ------------------------------------------------------------------ */
const RESULT_META: Record<
  AuditEntry["result"],
  { cls: string; icon: ReactNode; label: string }
> = {
  success: {
    cls: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/15 dark:text-emerald-400 dark:ring-emerald-500/30",
    icon: <CircleCheck className="w-3.5 h-3.5" />,
    label: "success",
  },
  failure: {
    cls: "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/15 dark:text-red-400 dark:ring-red-500/30",
    icon: <CircleX className="w-3.5 h-3.5" />,
    label: "failure",
  },
  denied: {
    cls: "bg-muted text-muted-foreground ring-border",
    icon: <Ban className="w-3.5 h-3.5" />,
    label: "denied",
  },
  pending_approval: {
    cls: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/15 dark:text-amber-400 dark:ring-amber-500/30",
    icon: <Clock className="w-3.5 h-3.5" />,
    label: "pending",
  },
};

function ResultPill({ result }: { result: AuditEntry["result"] }) {
  const m = RESULT_META[result];
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ring-1 ring-inset ${m.cls}`}
    >
      {m.icon}
      {m.label}
    </span>
  );
}

function ActorChip({ kind, name }: { kind: "human" | "agent"; name: string }) {
  const agent = kind === "agent";
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
      <span
        className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${
          agent
            ? "bg-violet-500/15 text-violet-600 dark:text-violet-400"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {agent ? <Bot className="w-3 h-3" /> : <User className="w-3 h-3" />}
      </span>
      <span className="font-medium">{name}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function PluginsDashboard() {
  const [online, setOnline] = useState<boolean | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const [workspace, setWorkspace] = useState("");
  const [tools, setTools] = useState<CatalogueEntry[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [contribs, setContribs] = useState<ContributionEvent[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const [h, t, a, c, ap] = await Promise.all([
        techitApi.health(),
        techitApi.tools(),
        techitApi.audit(),
        techitApi.contributions(),
        techitApi.approvals(),
      ]);
      setOnline(true);
      setWorkspace(h.workspaceId);
      setTools(t);
      setAudit(a);
      setContribs(c);
      setApprovals(ap);
      setUpdatedAt(new Date().toLocaleTimeString());
    } catch {
      setOnline(false);
    } finally {
      setBusy(false);
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const pending = approvals.filter((a) => a.status === "pending");
  const destructiveCount = tools.filter((t) => t.tool.destructive).length;

  return (
    // Theme-driven: tokens flip with the global light/dark/auto toggle.
    // color-scheme follows the theme so native <select> dropdowns stay readable.
    <div className="min-h-screen bg-background text-foreground pb-16 [color-scheme:light] dark:[color-scheme:dark]">
      {/* ---- Gradient hero (reads well in both themes) ---- */}
      <header className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 text-white">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, white 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
          aria-hidden
        />
        <div className="relative max-w-7xl mx-auto px-6 pt-6 pb-24">
          <div className="flex items-center justify-between gap-4">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white transition-colors rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              <ArrowLeft className="w-4 h-4" /> Home
            </Link>
            <div className="flex items-center gap-2">
              <StatusBadge online={online} workspace={workspace} />
              <button
                onClick={refresh}
                aria-label="Refresh data"
                className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 backdrop-blur transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                <RefreshCw className={`w-4 h-4 ${busy ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>

          <div className="mt-8 flex items-center gap-3">
            <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white/15 backdrop-blur ring-1 ring-white/25">
              <Boxes className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-3xl font-bold tracking-tight" style={heading}>
                Plugins &amp; MCP
              </h1>
              <p className="text-white/75 text-sm mt-0.5">
                Integrate capabilities, not UIs — every connector is audited, permissioned and
                approval-gated by the SDK.
              </p>
            </div>
          </div>
          {updatedAt && (
            <p className="mt-3 text-xs text-white/60">
              Live · auto-refreshing every {POLL_MS / 1000}s · last updated {updatedAt}
            </p>
          )}
        </div>
      </header>

      {/* ---- KPI stat cards (overlap hero) ---- */}
      <div className="max-w-7xl mx-auto px-6 -mt-16 relative">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<Plug className="w-5 h-5" />}
            tone="indigo"
            value={tools.length}
            label="MCP Tools"
            hint={`${destructiveCount} approval-gated`}
            loading={!loaded}
          />
          <StatCard
            icon={<ShieldCheck className="w-5 h-5" />}
            tone="amber"
            value={pending.length}
            label="Pending Approvals"
            hint={pending.length ? "needs a human" : "all clear"}
            loading={!loaded}
          />
          <StatCard
            icon={<ScrollText className="w-5 h-5" />}
            tone="slate"
            value={audit.length}
            label="Audit Events"
            hint="immutable log"
            loading={!loaded}
          />
          <StatCard
            icon={<Activity className="w-5 h-5" />}
            tone="emerald"
            value={contribs.length}
            label="Contributions"
            hint="execution intelligence"
            loading={!loaded}
          />
        </div>
      </div>

      {online === false && (
        <div className="max-w-7xl mx-auto px-6 mt-6">
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-center gap-2">
            <WifiOff className="w-4 h-4 shrink-0" />
            Can't reach the API at <code className="font-mono">{techitApi.baseUrl}</code>. Start the
            backend: <code className="font-mono">cd backend &amp;&amp; npm run dev</code>.
          </div>
        </div>
      )}

      {/* ---- Main grid ---- */}
      <main className="max-w-7xl mx-auto px-6 mt-8 grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <ToolCatalogue tools={tools} loading={!loaded} />
          <Invoker tools={tools} onDone={refresh} />
        </div>
        <div className="space-y-6">
          <ApprovalsPanel pending={pending} onApprove={refresh} />
          <ContributionFeed events={contribs} />
        </div>
        <div className="xl:col-span-3">
          <AuditTable entries={audit} loading={!loaded} />
        </div>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Hero status badge                                                   */
/* ------------------------------------------------------------------ */
function StatusBadge({
  online,
  workspace,
}: {
  online: boolean | null;
  workspace: string;
}) {
  const text =
    online === null ? "connecting…" : online ? `online · ${workspace}` : "offline";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-white/15 backdrop-blur ring-1 ring-white/25">
      <span className="relative flex w-2 h-2">
        {online && (
          <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-300 opacity-75 motion-safe:animate-ping" />
        )}
        <span
          className={`relative inline-flex w-2 h-2 rounded-full ${
            online ? "bg-emerald-300" : online === false ? "bg-red-300" : "bg-white/60"
          }`}
        />
      </span>
      {online ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
      {text}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Stat card                                                           */
/* ------------------------------------------------------------------ */
const TONES: Record<string, string> = {
  indigo: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  slate: "bg-muted text-muted-foreground",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

function StatCard({
  icon,
  tone,
  value,
  label,
  hint,
  loading,
}: {
  icon: ReactNode;
  tone: keyof typeof TONES | string;
  value: number;
  label: string;
  hint: string;
  loading: boolean;
}) {
  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm p-4 transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className={`inline-flex items-center justify-center w-9 h-9 rounded-xl ${TONES[tone] ?? TONES.slate}`}>
          {icon}
        </span>
      </div>
      <div className="mt-3 text-2xl font-bold text-foreground tabular-nums" style={heading}>
        {loading ? <span className="inline-block w-10 h-7 rounded bg-muted animate-pulse" /> : value}
      </div>
      <div className="text-sm font-medium text-foreground">{label}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Panel shell                                                         */
/* ------------------------------------------------------------------ */
function Panel({
  title,
  icon,
  count,
  children,
  action,
}: {
  title: string;
  icon: ReactNode;
  count?: number;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="bg-card rounded-2xl border border-border shadow-sm">
      <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
        {icon}
        <h2 className="font-semibold text-foreground" style={heading}>
          {title}
        </h2>
        {count !== undefined && (
          <span className="text-xs font-semibold text-muted-foreground bg-muted rounded-full px-2 py-0.5 tabular-nums">
            {count}
          </span>
        )}
        {action && <div className="ml-auto">{action}</div>}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function EmptyState({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <span className="text-muted-foreground/40 mb-2">{icon}</span>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tool catalogue                                                      */
/* ------------------------------------------------------------------ */
function ToolCatalogue({ tools, loading }: { tools: CatalogueEntry[]; loading: boolean }) {
  return (
    <Panel
      title="MCP Tool Catalogue"
      icon={<Boxes className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
      count={tools.length}
    >
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : tools.length === 0 ? (
        <EmptyState icon={<Boxes className="w-8 h-8" />} text="No tools registered yet." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {tools.map(({ plugin, tool }) => (
            <div
              key={`${plugin}.${tool.name}`}
              className="group border border-border rounded-xl p-3.5 transition-all hover:border-indigo-400/60 hover:shadow-sm motion-safe:hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-muted text-muted-foreground group-hover:bg-indigo-500/10 group-hover:text-indigo-500 transition-colors shrink-0">
                    <Plug className="w-3.5 h-3.5" />
                  </span>
                  <code className="text-sm font-semibold text-foreground font-mono truncate">
                    <span className="text-muted-foreground">{plugin}.</span>
                    {tool.name}
                  </code>
                </div>
                {tool.destructive && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-amber-700 bg-amber-100 dark:bg-amber-500/15 dark:text-amber-400 rounded-full px-2 py-0.5 shrink-0">
                    <AlertTriangle className="w-3 h-3" /> gate
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{tool.description}</p>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Approvals                                                           */
/* ------------------------------------------------------------------ */
function ApprovalsPanel({
  pending,
  onApprove,
}: {
  pending: ApprovalRequest[];
  onApprove: () => void;
}) {
  const [working, setWorking] = useState<string | null>(null);
  const approve = async (id: string) => {
    setWorking(id);
    try {
      await techitApi.approve(id);
      await onApprove();
    } finally {
      setWorking(null);
    }
  };
  return (
    <Panel
      title="Pending Approvals"
      icon={<ShieldCheck className="w-5 h-5 text-amber-500" />}
      count={pending.length}
    >
      {pending.length === 0 ? (
        <EmptyState icon={<ShieldCheck className="w-8 h-8" />} text="Nothing awaiting approval." />
      ) : (
        <ul className="space-y-3">
          {pending.map((a) => (
            <li
              key={a.id}
              className="rounded-xl border border-amber-200 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/10 p-3.5"
            >
              <div className="flex items-center gap-2">
                <GitPullRequest className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <code className="text-sm font-semibold text-foreground font-mono truncate">
                  {a.action}
                </code>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                by {a.requestedBy} · {timeOf(a.createdAt)}
              </p>
              <button
                onClick={() => approve(a.id)}
                disabled={working === a.id}
                className="mt-2.5 inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              >
                {working === a.id ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Approve
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Contribution feed                                                   */
/* ------------------------------------------------------------------ */
function ContributionFeed({ events }: { events: ContributionEvent[] }) {
  const recent = [...events].reverse().slice(0, 20);
  return (
    <Panel
      title="Contribution Feed"
      icon={<Activity className="w-5 h-5 text-blue-500" />}
      count={events.length}
    >
      {events.length === 0 ? (
        <EmptyState icon={<Activity className="w-8 h-8" />} text="No contributions yet." />
      ) : (
        <ul className="space-y-1">
          {recent.map((e) => (
            <li
              key={e.id}
              className="flex items-center gap-2 py-1.5 px-2 -mx-2 rounded-lg hover:bg-muted/60 transition-colors"
            >
              <span className="text-[11px] text-muted-foreground w-14 shrink-0 tabular-nums">
                {timeOf(e.timestamp)}
              </span>
              <ActorChip kind={e.actorKind} name={e.actorId} />
              <span className="ml-auto text-[11px] font-medium text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                {e.kind}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Audit table                                                         */
/* ------------------------------------------------------------------ */
function AuditTable({ entries, loading }: { entries: AuditEntry[]; loading: boolean }) {
  const rows = [...entries].reverse();
  return (
    <Panel
      title="Audit Log"
      icon={<ScrollText className="w-5 h-5 text-muted-foreground" />}
      count={entries.length}
      action={
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
          <ShieldCheck className="w-3.5 h-3.5" /> immutable
        </span>
      }
    >
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-9 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <EmptyState icon={<ScrollText className="w-8 h-8" />} text="No audit entries yet." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border">
                <th className="py-2.5 pr-4">Time</th>
                <th className="py-2.5 pr-4">Actor</th>
                <th className="py-2.5 pr-4">Action</th>
                <th className="py-2.5 pr-4">Tool</th>
                <th className="py-2.5 pr-4">Result</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr
                  key={e.id}
                  className="border-b border-border/60 hover:bg-muted/50 transition-colors"
                >
                  <td className="py-2.5 pr-4 text-muted-foreground tabular-nums">{timeOf(e.timestamp)}</td>
                  <td className="py-2.5 pr-4">
                    <ActorChip kind={e.actorKind} name={e.actor} />
                  </td>
                  <td className="py-2.5 pr-4 font-mono text-xs text-foreground">{e.action}</td>
                  <td className="py-2.5 pr-4 text-muted-foreground">{e.sourceTool}</td>
                  <td className="py-2.5 pr-4">
                    <ResultPill result={e.result} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Live tool invoker (in-browser MCP Inspector)                        */
/* ------------------------------------------------------------------ */
const ROLES = ["viewer", "editor", "admin", "owner"] as const;

function Invoker({ tools, onDone }: { tools: CatalogueEntry[]; onDone: () => void }) {
  const [toolKey, setToolKey] = useState("");
  const [params, setParams] = useState("{}");
  const [kind, setKind] = useState<"human" | "agent">("human");
  const [role, setRole] = useState<(typeof ROLES)[number]>("owner");
  const [result, setResult] = useState<InvokeResult | null>(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);

  const selected = useMemo(
    () => tools.find((t) => `${t.plugin}.${t.tool.name}` === toolKey),
    [tools, toolKey],
  );

  useEffect(() => {
    if (!toolKey && tools.length) setToolKey(`${tools[0].plugin}.${tools[0].tool.name}`);
  }, [tools, toolKey]);

  const run = async () => {
    setError("");
    setResult(null);
    if (!selected) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(params || "{}");
    } catch {
      setError("Params must be valid JSON.");
      return;
    }
    const actor =
      kind === "agent" ? { kind, role, toolsAllowed: [toolKey] } : { kind, role };
    setRunning(true);
    try {
      const res = await techitApi.invoke(selected.plugin, selected.tool.name, parsed, actor);
      setResult(res);
      await onDone();
    } finally {
      setRunning(false);
    }
  };

  const selectCls =
    "mt-1 w-full border border-input rounded-lg px-2.5 py-2 text-sm bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring";

  return (
    <Panel
      title="Invoke a Tool"
      icon={<Play className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
      action={<span className="text-[11px] font-medium text-muted-foreground">MCP Inspector</span>}
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="text-sm">
          <span className="text-xs font-medium text-muted-foreground">Tool</span>
          <select value={toolKey} onChange={(e) => setToolKey(e.target.value)} className={selectCls}>
            {tools.map((t) => (
              <option key={`${t.plugin}.${t.tool.name}`} value={`${t.plugin}.${t.tool.name}`}>
                {t.plugin}.{t.tool.name}
                {t.tool.destructive ? " ⚠" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="text-xs font-medium text-muted-foreground">Actor</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as "human" | "agent")}
            className={selectCls}
          >
            <option value="human">human</option>
            <option value="agent">agent</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="text-xs font-medium text-muted-foreground">Role</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as (typeof ROLES)[number])}
            className={selectCls}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="text-sm block mt-3">
        <span className="text-xs font-medium text-muted-foreground">Params (JSON)</span>
        <textarea
          value={params}
          onChange={(e) => setParams(e.target.value)}
          rows={3}
          spellCheck={false}
          className="mt-1 w-full border border-input rounded-lg px-2.5 py-2 font-mono text-xs bg-muted/40 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring"
          placeholder='{"repo":"acme/app","path":"README.md"}'
        />
      </label>

      {selected?.tool.destructive && (
        <p className="text-xs text-amber-700 dark:text-amber-400 mt-2 flex items-start gap-1.5 bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 rounded-lg px-2.5 py-2">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>
            Destructive — first call returns <code className="font-mono">pending_approval</code>;
            approve it in the panel, then re-run with the{" "}
            <code className="font-mono">approvalRequestId</code> added to params.
          </span>
        </p>
      )}

      <button
        onClick={run}
        disabled={running}
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50"
      >
        {running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
        Invoke
      </button>

      {error && <p className="text-sm text-red-600 dark:text-red-400 mt-2">{error}</p>}
      {result && (
        <pre
          className={`mt-3 text-xs rounded-xl p-3.5 overflow-x-auto ring-1 ring-inset ${
            result.ok
              ? "bg-emerald-50 text-emerald-900 ring-emerald-600/15 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-500/25"
              : "bg-amber-50 text-amber-900 ring-amber-600/15 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/25"
          }`}
        >
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </Panel>
  );
}
