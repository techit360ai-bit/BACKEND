import { useNavigate } from "react-router-dom";
import type { Opportunity } from "@/dashboard/_shared/opportunities/types";

interface Props {
  opportunity: Opportunity;
  variant?: "featured" | "grid";
}

const TYPE_LABEL: Record<Opportunity["type"], string> = {
  hackathon: "HACKATHON",
  program: "PROGRAM",
  funding: "FUNDING",
  event: "EVENT",
};

const STATUS_STYLES = {
  open: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", label: "Open" },
  "closing-soon": { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", label: "Closing soon" },
  closed: { bg: "bg-background", text: "text-muted-foreground", border: "border-border", label: "Closed" },
};

function daysUntil(iso: string): number {
  const ms = new Date(iso).getTime() - new Date().getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function countdown(iso: string): string {
  const days = daysUntil(iso);
  if (days < 0) return "Closed";
  if (days === 0) return "Closes today";
  if (days === 1) return "Closes tomorrow";
  return `Closes in ${days} days`;
}

function metricLine(opp: Opportunity): string {
  switch (opp.type) {
    case "hackathon":
      return `${opp.prizePool} · ${opp.durationHours}h · ${opp.registrants.toLocaleString()} registered`;
    case "program":
      return `${opp.format} · ${opp.durationWeeks} weeks · Cohort ${opp.cohortSize}`;
    case "funding":
      return `${opp.amountRange} · ${opp.equityRequired ? "Equity" : "Non-dilutive"}`;
    case "event":
      return `${opp.format} · ${opp.durationMinutes}min · ${opp.isVirtual ? "Virtual" : opp.hostedBy}`;
  }
}

function ctaLabel(opp: Opportunity): string {
  switch (opp.type) {
    case "hackathon": return "Register team →";
    case "program":
    case "funding":   return "Apply →";
    case "event":     return "RSVP →";
  }
}

function ctaTarget(opp: Opportunity): string {
  if (opp.type === "hackathon") {
    return `/incubation-hub?panel=hackathon&h=${opp.id}&stage=register`;
  }
  return `/opportunity-hub/${opp.id}`;
}

export function OpportunityCard({ opportunity, variant = "grid" }: Props) {
  const navigate = useNavigate();
  const status = STATUS_STYLES[opportunity.status];
  const isFeatured = variant === "featured";

  return (
    <article
      className={`border border-border rounded-xl bg-background overflow-hidden flex flex-col ${
        isFeatured ? "h-full" : ""
      }`}
    >
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-3 mb-3">
          <span className="text-3xl shrink-0" aria-hidden="true">{opportunity.poster}</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground bg-muted/40 px-2 py-0.5 rounded">
            {TYPE_LABEL[opportunity.type]}
          </span>
        </div>
        <h3 className={`font-semibold text-foreground ${isFeatured ? "text-xl" : "text-base"} mb-1`}>
          {opportunity.title}
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          {opportunity.organizer.logoEmoji && <span className="mr-1">{opportunity.organizer.logoEmoji}</span>}
          {opportunity.organizer.name}
        </p>
        <p className={`text-sm text-muted-foreground mb-4 ${isFeatured ? "" : "line-clamp-2"}`}>
          {opportunity.summary}
        </p>
        <p className="text-xs text-muted-foreground mb-4 font-medium">{metricLine(opportunity)}</p>
        <div className="mt-auto flex items-center justify-between gap-3 pt-3 border-t border-border">
          <div className="flex items-center gap-2 text-xs">
            <span className={`px-2 py-0.5 rounded border ${status.bg} ${status.text} ${status.border} font-medium`}>
              {status.label}
            </span>
            <span className="text-muted-foreground">{countdown(opportunity.applyDeadline)}</span>
          </div>
          <button
            type="button"
            onClick={() => navigate(ctaTarget(opportunity))}
            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700"
          >
            {ctaLabel(opportunity)}
          </button>
        </div>
      </div>
    </article>
  );
}
