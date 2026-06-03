import { Link } from "react-router-dom";
import { Trophy, X } from "lucide-react";
import type { Hackathon } from "@/dashboard/_shared/opportunities/types";

interface Props {
  hackathon: Hackathon | null;
  teamName: string | null;
}

export function HackathonMatchBanner({ hackathon, teamName }: Props) {
  if (!hackathon) {
    return (
      <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-4 mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold flex items-center gap-1.5">
            <Trophy className="w-4 h-4" /> Filtering for an unknown hackathon
          </p>
          <p className="text-xs mt-1">
            We can't find that hackathon, but you can still browse all collaborators below.
          </p>
        </div>
        <Link to="/matches" aria-label="Clear filter" className="p-1 rounded hover:bg-amber-100">
          <X className="w-4 h-4" />
        </Link>
      </div>
    );
  }
  return (
    <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-4 mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold flex items-center gap-1.5">
          <Trophy className="w-4 h-4" /> Filtering for {hackathon.title}
        </p>
        <p className="text-xs mt-1">
          Showing collaborators available {hackathon.startDate}–{hackathon.endDate}
          {teamName ? `, in roles you listed for team ${teamName}` : ""}.
        </p>
      </div>
      <Link to="/matches" className="text-xs font-medium px-2 py-1 rounded border border-amber-300 hover:bg-amber-100 inline-flex items-center gap-1 shrink-0">
        Clear filter <X className="w-3 h-3" />
      </Link>
    </div>
  );
}
