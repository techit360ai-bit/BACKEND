import { Link } from "react-router-dom";
import { useFounderProfile } from "@/contexts/UserContext";
import { OPPORTUNITIES } from "@/dashboard/_shared/opportunities/data";
import type { Hackathon } from "@/dashboard/_shared/opportunities/types";
import { OpportunityCard } from "@/dashboard/founders/section/components/founder/OpportunityCard";
import { RegisteredTeamCard } from "./RegisteredTeamCard";

function isHackathon(o: { type: string }): o is Hackathon {
  return o.type === "hackathon";
}

export function DiscoverStage() {
  const { founderProfile } = useFounderProfile();
  const registrations = founderProfile.hackathonRegistrations;
  const allHackathons = OPPORTUNITIES.filter(isHackathon);
  const registeredIds = new Set(registrations.map((r) => r.hackathonId));
  const otherHackathons = allHackathons.filter((h) => !registeredIds.has(h.id));

  if (registrations.length === 0) {
    return (
      <div className="space-y-6">
        <div className="border border-border rounded-xl p-6 bg-background">
          <h2 className="text-base font-semibold text-foreground">Find a hackathon to join</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Pick a hackathon below to register your team, or browse the full Opportunity Hub.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
            {allHackathons.map((h) => (
              <OpportunityCard key={h.id} opportunity={h} />
            ))}
          </div>
          <div className="mt-5 pt-4 border-t border-border">
            <Link to="/opportunity-hub" className="text-xs font-medium text-violet-600 hover:text-violet-700">
              Browse all opportunities →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3">Your teams</h2>
        <div className="space-y-3">
          {registrations.map((reg) => {
            const hackathon = allHackathons.find((h) => h.id === reg.hackathonId);
            if (!hackathon) return null;
            return <RegisteredTeamCard key={reg.teamId} registration={reg} hackathon={hackathon} />;
          })}
        </div>
      </div>
      {otherHackathons.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3">Other open hackathons</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {otherHackathons.map((h) => (
              <OpportunityCard key={h.id} opportunity={h} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
