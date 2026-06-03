import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "motion/react";
import {
  Mail,
  MessageCircle,
  Star,
  Award,
  FileText,
  PieChart,
  Download,
  Printer,
  X,
  CheckCircle2,
} from "lucide-react";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { useFounderProfile } from "@/contexts/UserContext";
import { OPPORTUNITIES } from "@/dashboard/_shared/opportunities/data";
import type { Hackathon } from "@/dashboard/_shared/opportunities/types";
import { HackathonMatchBanner } from "@/dashboard/founders/section/components/founder/HackathonMatchBanner";

interface Match {
  name: string;
  role: string;
  match: number;
  skills: string[];
  avatar: string;
  risk: string;
  hours: string;
}

const matches: Match[] = [
  {
    name: "Sarah Chen",
    role: "Full-Stack Developer",
    match: 94,
    skills: ["React", "Node.js", "AWS"],
    avatar: "SC",
    risk: "Medium",
    hours: "30h/week",
  },
  {
    name: "Alex Rivera",
    role: "Product Designer",
    match: 89,
    skills: ["UI/UX", "Figma", "Research"],
    avatar: "AR",
    risk: "Low",
    hours: "20h/week",
  },
  {
    name: "Jordan Lee",
    role: "Marketing Specialist",
    match: 87,
    skills: ["SEO", "Content", "Analytics"],
    avatar: "JL",
    risk: "High",
    hours: "25h/week",
  },
  {
    name: "Morgan Taylor",
    role: "DevOps Engineer",
    match: 85,
    skills: ["Docker", "K8s", "CI/CD"],
    avatar: "MT",
    risk: "Medium",
    hours: "40h/week",
  },
];

const DEFAULT_EQUITY: Record<string, number> = {
  "Sarah Chen": 8,
  "Alex Rivera": 5,
  "Jordan Lee": 3,
  "Morgan Taylor": 4,
};

export default function MatchResults() {
  const [searchParams] = useSearchParams();
  const hackathonId = searchParams.get("hackathon");
  const { founderProfile, addHackathonMember } = useFounderProfile();

  const hackathon: Hackathon | null = hackathonId
    ? (OPPORTUNITIES.find((o): o is Hackathon => o.type === "hackathon" && o.id === hackathonId) ?? null)
    : null;

  const registration = hackathonId
    ? founderProfile.hackathonRegistrations.find((r) => r.hackathonId === hackathonId) ?? null
    : null;

  const [invitedNames, setInvitedNames] = useState<Set<string>>(new Set());

  const visibleMatches = useMemo(() => {
    if (!hackathonId || !registration) return matches;
    const openRoleWords = new Set(
      registration.openRoles.flatMap((r) => r.toLowerCase().split(/[\s()/]+/).filter(Boolean)),
    );
    return matches.filter((m) => {
      const matchWords = m.role.toLowerCase().split(/[\s()/]+/).filter(Boolean);
      return matchWords.some((w) => openRoleWords.has(w));
    });
  }, [hackathonId, registration]);

  const [equity, setEquity] =
    useState<Record<string, number>>(DEFAULT_EQUITY);
  const [contractFor, setContractFor] = useState<Match | null>(null);
  const [projectName, setProjectName] = useState(
    "Untitled Project",
  );

  const totalEquity = useMemo(
    () => Object.values(equity).reduce((a, b) => a + b, 0),
    [equity],
  );
  const founderRetained = Math.max(0, 100 - totalEquity);
  const over = totalEquity > 100;

  const handleInvite = () => {
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.7 },
    });
  };

  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      <main className="flex-1 overflow-y-auto bg-linear-to-b from-slate-100 via-indigo-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 py-6 lg:py-12">
        <div className="max-w-6xl mx-auto px-4 lg:px-6">
          {/* Header */}
          <div className="mb-6 lg:mb-8">
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-2">
              Your Top Matches
            </h1>
            <p className="text-sm lg:text-base text-muted-foreground">
              AI-curated collaborators based on your profile and project needs
            </p>
          </div>

          {/* Project + Equity Allocation Summary */}
          <div className="bg-card rounded-xl border border-border p-4 lg:p-5 mb-6 lg:mb-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Project name
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full bg-transparent text-lg font-semibold text-foreground border-b border-border focus:border-indigo-500 outline-none pb-1"
                />
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                    Equity allocated
                  </div>
                  <div
                    className={`text-2xl font-bold ${over ? "text-red-500" : "text-indigo-600 dark:text-indigo-400"}`}
                  >
                    {totalEquity}%
                  </div>
                </div>
                <div className="h-12 w-px bg-border" />
                <div className="text-right">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                    Founder retains
                  </div>
                  <div
                    className={`text-2xl font-bold ${over ? "text-red-500" : "text-emerald-600 dark:text-emerald-400"}`}
                  >
                    {founderRetained}%
                  </div>
                </div>
              </div>
            </div>

            {/* Allocation bar */}
            <div className="mt-4 h-3 rounded-full bg-muted dark:bg-card overflow-hidden flex">
              {matches.map((m, i) => {
                const pct = equity[m.name] ?? 0;
                const colors = [
                  "bg-indigo-500",
                  "bg-cyan-500",
                  "bg-fuchsia-500",
                  "bg-amber-500",
                ];
                return (
                  <div
                    key={m.name}
                    className={`${colors[i % colors.length]} transition-all`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                    title={`${m.name}: ${pct}%`}
                  />
                );
              })}
            </div>
            {over && (
              <div className="mt-2 text-xs text-red-500 font-semibold">
                Total equity exceeds 100%. Reduce one or more proposals before generating contracts.
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6 lg:mb-8">
            <select className="px-3 py-2 bg-card border border-border rounded-lg text-foreground text-sm flex-1 sm:flex-none">
              <option>All Availability</option>
              <option>Full-time</option>
              <option>Part-time</option>
            </select>
            <select className="px-3 py-2 bg-card border border-border rounded-lg text-foreground text-sm flex-1 sm:flex-none">
              <option>All Risk Levels</option>
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
            </select>
            <select className="px-3 py-2 bg-card border border-border rounded-lg text-foreground text-sm flex-1 sm:flex-none">
              <option>All Time Zones</option>
              <option>PST</option>
              <option>EST</option>
            </select>
          </div>

          {/* Match Cards Grid */}
          {hackathonId && <HackathonMatchBanner hackathon={hackathon} teamName={registration?.teamName ?? null} />}
          {hackathonId && visibleMatches.length === 0 && (
            <div className="border border-border rounded-xl bg-background p-8 text-center">
              <p className="text-sm text-foreground font-medium">No collaborators match the open roles for this hackathon.</p>
              <p className="text-xs text-muted-foreground mt-1">Try widening your role list or sharing the invite link directly.</p>
            </div>
          )}
          <div className="grid gap-6">
            {visibleMatches.map((match, index) => {
              const pct = equity[match.name] ?? 0;
              return (
                <motion.div
                  key={match.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-card rounded-xl p-4 lg:p-6 border border-border hover:border-indigo-500/50 transition-all"
                >
                  <div className="flex flex-col sm:flex-row items-start gap-4 lg:gap-6">
                    {/* Avatar */}
                    <div className="flex-shrink-0 w-full sm:w-auto flex sm:flex-col items-start sm:items-center gap-4 sm:gap-2">
                      <div className="size-16 sm:size-20 rounded-full bg-linear-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-xl sm:text-2xl font-bold text-white shrink-0">
                        {match.avatar}
                      </div>
                      {/* Match Badge */}
                      <div className="px-3 py-1 bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 rounded-full text-xs sm:text-sm font-medium text-center">
                        {match.match}% Match
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 w-full">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-3 lg:mb-4 gap-2 sm:gap-0">
                        <div className="flex-1">
                          <h3 className="text-lg sm:text-xl font-bold text-foreground mb-1">
                            {match.name}
                          </h3>
                          <div className="text-sm text-muted-foreground mb-2">
                            {match.role}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Award className="size-4" />
                              {match.hours}
                            </span>
                            <span>•</span>
                            <span>{match.risk} Risk</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`size-3 sm:size-4 ${
                                i < 4
                                  ? "fill-amber-400 text-amber-400"
                                  : "text-muted-foreground/50 dark:text-foreground"
                              }`}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Skills */}
                      <div className="flex flex-wrap gap-2 mb-3 lg:mb-4">
                        {match.skills.map((skill) => (
                          <span
                            key={skill}
                            className="px-2 py-1 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 rounded-full text-xs sm:text-sm"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>

                      {/* Equity proposal slider */}
                      <div className="bg-background dark:bg-card/40 border border-border rounded-lg p-3 mb-3 lg:mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-foreground">
                            <PieChart className="size-4 text-indigo-500" />
                            Equity proposal
                          </div>
                          <div className="text-lg sm:text-xl font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                            {pct}%
                          </div>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={30}
                          step={0.5}
                          value={pct}
                          onChange={(e) =>
                            setEquity((prev) => ({
                              ...prev,
                              [match.name]: parseFloat(e.target.value),
                            }))
                          }
                          className="w-full accent-indigo-600"
                          aria-label={`Equity proposal for ${match.name}`}
                        />
                        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                          <span>0%</span>
                          <span>15%</span>
                          <span>30%</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
                        {hackathonId && registration ? (
                          invitedNames.has(match.name) ? (
                            <button
                              type="button"
                              disabled
                              className="flex-1 sm:flex-none py-2 px-4 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                            >
                              <CheckCircle2 className="size-4" />
                              <span>Invited</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                const role = registration.openRoles[0];
                                if (!role) return;
                                addHackathonMember(registration.teamId, {
                                  collaboratorId: `mock_${match.name.replace(/\s+/g, "_").toLowerCase()}`,
                                  name: match.name,
                                  role,
                                  acceptedAt: new Date().toISOString(),
                                });
                                setInvitedNames((s) => new Set(s).add(match.name));
                                toast.success(`Invited ${match.name} to ${registration.teamName}`);
                              }}
                              className="flex-1 sm:flex-none py-2 px-4 rounded-lg bg-violet-600 hover:bg-violet-700 text-white flex items-center justify-center gap-2 text-sm"
                            >
                              <Mail className="size-4" />
                              <span>Invite to {registration.teamName}</span>
                            </button>
                          )
                        ) : (
                          <button
                            onClick={() => handleInvite()}
                            className="flex-1 sm:flex-none py-2 px-4 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white rounded-lg flex items-center justify-center gap-2 transition-all text-sm"
                          >
                            <Mail className="size-4" />
                            <span>Invite</span>
                          </button>
                        )}
                        <button className="flex-1 sm:flex-none py-2 px-4 bg-muted dark:bg-card hover:bg-muted dark:hover:bg-card text-foreground dark:text-white rounded-lg flex items-center justify-center gap-2 transition-colors text-sm">
                          <MessageCircle className="size-4" />
                          <span>Message</span>
                        </button>
                        <button
                          onClick={() => setContractFor(match)}
                          disabled={pct <= 0 || over}
                          className="flex-1 sm:flex-none py-2 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-muted dark:disabled:bg-card disabled:text-muted-foreground disabled:cursor-not-allowed text-white rounded-lg flex items-center justify-center gap-2 transition-colors text-sm"
                          title={
                            pct <= 0
                              ? "Set an equity proposal first"
                              : over
                                ? "Total equity exceeds 100%"
                                : "Generate term-of-contract preview"
                          }
                        >
                          <FileText className="size-4" />
                          <span>Generate Contract</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </main>

      {/* Term-of-Contract modal */}
      {contractFor && (
        <ContractModal
          match={contractFor}
          projectName={projectName}
          equity={equity[contractFor.name] ?? 0}
          onClose={() => setContractFor(null)}
        />
      )}
    </div>
  );
}

function ContractModal({
  match,
  projectName,
  equity,
  onClose,
}: {
  match: Match;
  projectName: string;
  equity: number;
  onClose: () => void;
}) {
  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const weeklyHours = parseInt(match.hours, 10) || 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-linear-to-r from-emerald-50 to-indigo-50 dark:from-emerald-950/40 dark:to-indigo-950/40">
          <div>
            <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 font-semibold uppercase tracking-wider">
              <CheckCircle2 className="size-3.5" />
              Term of Contract — Draft
            </div>
            <h2 className="text-xl font-bold text-foreground mt-1">
              {projectName}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted dark:hover:bg-card transition-colors"
            aria-label="Close contract preview"
          >
            <X className="size-4 text-foreground" />
          </button>
        </div>

        {/* Modal body */}
        <div className="px-6 py-5 overflow-y-auto space-y-5 text-sm text-foreground">
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Parties
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-background dark:bg-card/40 rounded-lg p-3 border border-border">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                  Founder
                </div>
                <div className="font-semibold">You</div>
                <div className="text-xs text-muted-foreground">
                  Project owner — {projectName}
                </div>
              </div>
              <div className="bg-background dark:bg-card/40 rounded-lg p-3 border border-border">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                  Collaborator
                </div>
                <div className="font-semibold">{match.name}</div>
                <div className="text-xs text-muted-foreground">
                  {match.role}
                </div>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Allocation
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/50 dark:border-indigo-800/50 rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-semibold mb-1">
                  Equity grant
                </div>
                <div className="text-xl font-bold text-indigo-700 dark:text-indigo-300">
                  {equity}%
                </div>
              </div>
              <div className="bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200/50 dark:border-cyan-800/50 rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-wider text-cyan-600 dark:text-cyan-400 font-semibold mb-1">
                  Weekly hours
                </div>
                <div className="text-xl font-bold text-cyan-700 dark:text-cyan-300">
                  {weeklyHours}h
                </div>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/50 dark:border-emerald-800/50 rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-semibold mb-1">
                  Effective date
                </div>
                <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                  {today}
                </div>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Role &amp; responsibilities
            </h3>
            <p className="text-sm leading-relaxed text-foreground/80">
              {match.name} is engaged as <strong>{match.role}</strong> on{" "}
              <strong>{projectName}</strong>, committing approximately{" "}
              <strong>{weeklyHours} hours per week</strong>. Areas of focus
              include {match.skills.join(", ")}. Specific deliverables and
              milestones will be tracked through the TechIT workspace.
            </p>
          </section>

          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Vesting schedule
            </h3>
            <p className="text-sm leading-relaxed text-foreground/80">
              Equity vests over <strong>48 months</strong> with a{" "}
              <strong>12-month cliff</strong>. Vesting accrues based on verified
              milestone completions logged on the TechIT platform. If{" "}
              {match.name} departs before the cliff date, no equity is granted.
            </p>
          </section>

          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Exit &amp; reallocation
            </h3>
            <p className="text-sm leading-relaxed text-foreground/80">
              On voluntary exit, unvested equity returns to the founder pool.
              On involuntary exit (cause), all unvested equity is forfeited.
              The platform maintains an immutable contribution record that
              persists regardless of equity outcome.
            </p>
          </section>

          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Notes
            </h3>
            <ul className="text-xs leading-relaxed text-muted-foreground space-y-1.5 list-disc pl-5">
              <li>
                This document is a draft generated by TechIT and is not legally
                binding until signed by both parties and counter-signed by a
                licensed professional.
              </li>
              <li>
                Dispute resolution defaults to mediation through the TechIT
                governance process before any external arbitration.
              </li>
              <li>
                Confidentiality and IP assignment clauses will be expanded in
                the final signed version.
              </li>
            </ul>
          </section>
        </div>

        {/* Modal footer */}
        <div className="px-6 py-3 border-t border-border flex items-center justify-end gap-2 bg-background dark:bg-card/40">
          <button
            onClick={() => window.print()}
            className="px-3 py-2 rounded-lg bg-muted dark:bg-card hover:bg-muted dark:hover:bg-card text-foreground text-sm flex items-center gap-2 transition-colors"
          >
            <Printer className="size-4" />
            Print
          </button>
          <button
            onClick={() => {
              const blob = new Blob(
                [
                  `TechIT Term of Contract\n\nProject: ${projectName}\nCollaborator: ${match.name}\nRole: ${match.role}\nEquity: ${equity}%\nWeekly hours: ${weeklyHours}h\nEffective: ${today}\n`,
                ],
                { type: "text/plain" },
              );
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `${projectName.replace(/\s+/g, "_")}_${match.name.replace(/\s+/g, "_")}_contract.txt`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm flex items-center gap-2 transition-colors"
          >
            <Download className="size-4" />
            Download draft
          </button>
        </div>
      </motion.div>
    </div>
  );
}
