import {
  Lightbulb,
  LayoutDashboard,
  FlaskConical,
  PanelsTopLeft,
  Rss,
  MessageSquare,
  Route,
  LineChart,
  User,
} from "lucide-react";
import { Link } from "react-router-dom";

export default function Sidebar() {
  return (
    <aside className="hidden md:flex w-64 xl:w-72 flex-col border-r border-border bg-sidebar text-sidebar-foreground sticky top-0 h-dvh">
      <div className="px-5 pt-5 pb-4 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#38bdf8] text-primary-foreground shadow-lg">
          <Lightbulb className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">TechIT Forge</p>
          <p className="text-[0.7rem] text-muted-foreground">
            Build. Match. Launch.
          </p>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1 text-sm">
        <Link
          to="/dashboard"
          className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 bg-sidebar-primary text-sidebar-primary-foreground font-medium"
        >
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#7c3aed]/80 text-xs">
            <LayoutDashboard className="h-4 w-4" />
          </span>
          <span>Dashboard</span>
        </Link>
        <Link
          to="/incubation-hub"
          className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-muted-foreground hover:bg-sidebar-accent/40"
        >
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800 text-xs">
            <FlaskConical className="h-4 w-4" />
          </span>
          <span>Incubation Hub</span>
        </Link>
        <Link
          to="#"
          className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-muted-foreground hover:bg-sidebar-accent/40"
        >
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800 text-xs">
            <PanelsTopLeft className="h-4 w-4" />
          </span>
          <span>Workspaces</span>
        </Link>
        <Link
          to="#"
          className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-muted-foreground hover:bg-sidebar-accent/40"
        >
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800 text-xs">
            <Rss className="h-4 w-4" />
          </span>
          <span>Feed</span>
        </Link>
        <Link
          to="#"
          className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-muted-foreground hover:bg-sidebar-accent/40"
        >
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800 text-xs">
            <MessageSquare className="h-4 w-4" />
          </span>
          <span>Messages</span>
        </Link>
        <Link
          to="#"
          className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-muted-foreground hover:bg-sidebar-accent/40"
        >
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800 text-xs">
            <Route className="h-4 w-4" />
          </span>
          <span>Market Pathway</span>
        </Link>
        <Link
          to="#"
          className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-muted-foreground hover:bg-sidebar-accent/40"
        >
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800 text-xs">
            <LineChart className="h-4 w-4" />
          </span>
          <span>Investors</span>
        </Link>
        <Link
          to="#"
          className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-muted-foreground hover:bg-sidebar-accent/40"
        >
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800 text-xs">
            <User className="h-4 w-4" />
          </span>
          <span>Profile</span>
        </Link>
      </nav>

      <div className="px-4 pb-5 mt-auto">
        <div className="flex items-center gap-3 rounded-2xl bg-sidebar px-3 py-3 border border-sidebar-border">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#38bdf8] text-primary-foreground text-sm font-semibold">
            DU
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-sidebar-foreground">
              Demo User
            </p>
            <p className="text-[0.7rem] text-muted-foreground">Founder</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
