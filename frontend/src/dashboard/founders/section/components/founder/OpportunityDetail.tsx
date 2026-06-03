import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { OPPORTUNITIES } from "@/dashboard/_shared/opportunities/data";
import type { Opportunity } from "@/dashboard/_shared/opportunities/types";

const TYPE_LABEL: Record<Opportunity["type"], string> = {
  hackathon: "HACKATHON",
  program: "PROGRAM",
  funding: "FUNDING",
  event: "EVENT",
};

export default function OpportunityDetail() {
  const { opportunityId } = useParams<{ opportunityId: string }>();
  const navigate = useNavigate();
  const opp = OPPORTUNITIES.find((o) => o.id === opportunityId);

  if (!opp) {
    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto text-center py-16 border border-border rounded-xl bg-background">
          <p className="text-base text-foreground font-medium">Opportunity not found</p>
          <p className="text-sm text-muted-foreground mt-1">The opportunity may have been removed or never existed.</p>
          <Link to="/opportunity-hub" className="inline-block mt-4 text-sm font-medium text-violet-700 hover:underline">
            ← Back to Opportunity Hub
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-3xl mx-auto">
        <Link
          to="/opportunity-hub"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Opportunity Hub
        </Link>

        <div className="border border-border rounded-xl bg-background p-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <span className="text-5xl shrink-0" aria-hidden="true">{opp.poster}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground bg-muted/40 px-2 py-0.5 rounded">
              {TYPE_LABEL[opp.type]}
            </span>
          </div>
          <h1 className="text-2xl font-semibold text-foreground">{opp.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {opp.organizer.logoEmoji && <span className="mr-1">{opp.organizer.logoEmoji}</span>}
            {opp.organizer.name}
          </p>
          <p className="text-base text-foreground mt-4">{opp.summary}</p>

          {opp.type === "hackathon" && (
            <dl className="grid grid-cols-2 gap-4 mt-6">
              <Detail label="Theme" value={opp.theme} />
              <Detail label="Prize Pool" value={opp.prizePool} />
              <Detail label="Duration" value={`${opp.durationHours} hours`} />
              <Detail label="Dates" value={`${opp.startDate} → ${opp.endDate}`} />
              <Detail label="Registrants" value={opp.registrants.toLocaleString()} />
              <Detail label="Teams formed" value={opp.teamsFormed.toString()} />
              <Detail label="Partners" value={opp.partners.join(", ")} />
            </dl>
          )}
          {opp.type === "program" && (
            <dl className="grid grid-cols-2 gap-4 mt-6">
              <Detail label="Format" value={opp.format} />
              <Detail label="Duration" value={`${opp.durationWeeks} weeks`} />
              <Detail label="Cohort size" value={opp.cohortSize.toString()} />
              <Detail label="Starts" value={opp.startDate} />
              <Detail label="Perks" value={opp.perks.join(", ")} />
            </dl>
          )}
          {opp.type === "funding" && (
            <dl className="grid grid-cols-2 gap-4 mt-6">
              <Detail label="Format" value={opp.format} />
              <Detail label="Amount" value={opp.amountRange} />
              <Detail label="Equity required" value={opp.equityRequired ? "Yes" : "No"} />
              <Detail label="Stages eligible" value={opp.audienceStage.join(", ")} />
            </dl>
          )}
          {opp.type === "event" && (
            <dl className="grid grid-cols-2 gap-4 mt-6">
              <Detail label="Format" value={opp.format} />
              <Detail label="Starts" value={opp.startDate} />
              <Detail label="Duration" value={`${opp.durationMinutes} min`} />
              <Detail label="Hosted by" value={opp.hostedBy} />
              <Detail label="Mode" value={opp.isVirtual ? "Virtual" : "In person"} />
            </dl>
          )}

          <div className="flex flex-wrap gap-2 mt-6">
            {opp.tags.map((t) => (
              <span key={t} className="text-[11px] bg-background border border-border text-muted-foreground px-2 py-0.5 rounded">
                {t}
              </span>
            ))}
          </div>

          <div className="mt-6 pt-6 border-t border-border flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">Apply by {opp.applyDeadline}</span>
            {opp.type === "hackathon" ? (
              <button
                type="button"
                onClick={() => navigate(`/incubation-hub?panel=hackathon&h=${opp.id}&stage=register`)}
                className="text-sm font-medium px-4 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700"
              >
                Register team →
              </button>
            ) : (
              <div className="text-right">
                <button
                  type="button"
                  disabled
                  className="text-sm font-medium px-4 py-2 rounded-lg bg-muted/40 text-muted-foreground/70 cursor-not-allowed"
                >
                  {opp.type === "event" ? "RSVP" : "Apply"} →
                </button>
                <p className="text-[11px] text-muted-foreground mt-1">Application flow coming soon.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</dt>
      <dd className="text-sm text-foreground mt-0.5">{value}</dd>
    </div>
  );
}
