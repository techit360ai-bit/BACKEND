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
import { useSidebar } from "../contexts/SidebarContext";

export default function Sidebar() {
  const { isOpen, closeSidebar } = useSidebar();

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:sticky top-0 left-0 h-dvh z-50 w-64 xl:w-72 flex flex-col border-r border-slate-800 dark:border-slate-800 bg-slate-950 dark:bg-slate-950 text-white transition-transform duration-300 md:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } md:relative`}
      >
        <div className="px-5 pt-5 pb-4 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500 text-white shadow-lg">
            <Lightbulb className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">TechIT Forge</p>
            <p className="text-[0.7rem] text-slate-400">
              Build. Match. Launch.
            </p>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-1 text-sm">
          <Link
            to="/dashboard"
            onClick={closeSidebar}
            className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 bg-indigo-600 text-white font-medium"
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-700/80 text-xs">
              <LayoutDashboard className="h-4 w-4" />
            </span>
            <span>Dashboard</span>
          </Link>
          <Link
            onClick={closeSidebar}
            to="/incubation-hub"
            className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-slate-400 hover:bg-slate-800/50 transition-colors"
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800 text-xs">
              <FlaskConical className="h-4 w-4" />
            </span>
            <span>Incubation Hub</span>
          </Link>
          <Link
            to="#"
            className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-slate-400 hover:bg-slate-800/50 transition-colors"
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800 text-xs">
              <PanelsTopLeft className="h-4 w-4" />
            </span>
            <span>Workspaces</span>
          </Link>
          <Link
            to="#"
            className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-slate-400 hover:bg-slate-800/50 transition-colors"
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800 text-xs">
              <Rss className="h-4 w-4" />
            </span>
            <span>Feed</span>
          </Link>
          <Link
            to="#"
            className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-slate-400 hover:bg-slate-800/50 transition-colors"
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800 text-xs">
              <MessageSquare className="h-4 w-4" />
            </span>
            <span>Messages</span>
          </Link>
          <Link
            to="#"
            className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-slate-400 hover:bg-slate-800/50 transition-colors"
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800 text-xs">
              <Route className="h-4 w-4" />
            </span>
            <span>Market Pathway</span>
          </Link>
          <Link
            to="#"
            className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-slate-400 hover:bg-slate-800/50 transition-colors"
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800 text-xs">
              <LineChart className="h-4 w-4" />
            </span>
            <span>Investors</span>
          </Link>
          <Link
            to="#"
            className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-slate-400 hover:bg-slate-800/50 transition-colors"
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800 text-xs">
              <User className="h-4 w-4" />
            </span>
            <span>Profile</span>
          </Link>
        </nav>

        <div className="px-4 pb-5 mt-auto">
          <div className="flex items-center gap-3 rounded-2xl bg-slate-900 px-3 py-3 border border-slate-800">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-500 text-white text-sm font-semibold">
              DU
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-white">Demo User</p>
              <p className="text-[0.7rem] text-slate-400">Founder</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
