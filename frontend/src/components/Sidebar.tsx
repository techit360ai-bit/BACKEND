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
  Wallet,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useSidebar } from "../contexts/SidebarContext";

export default function Sidebar() {
  const { isOpen, closeSidebar } = useSidebar();
  const { pathname } = useLocation();

  const activeClass =
    "bg-linear-to-r from-violet-500 to-violet-600 text-white font-medium shadow-lg shadow-violet-500/20 dark:shadow-violet-600/20 hover:from-violet-600 hover:to-violet-700";

  const navItem = (to: string, hoverColor: string) =>
    pathname === to
      ? `w-full flex items-center gap-3 rounded-xl px-3 py-2.5 ${activeClass} transition-all`
      : `w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-slate-700 dark:text-slate-300 ${hoverColor} transition-colors`;

  const iconClass = (to: string) =>
    pathname === to
      ? "inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white/20 text-xs"
      : "inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-200 dark:bg-slate-800 text-xs";

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
        className={`fixed md:sticky top-0 left-0 h-dvh z-50 w-64 xl:w-72 flex flex-col border-r border-sidebar-border bg-linear-to-b from-slate-50 to-indigo-50 dark:from-slate-950 dark:to-slate-900 text-foreground dark:text-sidebar-foreground transition-transform duration-300 md:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } md:relative`}
      >
        <div className="px-5 pt-5 pb-4 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-violet-500 to-cyan-500 text-white shadow-lg shadow-violet-500/30 dark:shadow-violet-600/30">
            <Lightbulb className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              TechIT Network
            </p>
            <p className="text-[0.7rem] text-slate-500 dark:text-slate-400">
              Build. Match. Launch.
            </p>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-1 text-sm">
          <Link
            to="/dashboard"
            onClick={closeSidebar}
            className={navItem(
              "/dashboard",
              "hover:bg-violet-100/50 dark:hover:bg-violet-950/50",
            )}
          >
            <span className={iconClass("/dashboard")}>
              <LayoutDashboard className="h-4 w-4" />
            </span>
            <span>Dashboard</span>
          </Link>
          <Link
            to="/incubation-hub"
            onClick={closeSidebar}
            className={navItem(
              "/incubation-hub",
              "hover:bg-violet-100/50 dark:hover:bg-violet-950/50",
            )}
          >
            <span className={iconClass("/incubation-hub")}>
              <FlaskConical className="h-4 w-4" />
            </span>
            <span>Incubation Hub</span>
          </Link>
          <Link
            to="#"
            className={navItem(
              "#",
              "hover:bg-cyan-100/50 dark:hover:bg-cyan-950/50",
            )}
          >
            <span className={iconClass("#")}>
              <PanelsTopLeft className="h-4 w-4" />
            </span>
            <span>Workspaces</span>
          </Link>
          <Link
            to="/chat"
            className={navItem(
              "/chat",
              "hover:bg-teal-100/50 dark:hover:bg-teal-950/50",
            )}
          >
            <span className={iconClass("#")}>
              <Rss className="h-4 w-4" />
            </span>
            <span>Feed</span>
          </Link>
          <Link
            to="#"
            onClick={closeSidebar}
            className={navItem(
              "#",
              "hover:bg-cyan-100/50 dark:hover:bg-cyan-950/50",
            )}
          >
            <span className={iconClass("/chat")}>
              <MessageSquare className="h-4 w-4" />
            </span>
            <span>Messages</span>
          </Link>
          <Link
            to="#"
            className={navItem(
              "#",
              "hover:bg-rose-100/50 dark:hover:bg-rose-950/50",
            )}
          >
            <span className={iconClass("#")}>
              <Route className="h-4 w-4" />
            </span>
            <span>Market Pathway</span>
          </Link>
          <Link
            to="#"
            className={navItem(
              "#",
              "hover:bg-violet-100/50 dark:hover:bg-violet-950/50",
            )}
          >
            <span className={iconClass("#")}>
              <LineChart className="h-4 w-4" />
            </span>
            <span>Investors</span>
          </Link>
          <Link
            to="/wallet"
            onClick={closeSidebar}
            className={navItem(
              "/wallet",
              "hover:bg-cyan-100/50 dark:hover:bg-cyan-950/50",
            )}
          >
            <span className={iconClass("/wallet")}>
              <Wallet className="h-4 w-4" />
            </span>
            <span>Wallet</span>
          </Link>
          <Link
            to="#"
            className={navItem(
              "#",
              "hover:bg-teal-100/50 dark:hover:bg-teal-950/50",
            )}
          >
            <span className={iconClass("#")}>
              <User className="h-4 w-4" />
            </span>
            <span>Profile</span>
          </Link>
        </nav>

        <div className="px-4 pb-5 mt-auto">
          <div className="flex items-center gap-3 rounded-2xl bg-linear-to-r from-violet-50 to-cyan-50 dark:from-violet-950/40 dark:to-cyan-950/40 px-3 py-3 border border-violet-200 dark:border-violet-800/50">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-linear-to-br from-violet-500 to-cyan-500 text-white text-sm font-semibold shadow-lg shadow-violet-500/30">
              DU
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                Demo User
              </p>
              <p className="text-[0.7rem] text-slate-600 dark:text-slate-400">
                Founder
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
