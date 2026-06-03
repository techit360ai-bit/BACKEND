// frontend/src/dashboard/collaborators/section/components/collab/CollabProfile.tsx
import { Link } from "react-router-dom";
import { Github, Linkedin, Globe, Twitter, ExternalLink } from "lucide-react";
import { useCollaboratorProfile } from "@/contexts/UserContext";
import {
  equityHoldings, cashEarnings, endorsements, badges, projects,
} from "@/dashboard/collaborators/section/data/mockData";

export function CollabProfile() {
  const { collaboratorProfile: p } = useCollaboratorProfile();
  const initials = p.name.split(" ").map((x) => x[0]).join("").toUpperCase().slice(0, 2);
  const earnedBadges = badges.filter((b) => b.earned);
  const topEndorsements = endorsements.slice(0, 3);
  const totalCashLifetime = cashEarnings.reduce((s, c) => s + c.earned, 0);

  const commitmentLabel: Record<typeof p.commitmentStyle, string> = {
    deep: "One startup deeply",
    parallel: "2–3 in parallel",
    many: "Many short engagements",
  };

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header strip */}
      <div className="border border-border bg-background rounded-xl p-6 flex items-start gap-5">
        <div className="w-16 h-16 rounded-full bg-amber-500 text-foreground font-semibold flex items-center justify-center text-xl shrink-0">{initials}</div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-foreground">{p.name}</h1>
          <p className="text-sm text-muted-foreground">{p.title} · {p.location} · {p.yearsExperience}y experience</p>
          <p className="text-sm text-foreground mt-2 italic">"{p.headline}"</p>
          <p className="text-xs text-muted-foreground mt-3">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1.5"></span>
            Available · {p.weeklyHours} hrs/week · {commitmentLabel[p.commitmentStyle]}
          </p>
        </div>
        <Link to="/collaborator/settings#identity"
          className="text-xs px-3 py-1.5 border border-border rounded-lg hover:bg-background">Edit profile</Link>
      </div>

      {/* Reputation strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Reputation" value="94" />
        <Stat label="Execution"  value="87" />
        <Stat label="Completed"  value="12" />
        <Stat label="Endorsements" value={String(endorsements.length)} />
      </div>

      {/* Discipline & skills */}
      <div className="border border-border bg-background rounded-xl p-6">
        <h2 className="text-sm font-semibold text-foreground mb-3">{p.discipline || "Discipline not set"}</h2>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {p.subSkills.map((s) => (
            <span key={s} className="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">{s}</span>
          ))}
        </div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">Stack</p>
        <div className="flex flex-wrap gap-1.5">
          {p.techStack.map((t) => (
            <span key={t} className="text-xs px-2.5 py-1 rounded-full bg-muted/40 text-muted-foreground">{t}</span>
          ))}
        </div>
      </div>

      {/* Compensation philosophy */}
      <div className="border border-amber-200 bg-amber-50/30 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-amber-800 mb-1">Building for Equity</h2>
        <p className="text-sm text-foreground">
          {p.equityPreference}% equity / {100 - p.equityPreference}% cash ·
          Min cash ${p.minCashFloor.toLocaleString()}/mo ·
          {" "}{p.vestingComfort === "standard" ? "Standard" : p.vestingComfort === "1y-cliff-4y" ? "1y cliff / 4y" : "Custom"} vesting
        </p>
      </div>

      {/* Active builds */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">Active builds</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {projects.map((proj) => {
            const equity = equityHoldings.find((h) => h.projectId === proj.id);
            return (
              <div key={proj.id} className="border border-border bg-background rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{proj.logo}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{proj.name}</p>
                    <p className="text-xs text-muted-foreground">{proj.role}</p>
                  </div>
                </div>
                {equity && (
                  <p className="text-xs text-amber-700 mt-2">{equity.equityPercent}% equity · ${(equity.valueUSD / 1000).toFixed(1)}K</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Pinned work */}
      {p.pinnedWork.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">Pinned work</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {p.pinnedWork.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noreferrer"
                className="border border-border bg-background rounded-xl p-4 text-sm text-foreground hover:border-amber-300 flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-muted-foreground/70" />
                <span className="truncate">{url}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Top endorsements */}
      {topEndorsements.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">Recent endorsements</h2>
            <Link to="/collaborator/reputation" className="text-xs text-amber-600 hover:underline">See all {endorsements.length} →</Link>
          </div>
          <ul className="space-y-2">
            {topEndorsements.map((e) => (
              <li key={e.id} className="border border-border bg-background rounded-xl p-4">
                <p className="text-sm text-foreground">"{e.quote}"</p>
                <p className="text-xs text-muted-foreground mt-2">— {e.fromName} · {e.fromRole} · {e.projectName}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Badges earned */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">Badges earned</h2>
        <div className="flex flex-wrap gap-2">
          {earnedBadges.map((b) => (
            <span key={b.id} className="border border-border bg-background rounded-xl px-3 py-2 text-sm flex items-center gap-2">
              <span>{b.icon}</span>
              <span className="text-foreground">{b.title}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Links */}
      <div className="flex flex-wrap gap-3 text-sm">
        {p.links.github    && <a href={`https://${p.links.github}`}    target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-foreground hover:text-amber-600"><Github   className="w-4 h-4" /> {p.links.github}</a>}
        {p.links.linkedin  && <a href={`https://${p.links.linkedin}`}  target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-foreground hover:text-amber-600"><Linkedin className="w-4 h-4" /> {p.links.linkedin}</a>}
        {p.links.portfolio && <a href={`https://${p.links.portfolio}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-foreground hover:text-amber-600"><Globe    className="w-4 h-4" /> {p.links.portfolio}</a>}
        {p.links.twitter   && <span className="flex items-center gap-1.5 text-foreground"><Twitter  className="w-4 h-4" /> {p.links.twitter}</span>}
      </div>

      <p className="text-xs text-muted-foreground/70 text-center pt-4">${totalCashLifetime.toLocaleString()} cash lifetime · See <Link to="/collaborator/equity" className="underline hover:text-amber-600">Equity</Link> and <Link to="/collaborator/earnings" className="underline hover:text-amber-600">Earnings</Link></p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border bg-background rounded-xl p-4 text-center">
      <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">{label}</p>
    </div>
  );
}
