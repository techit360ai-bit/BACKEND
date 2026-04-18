import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  BarChart3,
  Zap,
  TrendingUp,
  Bookmark,
  Layers,
  Globe,
  Users,
  Menu,
  X,
} from "lucide-react";

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path?: string;
}

interface InvestorSidebarProps {
  onNavigate?: (path: string) => void;
  isMobile?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}

export function InvestorSidebar({
  onNavigate,
  isMobile = false,
  isOpen = false,
  onClose,
}: InvestorSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems: NavItem[] = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: <BarChart3 className="w-5 h-5" />,
      path: "/investor/dashboard",
    },
    {
      id: "deal-intelligence",
      label: "Deal Intelligence",
      icon: <Zap className="w-5 h-5" />,
      path: "/investor/deal-intelligence",
    },
    {
      id: "allocation-engine",
      label: "Allocation Engine",
      icon: <TrendingUp className="w-5 h-5" />,
      path: "/investor/allocation-engine",
    },
    {
      id: "watchlist",
      label: "Watchlist",
      icon: <Bookmark className="w-5 h-5" />,
      path: "/investor/watchlist",
    },
    {
      id: "capital-pools",
      label: "Capital Pools",
      icon: <Layers className="w-5 h-5" />,
      path: "/investor/capital-pools",
    },
    {
      id: "global-heatmap",
      label: "Global Heatmap",
      icon: <Globe className="w-5 h-5" />,
      path: "/investor/global-heatmap",
    },
    {
      id: "reputation",
      label: "Reputation",
      icon: <Users className="w-5 h-5" />,
      path: "/investor/reputation",
    },
  ];

  const handleNavigation = (path?: string) => {
    if (path) {
      navigate(path);
      if (onNavigate) onNavigate(path);
    }
    if (isMobile) {
      setIsOpen(false);
    }
  };

  const isActive = (path?: string) => {
    return path && location.pathname === path;
  };

  if (isMobile) {
    return (
      <div className="md:hidden w-full h-full">
        {/* Mobile Overlay */}
        {isOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
            onClick={onClose}
          />
        )}

        {/* Mobile Sidebar */}
        <div
          className={`fixed left-0 top-0 h-full w-64 bg-gradient-to-b from-white to-slate-50 dark:from-slate-950 dark:to-slate-900 transform transition-transform duration-300 z-40 overflow-y-auto ${
            isOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="pt-20 px-4 pb-8">
            <div className="mb-8">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-teal-600 dark:from-teal-400 to-cyan-600 dark:to-cyan-400 bg-clip-text text-transparent">
                TECHIT
              </h1>
              <p className="text-xs text-teal-600 dark:text-teal-400 mt-1">
                INVESTOR INTELLIGENCE
              </p>
            </div>

            <nav className="space-y-2">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleNavigation(item.path)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left ${
                    isActive(item.path)
                      ? "bg-teal-500/20 dark:bg-teal-500/20 border-l-4 border-teal-600 dark:border-teal-400 text-teal-600 dark:text-teal-400"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  {item.icon}
                  <span className="font-medium text-sm">{item.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>
      </div>
    );
  }

  // Desktop Sidebar
  return (
    <div className="hidden md:block fixed left-0 top-0 h-full w-64 bg-gradient-to-b from-white to-slate-50 dark:from-slate-950 dark:to-slate-900 border-r border-slate-200 dark:border-slate-800 overflow-y-auto">
      <div className="pt-8 px-6 pb-8">
        {/* Logo */}
        <div className="mb-12">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 dark:from-teal-400 to-cyan-600 dark:to-cyan-400 bg-clip-text text-transparent">
            TECHIT
          </h1>
          <p className="text-xs text-teal-600 dark:text-teal-300 mt-1 font-semibold tracking-wider">
            INVESTOR INTELLIGENCE
          </p>
        </div>

        {/* Navigation */}
        <nav className="space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavigation(item.path)}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-lg transition-all text-left ${
                isActive(item.path)
                  ? "bg-teal-500/20 dark:bg-teal-500/20 border-r-4 border-teal-600 dark:border-teal-400 text-teal-600 dark:text-teal-400"
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-white hover:translate-x-1"
              }`}
            >
              {item.icon}
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Footer Section */}
      <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-teal-500/10 dark:from-teal-500/10 to-cyan-500/10 dark:to-cyan-500/10 border border-teal-300 dark:border-teal-500/30">
          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-teal-500 dark:from-teal-400 to-cyan-500 dark:to-cyan-400 flex items-center justify-center text-white dark:text-slate-900 font-bold">
            CP
          </div>
          <div className="text-sm">
            <p className="text-slate-900 dark:text-slate-100 font-medium">
              Capital Partners LP
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Investor
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
