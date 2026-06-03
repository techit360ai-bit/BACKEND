import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { OPPORTUNITIES } from "@/dashboard/_shared/opportunities/data";
import type { Opportunity, OpportunityType, OpportunityStatus } from "@/dashboard/_shared/opportunities/types";
import { OpportunityCard } from "./OpportunityCard";

type TypeFilter = "all" | OpportunityType;
type StatusFilter = "all" | OpportunityStatus;

const TYPE_LABELS: Record<TypeFilter, string> = {
  all: "All",
  hackathon: "Hackathons",
  program: "Programs",
  funding: "Funding",
  event: "Events",
};

const STATUS_RANK: Record<OpportunityStatus, number> = { open: 0, "closing-soon": 1, closed: 2 };

export default function OpportunityHub() {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return OPPORTUNITIES
      .filter((o) => typeFilter === "all" || o.type === typeFilter)
      .filter((o) => statusFilter === "all" || o.status === statusFilter)
      .filter((o) => {
        if (!q) return true;
        return (
          o.title.toLowerCase().includes(q) ||
          o.organizer.name.toLowerCase().includes(q) ||
          o.tags.some((t) => t.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        const r = STATUS_RANK[a.status] - STATUS_RANK[b.status];
        if (r !== 0) return r;
        return new Date(a.applyDeadline).getTime() - new Date(b.applyDeadline).getTime();
      });
  }, [typeFilter, statusFilter, search]);

  const featured: Opportunity | null = useMemo(() => {
    return filtered.find((o) => o.featured && o.status === "open") ?? filtered.find((o) => o.status === "open") ?? filtered[0] ?? null;
  }, [filtered]);

  const gridItems = useMemo(() => filtered.filter((o) => o.id !== featured?.id), [filtered, featured]);

  const counts = useMemo(() => {
    const c: Record<TypeFilter, number> = { all: 0, hackathon: 0, program: 0, funding: 0, event: 0 };
    for (const o of OPPORTUNITIES) {
      if (statusFilter !== "all" && o.status !== statusFilter) continue;
      c.all++;
      c[o.type]++;
    }
    return c;
  }, [statusFilter]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Opportunity Hub</h1>
        <p className="text-sm text-muted-foreground mt-1">Programs, hackathons, funding, and events from organizations.</p>
      </header>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(TYPE_LABELS) as TypeFilter[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition ${
                typeFilter === t
                  ? "bg-violet-600 text-white border-violet-600"
                  : "bg-background text-foreground border-border hover:bg-background"
              }`}
            >
              {TYPE_LABELS[t]} ({counts[t]})
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="text-xs px-2 py-1.5 rounded-lg border border-border bg-background text-foreground"
            aria-label="Status filter"
          >
            <option value="all">All status</option>
            <option value="open">Open</option>
            <option value="closing-soon">Closing soon</option>
            <option value="closed">Closed</option>
          </select>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/70" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="text-xs pl-8 pr-3 py-1.5 rounded-lg border border-border bg-background"
              aria-label="Search opportunities"
            />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl p-10 text-center">
          <p className="text-sm text-muted-foreground">
            {OPPORTUNITIES.length === 0
              ? "Organizations haven't published any opportunities yet."
              : `No ${typeFilter === "all" ? "" : TYPE_LABELS[typeFilter].toLowerCase() + " "}opportunities match. Try a different filter.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {featured && (
            <div className="lg:col-span-3">
              <OpportunityCard opportunity={featured} variant="featured" />
            </div>
          )}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
            {gridItems.map((o) => (
              <OpportunityCard key={o.id} opportunity={o} variant="grid" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
