import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Search,
  Radar,
  LineChart,
  Eye,
  Wallet,
  Globe,
  Database,
  Shield,
  Award,
  Rss,
  GraduationCap,
  ArrowLeft,
  UserCircle,
  ChevronRight,
} from 'lucide-react';
import { useInvestorProfile } from '@/contexts/UserContext';

interface NavItem {
  path: string;
  label: string;
  icon: typeof LayoutDashboard;
  external?: boolean;
  comingSoon?: boolean;
}

export function InvestorLayout() {
  const location = useLocation();
  const { investorProfile } = useInvestorProfile();

  const navItems: NavItem[] = [
    { path: '/investor', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/investor/deal-intelligence', label: 'Deal Intelligence', icon: Search },
    { path: '/investor/risk-analysis', label: 'Risk Analysis', icon: Radar },
    { path: '/investor/allocation', label: 'Allocation Engine', icon: LineChart },
    { path: '/investor/watchlist', label: 'Watchlist', icon: Eye },
    { path: '/investor/capital-pools', label: 'Capital Pools', icon: Wallet },
    { path: '/investor/heatmap', label: 'Global Heatmap', icon: Globe },
    { path: '/investor/data-rooms', label: 'Data Rooms', icon: Database },
    { path: '/investor/deal-rooms', label: 'Deal Rooms', icon: Shield },
    { path: '/investor/reputation', label: 'Reputation', icon: Award },
    { path: '/investor/profile', label: 'Profile', icon: UserCircle },
    // Cross-section + placeholder
    { path: '/feed', label: 'Feed', icon: Rss, external: true },
    { path: '#', label: 'Mentorship Hub', icon: GraduationCap, comingSoon: true },
  ];

  const isActive = (path: string) => {
    if (path === '/investor') {
      return location.pathname === '/investor' || location.pathname === '/investor/dashboard';
    }
    if (path === '#' || path === '/feed') return false;
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-foreground">
      {/* Sidebar */}
      <aside className="w-64 bg-[#111111] border-r border-border flex flex-col">
        <div className="p-6 border-b border-border">
          <h1 className="text-2xl font-bold text-white">
            TECH<span className="text-emerald-400">IT</span>
          </h1>
          <p className="text-xs text-muted-foreground/70 mt-1 font-mono">INVESTOR INTELLIGENCE</p>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            const baseClass = `flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              active
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'text-muted-foreground/70 hover:text-foreground/80 hover:bg-card/50'
            }`;

            if (item.comingSoon) {
              return (
                <button
                  key={item.label}
                  type="button"
                  disabled
                  title="Coming soon"
                  className={`${baseClass} w-full text-left opacity-70 cursor-not-allowed`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-sm font-medium flex-1">{item.label}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-card text-muted-foreground/70 font-mono uppercase tracking-wider">
                    Soon
                  </span>
                </button>
              );
            }

            return (
              <Link key={item.path} to={item.path} className={baseClass}>
                <Icon className="w-5 h-5" />
                <span className="text-sm font-medium flex-1">{item.label}</span>
                {item.external && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-card text-muted-foreground/70 font-mono uppercase tracking-wider">
                    Hub
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border space-y-3">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs text-muted-foreground/70 hover:text-foreground/80 hover:bg-card/50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to TechIT
          </Link>
          <Link
            to="/investor/profile"
            className="block group px-4 py-3 bg-card/50 hover:bg-card rounded-lg transition-colors"
            title="Open investor profile"
          >
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground/70">
                  {investorProfile.investorType || 'Investor'}
                </p>
                <p className="text-sm font-medium text-white mt-0.5 truncate">
                  {investorProfile.location || 'Capital Partners LP'}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-emerald-400 transition-colors flex-shrink-0 ml-2" />
            </div>
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
