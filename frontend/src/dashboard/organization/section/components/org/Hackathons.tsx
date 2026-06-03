import { Link } from "react-router-dom";
import {
  Trophy,
  Plus,
  Calendar,
  Users,
  DollarSign,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { HACKATHONS } from "@/dashboard/_shared/opportunities/data";

type HackathonStatus = "upcoming" | "live" | "judging" | "completed";

interface HackathonListItem {
  id: string;
  title: string;
  theme: string;
  startDate: string;
  endDate: string;
  durationHours: number;
  registrants: number;
  teamsFormed: number;
  prizePool: string;
  partners: string[];
  status: HackathonStatus;
}

const hackathons: HackathonListItem[] = HACKATHONS.map((h) => ({
  id: h.id,
  title: h.title,
  theme: h.theme,
  startDate: h.startDate,
  endDate: h.endDate,
  durationHours: h.durationHours,
  registrants: h.registrants,
  teamsFormed: h.teamsFormed,
  prizePool: h.prizePool,
  partners: h.partners,
  status: h.hackathonStatus,
}));

const statusStyles: Record<HackathonStatus, { bg: string; text: string; dot: string; label: string }> = {
  upcoming: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    dot: "bg-blue-500",
    label: "Upcoming",
  },
  live: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    dot: "bg-emerald-500 animate-pulse",
    label: "Live",
  },
  judging: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    dot: "bg-amber-500",
    label: "Judging",
  },
  completed: {
    bg: "bg-muted/40",
    text: "text-foreground",
    dot: "bg-muted",
    label: "Completed",
  },
};

export function Hackathons() {
  const totalRegistrants = hackathons.reduce((s, h) => s + h.registrants, 0);
  const totalTeams = hackathons.reduce((s, h) => s + h.teamsFormed, 0);
  const liveCount = hackathons.filter((h) => h.status === "live").length;

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <span className="bg-indigo-100 p-2 rounded-lg">
              <Trophy className="w-7 h-7 text-indigo-600" />
            </span>
            Hackathons
          </h1>
          <p className="text-muted-foreground mt-2">
            Run high-signal events from theme to post-event intelligence
          </p>
        </div>
        <Link
          to="/org/hackathons/new"
          className="mt-4 sm:mt-0 inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Create new hackathon
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <SummaryCard
          icon={Trophy}
          label="Events run"
          value={hackathons.length}
          accent="text-indigo-600 bg-indigo-50"
        />
        <SummaryCard
          icon={Users}
          label="Total registrants"
          value={totalRegistrants}
          accent="text-blue-600 bg-blue-50"
        />
        <SummaryCard
          icon={Sparkles}
          label="Teams formed"
          value={totalTeams}
          accent="text-emerald-600 bg-emerald-50"
        />
        <SummaryCard
          icon={Calendar}
          label="Live now"
          value={liveCount}
          accent="text-amber-600 bg-amber-50"
        />
      </div>

      {/* Hackathons list */}
      <div className="space-y-4">
        {hackathons.map((h) => {
          const s = statusStyles[h.status];
          return (
            <Link
              key={h.id}
              to={`/org/hackathons/${h.id}`}
              className="block bg-background rounded-xl shadow-sm border border-border hover:border-indigo-300 hover:shadow-md transition-all p-6"
            >
              <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-2">
                    <h3 className="text-lg font-bold text-foreground">
                      {h.title}
                    </h3>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                      {s.label}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{h.theme}</p>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {h.startDate} → {h.endDate} ({h.durationHours}h)
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      {h.registrants} registrants
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      {h.teamsFormed} teams
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5" />
                      {h.prizePool} prizes
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="hidden lg:flex flex-col items-end text-right">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70">
                      Partners
                    </p>
                    <p className="text-sm font-medium text-foreground max-w-[180px] truncate">
                      {h.partners.join(", ")}
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground/70" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Trophy;
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="bg-background rounded-xl shadow-sm border border-border p-5">
      <div className="flex items-start justify-between mb-3">
        <span
          className={`inline-flex w-9 h-9 items-center justify-center rounded-lg ${accent}`}
        >
          <Icon className="w-5 h-5" />
        </span>
      </div>
      <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground mt-1 font-medium uppercase tracking-wider">
        {label}
      </p>
    </div>
  );
}
