import { Outlet, Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  GraduationCap,
  UserSearch,
  Brain,
  BarChart3,
  ShoppingBag,
  Rocket,
  MessageSquare,
  Plug,
  CreditCard,
  Settings as SettingsIcon,
  Trophy,
  Rss,
  UserCircle,
  ArrowLeft,
  Menu,
  X,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { useOrgProfile } from "@/contexts/UserContext";

interface NavItem {
  name: string;
  path: string;
  icon: typeof LayoutDashboard;
  external?: boolean;
  group?: "main" | "extra";
}

const navigation: NavItem[] = [
  { name: "Dashboard", path: "/org/dashboard", icon: LayoutDashboard },
  { name: "Teams", path: "/org/teams", icon: Users },
  { name: "Projects", path: "/org/projects", icon: FolderKanban },
  { name: "Incubator Programs", path: "/org/incubator", icon: GraduationCap },
  { name: "Hackathons", path: "/org/hackathons", icon: Trophy },
  { name: "Talent Pool", path: "/org/talent", icon: UserSearch },
  { name: "AI Operations", path: "/org/ai-ops", icon: Brain },
  { name: "Analytics", path: "/org/analytics", icon: BarChart3 },
  { name: "Marketplace", path: "/org/marketplace", icon: ShoppingBag },
  { name: "Market Ready", path: "/org/market-ready", icon: Rocket },
  { name: "Hangout", path: "/org/hangout", icon: MessageSquare },
  { name: "Feed", path: "/feed", icon: Rss, external: true },
  { name: "Integrations", path: "/org/integrations", icon: Plug },
  { name: "Billing & Usage", path: "/org/billing", icon: CreditCard },
  { name: "Settings", path: "/org/settings", icon: SettingsIcon },
];

export function OrgLayout() {
  const location = useLocation();
  const { orgProfile } = useOrgProfile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string) =>
    path === "/org/hackathons"
      ? location.pathname.startsWith("/org/hackathons")
      : location.pathname === path;

  const planLabel =
    orgProfile.plan === "enterprise"
      ? "Enterprise Plan"
      : orgProfile.plan === "growth"
        ? "Growth Plan"
        : "Free Plan";

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const active = isActive(item.path);
    return (
      <Link
        key={item.path}
        to={item.path}
        onClick={() => setMobileMenuOpen(false)}
        className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
          active
            ? "bg-indigo-50 text-indigo-600"
            : "text-gray-700 hover:bg-gray-50"
        }`}
      >
        <Icon className="w-5 h-5" />
        <span className="text-sm font-medium flex-1">{item.name}</span>
        {item.external && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-mono uppercase tracking-wider">
            Hub
          </span>
        )}
      </Link>
    );
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex lg:flex-col w-64 bg-white border-r border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <Link
            to="/dashboard"
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 transition-colors mb-3"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to TechIT
          </Link>
          <h1 className="text-2xl font-bold text-indigo-600">TECHIT</h1>
          <p className="text-sm text-gray-600 mt-1">Organization Portal</p>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {navigation.map(renderNavItem)}
          <Link
            to="/org/profile"
            onClick={() => setMobileMenuOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              location.pathname === "/org/profile"
                ? "bg-indigo-50 text-indigo-600"
                : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            <UserCircle className="w-5 h-5" />
            <span className="text-sm font-medium">Profile</span>
          </Link>
        </nav>

        <div className="p-4 border-t border-gray-200">
          <Link
            to="/org/billing"
            className="block bg-indigo-50 hover:bg-indigo-100 rounded-lg p-4 group transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs font-medium text-indigo-900 truncate">
                  {orgProfile.orgName}
                </p>
                <p className="text-xs text-indigo-700 mt-1">{planLabel}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-indigo-400 group-hover:text-indigo-600 transition-colors flex-shrink-0 ml-2" />
            </div>
          </Link>
        </div>
      </aside>

      {/* Mobile Menu Button */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-50">
        <div className="flex items-center justify-between p-4">
          <h1 className="text-xl font-bold text-indigo-600">TECHIT</h1>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-white pt-16 overflow-y-auto">
          <nav className="p-4 space-y-1">
            {navigation.map(renderNavItem)}
            <Link
              to="/org/profile"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                location.pathname === "/org/profile"
                  ? "bg-indigo-50 text-indigo-600"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <UserCircle className="w-5 h-5" />
              <span className="text-sm font-medium">Profile</span>
            </Link>
            <Link
              to="/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-500 hover:bg-gray-50 mt-4 border-t border-gray-100 pt-4"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Back to TechIT</span>
            </Link>
          </nav>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pt-16 lg:pt-0">
        <Outlet />
      </main>
    </div>
  );
}
