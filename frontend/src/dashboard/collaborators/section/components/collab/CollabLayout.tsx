import { useEffect } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, CheckSquare, TrendingUp, DollarSign, PieChart,
  Sparkles, Award, MessageSquare, Wrench, Rss, UserCircle,
  Settings as SettingsIcon, ArrowLeft,
} from "lucide-react";
import { Toaster } from "@/dashboard/collaborators/section/components/ui/sonner";
import { useCollaboratorProfile } from "@/contexts/UserContext";
import { equityTotals } from "@/dashboard/collaborators/section/data/mockData";
import { TopBarRoleMenu } from "./TopBarRoleMenu";

interface NavItem {
  name: string;
  path: string;
  icon: typeof LayoutDashboard;
  external?: boolean;
}

const primaryNav: NavItem[] = [
  { name: "Dashboard",     path: "/collaborator/dashboard",     icon: LayoutDashboard },
  { name: "Tasks",         path: "/collaborator/tasks",         icon: CheckSquare },
  { name: "Performance",   path: "/collaborator/performance",   icon: TrendingUp },
  { name: "Earnings",      path: "/collaborator/earnings",      icon: DollarSign },
  { name: "Equity",        path: "/collaborator/equity",        icon: PieChart },
  { name: "Opportunities", path: "/collaborator/opportunities", icon: Sparkles },
  { name: "Reputation",    path: "/collaborator/reputation",    icon: Award },
  { name: "Messages",      path: "/collaborator/messages",      icon: MessageSquare },
  { name: "Tools",         path: "/collaborator/tools",         icon: Wrench },
  { name: "Feed",          path: "/feed",                       icon: Rss, external: true },
];

const accountNav: NavItem[] = [
  { name: "Profile",  path: "/collaborator/profile",  icon: UserCircle },
  { name: "Settings", path: "/collaborator/settings", icon: SettingsIcon },
];

export function CollabLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { collaboratorProfile } = useCollaboratorProfile();

  // Defensive redirect: un-onboarded users go to step 1
  useEffect(() => {
    if (!collaboratorProfile.onboardingComplete && !location.pathname.startsWith("/collaborator/onboarding")) {
      navigate("/collaborator/onboarding/step-1", { replace: true });
    }
  }, [collaboratorProfile.onboardingComplete, location.pathname, navigate]);

  const isActive = (path: string) => location.pathname === path;

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const active = isActive(item.path);
    return (
      <Link key={item.path} to={item.path}
        className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors text-sm ${
          active
            ? "bg-amber-500/10 text-amber-400 border-l-2 border-amber-500"
            : "text-slate-300 hover:bg-slate-800 hover:text-white"
        }`}>
        <Icon className="w-4 h-4" />
        <span className="flex-1 font-medium">{item.name}</span>
        {item.external && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 font-mono uppercase tracking-wider">
            Hub
          </span>
        )}
      </Link>
    );
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <aside className="hidden lg:flex lg:flex-col w-64 bg-slate-900 border-r border-slate-800">
        <div className="p-5 border-b border-slate-800">
          <Link to="/dashboard" className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-amber-400 transition-colors mb-3">
            <ArrowLeft className="w-3 h-3" />
            Back to TechIT
          </Link>
          <h1 className="text-xl font-bold text-amber-400 tracking-wide">TECHIT</h1>
          <p className="text-xs text-slate-400 mt-0.5">Collaborator Portal</p>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {primaryNav.map(renderNavItem)}
          <div className="h-px bg-slate-800 my-3" />
          {accountNav.map(renderNavItem)}
        </nav>

        <Link to="/collaborator/equity" className="m-3 p-3 rounded-lg bg-slate-800 hover:bg-slate-800/70 transition-colors border border-slate-700">
          <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Building for Equity</p>
          <p className="text-sm text-white mt-1 tabular-nums">
            ${(equityTotals.totalValueUSD / 1000).toFixed(1)}K ownership across 3 startups
          </p>
          <p className="text-xs text-amber-400 mt-1">View equity →</p>
        </Link>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 border-b border-slate-200 bg-white flex items-center justify-between px-6">
          <div className="text-sm text-slate-500">
            {primaryNav.find((n) => isActive(n.path))?.name ?? accountNav.find((n) => isActive(n.path))?.name ?? ""}
          </div>
          <TopBarRoleMenu />
        </header>

        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>

      <Toaster richColors position="bottom-right" />
    </div>
  );
}
