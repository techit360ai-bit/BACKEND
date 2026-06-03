import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bell, Globe, Users, FileText, HelpCircle, Compass } from 'lucide-react';
import { NotificationsPanel } from './NotificationsPanel';

// Unread count — in a real app this would come from server state
const UNREAD_COUNT = 5;

export function Layout({ children }: { children: ReactNode }) {
  const [notifOpen, setNotifOpen] = useState(false);

  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      {/* Global Nav Bar */}
      <GlobalNav unreadCount={UNREAD_COUNT} onNotifClick={() => setNotifOpen(true)} />

      {/* Main Content */}
      {children}

      {/* Mobile Bottom Tab Bar */}
      <MobileTabBar />

      {/* Notifications Panel (portal) */}
      <NotificationsPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
    </div>
  );
}

function GlobalNav({
  unreadCount,
  onNotifClick,
}: {
  unreadCount: number;
  onNotifClick: () => void;
}) {
  const location = useLocation();

  return (
    <nav className="h-14 bg-bg-surface border-b border-border-default px-8 flex items-center justify-between sticky top-0 z-50">
      {/* Left - Logo + Nav Links */}
      <div className="flex items-center gap-8">
        <Link to="/feed">
          <h1 className="text-[16px] font-bold tracking-[2px] text-text-primary">
            TECH<span className="text-accent-primary">•</span>IT
          </h1>
        </Link>

        <div className="hidden lg:flex items-center gap-6 text-[14px] font-medium">
          <NavLink to="/dashboard" label="Dashboard" />
          <NavLink
            to="/feed"
            label="Hangout"
            active={
              location.pathname === '/feed' ||
              location.pathname.startsWith('/feed/post')
            }
          />
          <NavLink to="/incubation-hub" label="Incubator" />
          <NavLink to="/workspaces" label="Workspace" />
          <NavLink to="/training" label="Training" />
          <NavLink to="/investor/dashboard" label="Investors" />
        </div>
      </div>

      {/* Right - Notifications, Avatar */}
      <div className="flex items-center gap-5">
        {/* Notification Bell */}
        <button
          onClick={onNotifClick}
          className="relative p-1.5 rounded-lg hover:bg-bg-elevated transition-colors group"
          aria-label="Open notifications"
        >
          <Bell className="w-5 h-5 text-text-secondary group-hover:text-text-primary transition-colors" />
          {unreadCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full text-white font-bold px-1"
              style={{
                backgroundColor: 'var(--accent-primary)',
                fontSize: '9px',
              }}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Avatar with GSIS Badge */}
        <Link to="/feed/profile/me">
          <div className="relative cursor-pointer group">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-primary to-score-purple" />
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-score-amber flex items-center justify-center group-hover:scale-110 transition-transform">
              <span className="font-mono text-[9px] text-white font-semibold">68</span>
            </div>
          </div>
        </Link>
      </div>
    </nav>
  );
}

function NavLink({
  to,
  label,
  active,
}: {
  to: string;
  label: string;
  active?: boolean;
}) {
  const location = useLocation();
  const isActive = active !== undefined ? active : location.pathname === to;

  return (
    <Link
      to={to}
      className={`relative pb-1 transition-colors ${
        isActive
          ? 'text-accent-primary'
          : 'text-text-secondary hover:text-text-primary'
      }`}
    >
      {label}
      {isActive && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-primary" />
      )}
    </Link>
  );
}

function MobileTabBar() {
  const location = useLocation();

  const tabs = [
    { id: 'feed', path: '/feed', icon: Globe, label: 'Feed' },
    { id: 'tribe', path: '/feed/tribe', icon: Users, label: 'Tribe' },
    { id: 'builds', path: '/feed/build-log', icon: FileText, label: 'Builds' },
    { id: 'qa', path: '/feed/questions', icon: HelpCircle, label: 'Q&A' },
    { id: 'log', path: '/feed/my-log', icon: Compass, label: 'My Log' },
  ];

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 h-14 bg-bg-surface border-t border-border-default flex items-center justify-around z-40">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = location.pathname === tab.path;
        return (
          <Link
            key={tab.id}
            to={tab.path}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full"
          >
            <Icon
              className={`w-5 h-5 ${isActive ? 'text-accent-primary' : 'text-text-muted'}`}
            />
            {isActive && (
              <span className="text-[10px] text-accent-primary font-medium">
                {tab.label}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
