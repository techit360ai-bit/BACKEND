import {
  LayoutDashboard,
  FlaskConical,
  PanelsTopLeft,
  Rss,
  MessageSquare,
  Route,
  LineChart,
  User,
  LogOut,
  Sparkles,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import AICopilot from "./AICopilot";

interface CollaboratorSidebarProps {
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

const CollaboratorSidebar = ({
  isOpenMobile = false,
  onCloseMobile,
}: CollaboratorSidebarProps) => {
  const [showCopilot, setShowCopilot] = useState(false);
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const getLinkStyles = (path: string) => {
    const baseStyles =
      "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all";
    const activeStyles =
      "bg-linear-to-r from-violet-500 to-violet-600 text-white font-semibold shadow-lg shadow-violet-500/25 dark:shadow-violet-600/25 hover:from-violet-600 hover:to-violet-700";
    const inactiveStyles =
      "text-muted-foreground hover:bg-accent/30 dark:hover:bg-slate-800/50";

    return `${baseStyles} ${isActive(path) ? activeStyles : inactiveStyles}`;
  };

  const sidebarContent = (
    <>
      {/* Logo Section */}
      <div className="px-5 pt-5 pb-4 flex items-center gap-3 border-b border-border/40">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-violet-500 to-cyan-500 text-white shadow-lg shadow-violet-500/30 dark:shadow-violet-600/30">
          <span className="text-lg font-bold">T</span>
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">TechIT C³</p>
          <p className="text-[0.65rem] text-muted-foreground font-medium">
            Command Center
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 text-sm overflow-y-auto">
        {/* Command Center */}
        <Link
          to="/collaborator/dashboard"
          className={getLinkStyles("/collaborator/dashboard")}
          onClick={onCloseMobile}
        >
          <LayoutDashboard className="h-5 w-5" />
          <span>Command Center</span>
        </Link>

        {/* Other Navigation Items */}
        <div className="pt-2 space-y-1">
          <Link
            to="/collaborator/tasks"
            className={getLinkStyles("/collaborator/tasks")}
            onClick={onCloseMobile}
          >
            <FlaskConical className="h-5 w-5" />
            <span>Tasks</span>
          </Link>

          <Link
            to="/collaborator/performance"
            className={getLinkStyles("/collaborator/performance")}
            onClick={onCloseMobile}
          >
            <LineChart className="h-5 w-5" />
            <span>Performance</span>
          </Link>

          <Link
            to="/collaborator/opportunities"
            className={getLinkStyles("/collaborator/opportunities")}
            onClick={onCloseMobile}
          >
            <PanelsTopLeft className="h-5 w-5" />
            <span>Opportunities</span>
          </Link>

          <Link
            to="/collaborator/messages"
            className={getLinkStyles("/collaborator/messages")}
            onClick={onCloseMobile}
          >
            <Rss className="h-5 w-5" />
            <span>Messages</span>
          </Link>

          <Link to="#" className={getLinkStyles("#")} onClick={onCloseMobile}>
            <Route className="h-5 w-5" />
            <span>Reputation</span>
          </Link>

          <Link
            to="/collaborator/earnings"
            className={getLinkStyles("/collaborator/earnings")}
            onClick={onCloseMobile}
          >
            <MessageSquare className="h-5 w-5" />
            <span>Earnings</span>
          </Link>

          <Link to="#" className={getLinkStyles("#")} onClick={onCloseMobile}>
            <User className="h-5 w-5" />
            <span>Profile</span>
          </Link>

          <Link
            to="/collaborator/tools"
            className={getLinkStyles("/collaborator/tools")}
            onClick={onCloseMobile}
          >
            <FlaskConical className="h-5 w-5" />
            <span>Tools</span>
          </Link>
        </div>
      </nav>

      {/* User Profile Section */}
      <div className="px-4 pb-5 mt-auto border-t border-border/40 pt-4 space-y-3">
        <div className="rounded-2xl bg-card/60 dark:bg-slate-800/50 border border-border/50 px-4 py-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
            Quick Stats
          </p>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Active Projects</span>
              <span className="font-semibold text-foreground">3</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Match Score</span>
              <span className="font-semibold text-foreground">94%</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-2xl bg-card/80 dark:bg-slate-800/70 border border-border/50 px-3 py-3 hover:bg-card dark:hover:bg-slate-800 transition-colors cursor-pointer">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-linear-to-br from-violet-500 to-cyan-500 text-white text-xs font-semibold shadow-lg shadow-violet-500/30 dark:shadow-violet-600/30">
            AC
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              Alex Chen
            </p>
            <p className="text-[0.7rem] text-muted-foreground truncate">
              Collaborator
            </p>
          </div>
          <button
            onClick={() => setShowCopilot(!showCopilot)}
            className="p-1 hover:bg-violet-100 dark:hover:bg-violet-950/50 rounded-lg transition-colors"
            title="AI Copilot"
          >
            <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          </button>
          <button className="p-1 hover:bg-muted rounded-lg transition-colors">
            <LogOut className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {showCopilot && (
          <AICopilot
            hideButton={true}
            initialOpen={true}
            onClose={() => setShowCopilot(false)}
          />
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 xl:w-72 flex-col border-r border-border bg-linear-to-b from-slate-50 to-indigo-50 dark:from-slate-950 dark:to-slate-900 text-sidebar-foreground fixed left-0 top-0 h-dvh z-40 overflow-hidden">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar */}
      {isOpenMobile && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
            onClick={onCloseMobile}
          />
          {/* Mobile Sidebar */}
          <aside className="md:hidden fixed left-0 top-0 w-64 h-dvh bg-linear-to-b from-slate-50 to-indigo-50 dark:from-slate-950 dark:to-slate-900 z-40 overflow-hidden flex flex-col pt-16">
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
};

export default CollaboratorSidebar;
