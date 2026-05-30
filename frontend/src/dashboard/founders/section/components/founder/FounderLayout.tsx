// frontend/src/dashboard/founders/section/components/founder/FounderLayout.tsx
import { useEffect } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, FlaskConical, PanelsTopLeft, Rss, Compass, Lightbulb,
  Route as RouteIcon, MessageSquare, LineChart, Wallet, UserCircle,
  Settings as SettingsIcon, ArrowLeft,
} from "lucide-react";
import { Toaster } from "@/dashboard/collaborators/section/components/ui/sonner";
import { useFounderProfile } from "@/contexts/UserContext";
import { TopBarRoleMenu } from "./TopBarRoleMenu";

type NavKind = "link" | "external" | "placeholder";
interface NavItem { name: string; path: string; icon: typeof LayoutDashboard; kind: NavKind; }

const primaryNav: NavItem[] = [
  { name: "Dashboard",       path: "/dashboard",       icon: LayoutDashboard, kind: "link" },
  { name: "Incubation Hub",  path: "/incubation-hub",  icon: FlaskConical,    kind: "link" },
  { name: "Opportunity Hub", path: "/opportunity-hub", icon: Compass,         kind: "link" },
  { name: "Workspaces",      path: "/workspaces",      icon: PanelsTopLeft,   kind: "link" },
  { name: "Feed",            path: "/feed",            icon: Rss,             kind: "external" },
];

const comingSoonNav: NavItem[] = [
  { name: "Idea Hub",       path: "#", icon: Lightbulb, kind: "placeholder" },
  { name: "Market Pathway", path: "#", icon: RouteIcon, kind: "placeholder" },
];

const utilityNav: NavItem[] = [
  { name: "Messages",  path: "/chat",         icon: MessageSquare, kind: "link" },
  { name: "Investors", path: "/matchresults", icon: LineChart,     kind: "link" },
  { name: "Wallet",    path: "/wallet",       icon: Wallet,        kind: "external" },
];

const accountNav: NavItem[] = [
  { name: "Profile",  path: "/founder/profile",  icon: UserCircle,   kind: "link" },
  { name: "Settings", path: "/founder/settings", icon: SettingsIcon, kind: "link" },
];

export function FounderLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { founderProfile } = useFounderProfile();

  useEffect(() => {
    if (!founderProfile.onboardingComplete && !location.pathname.startsWith("/founder/onboarding")) {
      navigate("/founder/onboarding/step-1", { replace: true });
    }
  }, [founderProfile.onboardingComplete, location.pathname, navigate]);

  const isActive = (path: string) => location.pathname === path;
  const initials = founderProfile.name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);

  const renderItem = (item: NavItem) => {
    const Icon = item.icon;
    if (item.kind === "placeholder") {
      return (
        <span key={item.name}
          className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-slate-400 cursor-default">
          <Icon className="w-4 h-4" />
          <span className="flex-1 font-medium">{item.name}</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-mono uppercase tracking-wider">Soon</span>
        </span>
      );
    }
    const active = isActive(item.path);
    return (
      <Link key={item.path} to={item.path}
        className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors text-sm ${
          active
            ? "bg-violet-50 text-violet-700 border-l-2 border-violet-600"
            : "text-slate-700 hover:bg-slate-50"
        }`}>
        <Icon className="w-4 h-4" />
        <span className="flex-1 font-medium">{item.name}</span>
        {item.kind === "external" && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-mono uppercase tracking-wider">Hub</span>
        )}
      </Link>
    );
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <aside className="hidden lg:flex lg:flex-col w-64 bg-white border-r border-slate-200">
        <div className="p-5 border-b border-slate-200">
          <Link to="/" className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-violet-600 transition-colors mb-3">
            <ArrowLeft className="w-3 h-3" /> Back to TechIT
          </Link>
          <h1 className="text-xl font-bold text-violet-600 tracking-wide">TECHIT</h1>
          <p className="text-xs text-slate-500 mt-0.5">Founder Portal</p>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {primaryNav.map(renderItem)}
          <div className="px-4 pt-4 pb-1 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Coming soon</div>
          {comingSoonNav.map(renderItem)}
          <div className="h-px bg-slate-100 my-3" />
          {utilityNav.map(renderItem)}
          <div className="h-px bg-slate-100 my-3" />
          {accountNav.map(renderItem)}
        </nav>

        <Link to="/founder/profile" className="m-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-200 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-violet-600 text-white text-sm font-semibold flex items-center justify-center">{initials}</div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">{founderProfile.name}</p>
            <p className="text-xs text-slate-500 truncate">Founder · {founderProfile.startupName} · {founderProfile.stage}</p>
          </div>
        </Link>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 border-b border-slate-200 bg-white flex items-center justify-between px-6">
          <div className="text-sm text-slate-500">
            {[...primaryNav, ...utilityNav, ...accountNav].find((n) => isActive(n.path))?.name ?? ""}
          </div>
          <TopBarRoleMenu />
        </header>
        <div className="flex-1 overflow-y-auto"><Outlet /></div>
      </main>

      <Toaster richColors position="bottom-right" />
    </div>
  );
}
