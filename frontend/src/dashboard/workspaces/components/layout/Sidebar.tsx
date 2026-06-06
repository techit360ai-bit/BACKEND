import { Link, NavLink } from 'react-router-dom';
import {
  Hammer,
  Bot,
  MessageCircle,
  FolderOpen,
  BarChart3,
  ChevronLeft,
  Github,
  ArrowLeft,
  Plug,
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { useState } from 'react';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  badge?: string | number;
  glow?: boolean;
}

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navItems: NavItem[] = [
    { path: '/workspaces/build', label: 'Build', icon: <Hammer className="w-5 h-5" /> },
    { path: '/workspaces/connectors', label: 'Connectors', icon: <Plug className="w-5 h-5" /> },
    { path: '/workspaces/agents', label: 'Agents', icon: <Bot className="w-5 h-5" />, glow: true },
    { path: '/workspaces/chat', label: 'Chat', icon: <MessageCircle className="w-5 h-5" />, badge: 3 },
    { path: '/workspaces/files', label: 'Files', icon: <FolderOpen className="w-5 h-5" /> },
    { path: '/workspaces/github', label: 'GitHub', icon: <Github className="w-5 h-5" /> },
    { path: '/workspaces/reports', label: 'Reports', icon: <BarChart3 className="w-5 h-5" /> },
  ];

  return (
    <aside 
      className={`${isCollapsed ? 'w-[72px]' : 'w-[240px]'} bg-[#0A1929] text-white flex flex-col transition-all duration-300`}
      style={{ height: 'calc(100vh - 60px)' }}
    >
      {/* Logo/Branding */}
      <div className="p-6 flex items-center justify-between">
        {!isCollapsed && (
          <div>
            <div className="text-lg font-semibold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              TechIT
            </div>
            <div className="text-xs text-gray-400">Workspace</div>
          </div>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 hover:bg-white/10 rounded-lg transition-colors ml-auto"
        >
          <ChevronLeft className={`w-4 h-4 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all relative group ${
                isActive
                  ? 'bg-white/10 border-l-4 border-[#2196F3]'
                  : 'hover:bg-white/5'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`${item.glow ? 'relative' : ''}`}>
                  {item.icon}
                  {item.glow && (
                    <div className="absolute inset-0 blur-md bg-[#2196F3] opacity-50 animate-pulse" />
                  )}
                </div>
                {!isCollapsed && (
                  <>
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <Badge className="bg-[#F59E0B] text-white text-xs px-1.5 min-w-[20px] h-5 flex items-center justify-center">
                        {item.badge}
                      </Badge>
                    )}
                  </>
                )}
                {isCollapsed && item.badge && (
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-[#F59E0B] rounded-full" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom Section */}
      <div className="p-4 border-t border-white/10 space-y-3">
        <Link
          to="/dashboard"
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {!isCollapsed && <span>Back to TechIT</span>}
        </Link>
        {!isCollapsed && (
          <div className="bg-gradient-to-r from-[#2196F3]/20 to-purple-500/20 p-4 rounded-lg border border-[#2196F3]/30">
            <div className="text-sm font-semibold mb-1">Upgrade to Premium</div>
            <div className="text-xs text-gray-300 mb-3">
              Unlock advanced AI agents and features
            </div>
            <button className="w-full bg-[#2196F3] hover:bg-[#2196F3]/90 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              Upgrade Now
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
