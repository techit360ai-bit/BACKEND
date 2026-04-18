import { Outlet, Link, useLocation } from 'react-router';
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
} from 'lucide-react';

export function InvestorLayout() {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/deal-intelligence', label: 'Deal Intelligence', icon: Search },
    { path: '/allocation', label: 'Allocation Engine', icon: LineChart },
    { path: '/watchlist', label: 'Watchlist', icon: Eye },
    { path: '/capital-pools', label: 'Capital Pools', icon: Wallet },
    { path: '/heatmap', label: 'Global Heatmap', icon: Globe },
    { path: '/reputation', label: 'Reputation', icon: Award },
  ];

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-[#111111] border-r border-gray-800 flex flex-col">
        <div className="p-6 border-b border-gray-800">
          <h1 className="text-2xl font-bold text-white">
            TECH<span className="text-emerald-400">IT</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1 font-mono">INVESTOR INTELLIGENCE</p>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  isActive(item.path)
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-800">
          <div className="px-4 py-3 bg-gray-800/50 rounded-lg">
            <p className="text-xs text-gray-400">Investor</p>
            <p className="text-sm font-medium text-white mt-1">Capital Partners LP</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
