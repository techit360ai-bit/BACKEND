// frontend/src/dashboard/founders/section/components/founder/FounderProfile.tsx
import { Link } from "react-router-dom";
import { Github, Linkedin, Globe, Twitter, ExternalLink, Check } from "lucide-react";
import { useFounderProfile } from "@/contexts/UserContext";
import { journey, endorsements } from "@/dashboard/founders/section/data/mockData";

export function FounderProfile() {
  const { founderProfile: p } = useFounderProfile();

  const initials = p.name
    .split(" ")
    .map((x) => x[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const v = p.verification;
  const isVerified =
    v.github.verified ||
    v.twitter.verified ||
    v.linkedin.verified ||
    v.personalSite.verified ||
    v.nin.status === "verified";

  const ownershipLabel: Record<typeof p.ownershipPhilosophy, string> = {
    "equity-day-one": "Collaborators earn equity from day one",
    "cash-first-equity-later": "Cash-first now, equity at seed",
    custom: "Custom — negotiated per-person",
  };
  const compLabel: Record<typeof p.compensationOffered, string> = {
    "equity-heavy": "Equity-heavy",
    "cash-equity-mix": "Cash + equity",
    "cash-heavy": "Cash-heavy",
  };
  const launchLabel: Record<typeof p.launchStatus, string> = {
    "pre-launch": "Pre-launch",
    "private-beta": "Private beta",
    public: "Public",
  };
  const founderTypeLabel: Record<typeof p.founderType, string> = {
    "first-time": "First time",
    "some-experience": "Some experience",
    serial: "Serial",
  };
  const stageStyles: Record<typeof p.stage, string> = {
    Idea: "bg-muted/40 text-foreground",
    MVP: "bg-violet-50 text-violet-700",
    Beta: "bg-amber-50 text-amber-700",
    Launch: "bg-emerald-50 text-emerald-700",
    Growth: "bg-emerald-50 text-emerald-700",
  };

  const rolesQuery = encodeURIComponent(p.openRoles.join(","));
  const matchresultsHref =
    p.openRoles.length > 0 ? `/matchresults?roles=${rolesQuery}` : "/matchresults";

  const topEndorsements = endorsements.slice(0, 3);

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">

      {/* 1. Header strip */}
      <div className="border border-border bg-background rounded-xl p-6 flex items-start gap-4">
        <div className="w-16 h-16 rounded-full bg-violet-600 text-white text-xl font-semibold flex items-center justify-center shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground">{p.name}</h1>
            {isVerified && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 inline-flex items-center gap-1">
                <Check className="w-3 h-3" />
                Verified
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {p.title} · {p.location} · {p.yearsBuilding} years building ·{" "}
            {founderTypeLabel[p.founderType]}
          </p>
          <p className="text-base text-foreground italic mt-2">"{p.headline}"</p>
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
            <span className="inline-block w-2 h-2 bg-emerald-500 rounded-full" />
            Building · {p.currentTeamSize} cofounders · {p.openRoles.length} of 5 roles open
          </p>
        </div>
        <Link
          to="/founder/settings#identity"
          className="text-sm text-violet-600 hover:underline shrink-0"
        >
          Edit profile →
        </Link>
      </div>

      {/* 2. Startup hero */}
      <Link
        to="/incubation-hub"
        className="block border border-border bg-background rounded-xl p-6 hover:border-violet-300 transition-colors"
      >
        <div className="flex items-start gap-4">
          <span className="text-4xl">{p.logoEmoji}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-xl font-bold text-foreground">{p.startupName}</h2>
              <span className={`text-xs px-2 py-0.5 rounded-full ${stageStyles[p.stage]}`}>
                {p.stage}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-1">{p.oneLiner}</p>
            <p className="text-xs text-muted-foreground mb-4">
              Founded {p.foundingYear} · {p.industries.join(" · ")}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm border-t border-border pt-4">
              <div>
                <p className="text-2xl font-bold text-foreground tabular-nums">
                  {p.users.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Active users</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground tabular-nums">
                  ${p.revenueMonthly.toLocaleString()}/mo
                </p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Revenue</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {launchLabel[p.launchStatus]}
                </p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Launch status</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground tabular-nums">
                  ${p.fundingRaised.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Funding</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">Next milestone: {p.nextMilestone}</p>
          </div>
        </div>
      </Link>

      {/* 3. Mission */}
      <div className="border border-border bg-background rounded-xl p-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">Mission</h2>
        <div className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Why I'm building this</p>
            <p className="text-sm text-foreground">"{p.whyBuilding}"</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">What winning looks like</p>
            <p className="text-sm text-foreground">"{p.winningIn3Years}"</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Unfair advantage</p>
            <p className="text-sm text-foreground">"{p.unfairAdvantage}"</p>
          </div>
        </div>
      </div>

      {/* 4. Compensation philosophy */}
      <div className="border border-violet-200 bg-violet-50 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-violet-700 uppercase tracking-wider mb-2">
          Building for Ownership
        </h2>
        <p className="text-base text-foreground">{ownershipLabel[p.ownershipPhilosophy]}</p>
        <p className="text-sm text-foreground mt-1">
          {p.equityRangeMin}%–{p.equityRangeMax}% range · {compLabel[p.compensationOffered]}
        </p>
      </div>

      {/* 5. Open roles */}
      <div className="border border-border bg-background rounded-xl p-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">
          Open roles ({p.openRoles.length} of 5)
        </h2>
        {p.openRoles.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open roles right now.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {p.openRoles.map((role) => (
                <div key={role} className="border border-border bg-background rounded-lg p-3">
                  <p className="text-sm font-semibold text-foreground">{role}</p>
                  <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                    {p.equityRangeMin}–{p.equityRangeMax}% equity
                  </p>
                  <p className="text-xs text-muted-foreground">{compLabel[p.compensationOffered]}</p>
                </div>
              ))}
            </div>
            <Link
              to={matchresultsHref}
              className="text-sm text-violet-600 hover:underline mt-3 inline-block"
            >
              See all collaborators matching these roles →
            </Link>
          </>
        )}
      </div>

      {/* 6. Stage journey (compact, read-only) */}
      <div className="border border-border bg-background rounded-xl p-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">Journey</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {journey.map((stage) => {
            const cardClass =
              stage.status === "active"
                ? "border-violet-200 bg-violet-50"
                : stage.status === "complete"
                ? "border-violet-200 bg-background"
                : "border-border bg-background";
            const labelClass =
              stage.status === "active"
                ? "text-violet-700"
                : stage.status === "complete"
                ? "text-foreground"
                : "text-muted-foreground/70";
            return (
              <div key={stage.id} className={`border rounded-lg p-3 ${cardClass}`}>
                <p className={`text-xs font-semibold ${labelClass}`}>{stage.label}</p>
                {stage.status !== "upcoming" && (
                  <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-violet-500 rounded-full"
                      style={{ width: `${stage.progress}%` }}
                    />
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-1">{stage.detail}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* 7. Recent endorsements (top 3) */}
      <div className="border border-border bg-background rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground">Recent endorsements</h2>
          <Link to="/matchresults" className="text-xs text-violet-600 hover:underline">
            See all {endorsements.length} →
          </Link>
        </div>
        {endorsements.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No endorsements yet. They appear after you complete an engagement with a collaborator.
          </p>
        ) : (
          <div className="space-y-3">
            {topEndorsements.map((e) => (
              <div key={e.id} className="border border-border bg-background rounded-lg p-4">
                <p className="text-sm text-foreground">"{e.quote}"</p>
                <p className="text-xs text-muted-foreground mt-2">
                  — {e.fromName} · {e.fromRole} · {e.buildName} · {e.date}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 8. Pinned work (only if present) */}
      {p.pinnedWork.length > 0 && (
        <div className="border border-border bg-background rounded-xl p-6">
          <h2 className="text-sm font-semibold text-foreground mb-4">Pinned work</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {p.pinnedWork.slice(0, 3).map((url) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="border border-border bg-background rounded-lg p-3 flex items-center gap-2 hover:border-violet-300"
              >
                <ExternalLink className="w-4 h-4 text-muted-foreground/70 shrink-0" />
                <span className="text-sm text-foreground truncate">{url}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* 9. Verification */}
      <div className="border border-border bg-background rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground">Verification</h2>
          <Link
            to="/founder/settings#verification"
            className="text-xs text-violet-600 hover:underline"
          >
            Complete verification →
          </Link>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {[
            { label: "GitHub",        verified: v.github.verified },
            { label: "X / Twitter",   verified: v.twitter.verified },
            { label: "LinkedIn",      verified: v.linkedin.verified },
            { label: "Personal site", verified: v.personalSite.verified },
            { label: "ID / NIN",      verified: v.nin.status === "verified" },
          ].map((b) => (
            <span
              key={b.label}
              className={`px-2.5 py-1 rounded-full inline-flex items-center gap-1 ${
                b.verified
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-muted/40 text-muted-foreground"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  b.verified ? "bg-emerald-500" : "bg-muted"
                }`}
              />
              {b.verified ? `${b.label} verified` : `${b.label} unverified`}
            </span>
          ))}
        </div>
      </div>

      {/* 10. Social links */}
      <div className="border border-border bg-background rounded-xl p-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">Links</h2>
        <div className="flex flex-wrap gap-4 text-sm">
          {p.links.github && (
            <a
              href={`https://${p.links.github.replace(/^https?:\/\//, "")}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-foreground hover:text-violet-600"
            >
              <Github className="w-4 h-4" /> {p.links.github}
            </a>
          )}
          {p.links.linkedin && (
            <a
              href={`https://${p.links.linkedin.replace(/^https?:\/\//, "")}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-foreground hover:text-violet-600"
            >
              <Linkedin className="w-4 h-4" /> {p.links.linkedin}
            </a>
          )}
          {p.links.twitter && (
            <span className="flex items-center gap-1.5 text-foreground">
              <Twitter className="w-4 h-4" /> {p.links.twitter}
            </span>
          )}
          {p.links.personal && (
            <a
              href={`https://${p.links.personal.replace(/^https?:\/\//, "")}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-foreground hover:text-violet-600"
            >
              <Globe className="w-4 h-4" /> {p.links.personal}
            </a>
          )}
        </div>
      </div>

    </div>
  );
}
