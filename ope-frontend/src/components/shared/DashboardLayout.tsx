import { useState, useEffect } from 'react'
import { NavLink, Link, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Rss, MessageCircle, Bell, Wallet, Settings,
  LogOut, Zap, ChevronLeft, ChevronRight, Rocket, Users,
  TrendingUp, Building2, Briefcase, Star, Target, PieChart,
  Trophy, Search, Code2, UserPlus, Globe, Menu, X,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useAuth } from '../../contexts/AuthContext'
import { useCredits } from '../../contexts/CreditContext'
import { Avatar } from '../ui'
import type { Role } from '../../contexts/AuthContext'

// ── Nav definitions ───────────────────────────────────────────
type NavItem = { label: string; icon: React.ComponentType<{ className?: string }>; href: string }

const navByRole: Record<Role, NavItem[]> = {
  founder: [
    { label: 'Dashboard',     icon: LayoutDashboard, href: '/dashboard' },
    { label: 'Social Feed',   icon: Rss,             href: '/feed' },
    { label: 'People',        icon: Users,           href: '/people' },
    { label: 'Projects',      icon: Globe,           href: '/projects' },
    { label: 'Workspaces',    icon: Code2,           href: '/workspaces' },
    { label: 'Submit Idea',   icon: Rocket,          href: '/idea-submit' },
    { label: 'Find Team',     icon: UserPlus,        href: '/matches' },
    { label: 'Incubation Hub',icon: Trophy,          href: '/incubation-hub' },
    { label: 'Messages',      icon: MessageCircle,   href: '/messages' },
    { label: 'Notifications', icon: Bell,            href: '/notifications' },
    { label: 'Wallet',        icon: Wallet,          href: '/wallet' },
  ],
  collaborator: [
    { label: 'Dashboard',     icon: LayoutDashboard, href: '/collaborator/dashboard' },
    { label: 'Social Feed',   icon: Rss,             href: '/feed' },
    { label: 'People',        icon: Users,           href: '/people' },
    { label: 'Projects',      icon: Globe,           href: '/projects' },
    { label: 'Opportunities', icon: Target,          href: '/collaborator/opportunities' },
    { label: 'My Work',       icon: Briefcase,       href: '/collaborator/work' },
    { label: 'Performance',   icon: TrendingUp,      href: '/collaborator/performance' },
    { label: 'Earnings',      icon: Wallet,          href: '/collaborator/earnings' },
    { label: 'Messages',      icon: MessageCircle,   href: '/messages' },
    { label: 'Notifications', icon: Bell,            href: '/notifications' },
  ],
  investor: [
    { label: 'Dashboard',     icon: LayoutDashboard, href: '/investor/dashboard' },
    { label: 'Social Feed',   icon: Rss,             href: '/feed' },
    { label: 'People',        icon: Users,           href: '/people' },
    { label: 'Projects',      icon: Globe,           href: '/projects' },
    { label: 'Deal Pipeline', icon: Target,          href: '/investor/pipeline' },
    { label: 'Portfolio',     icon: PieChart,        href: '/investor/portfolio' },
    { label: 'Messages',      icon: MessageCircle,   href: '/messages' },
    { label: 'Notifications', icon: Bell,            href: '/notifications' },
    { label: 'Wallet',        icon: Wallet,          href: '/wallet' },
  ],
  organisation: [
    { label: 'Dashboard',     icon: LayoutDashboard, href: '/org/dashboard' },
    { label: 'Social Feed',   icon: Rss,             href: '/feed' },
    { label: 'People',        icon: Users,           href: '/people' },
    { label: 'Projects',      icon: Globe,           href: '/projects' },
    { label: 'Challenges',    icon: Trophy,          href: '/org/challenges' },
    { label: 'Talent Search', icon: Search,          href: '/org/talent' },
    { label: 'Messages',      icon: MessageCircle,   href: '/messages' },
    { label: 'Notifications', icon: Bell,            href: '/notifications' },
    { label: 'Wallet',        icon: Wallet,          href: '/wallet' },
  ],
}

// ── Sidebar ───────────────────────────────────────────────────
function Sidebar({ onClose }: { onClose?: () => void }) {
  const { profile, signOut } = useAuth()
  const { balance } = useCredits()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)

  const role = (profile?.role ?? 'founder') as Role
  const nav = navByRole[role] ?? navByRole.founder
  const fullName = profile ? `${profile.firstName} ${profile.lastName}` : 'User'

  return (
    <aside className={cn(
      'h-screen flex flex-col bg-[color:var(--sidebar)] border-r border-[color:var(--sidebar-border)] transition-all duration-300 fixed left-0 top-0 z-40',
      collapsed ? 'w-16' : 'w-64'
    )}>
      {/* Logo */}
      <div className={cn('flex items-center gap-3 px-4 py-5 border-b border-[color:var(--sidebar-border)] flex-shrink-0', collapsed && 'justify-center px-0')}>
        <Link to={`/${role === 'founder' ? 'dashboard' : role === 'collaborator' ? 'collaborator/dashboard' : role === 'investor' ? 'investor/dashboard' : 'org/dashboard'}`}
          className="flex items-center gap-3 min-w-0" onClick={onClose}>
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-[color:var(--primary)] to-blue-400 flex items-center justify-center flex-shrink-0">
            <Zap className="h-4 w-4 text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-bold text-sm leading-none text-[color:var(--sidebar-foreground)]">TECHIT</div>
              <div className="font-mono text-[0.55rem] text-[color:var(--primary)] tracking-widest leading-none mt-0.5">NETWORK</div>
            </div>
          )}
        </Link>
        {onClose && (
          <button onClick={onClose} className="ml-auto p-1 rounded-lg hover:bg-[color:var(--sidebar-accent)] text-[color:var(--sidebar-foreground)] lg:hidden">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {nav.map(({ label, icon: Icon, href }) => (
          <NavLink key={href} to={href} onClick={onClose}
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group relative',
              isActive ? 'bg-[color:var(--primary)]/15 text-[color:var(--primary)]'
                       : 'text-[color:var(--sidebar-foreground)]/70 hover:bg-[color:var(--sidebar-accent)]/20 hover:text-[color:var(--sidebar-foreground)]',
              collapsed && 'justify-center px-0 py-3'
            )}>
            <Icon className="h-4 w-4 flex-shrink-0" />
            {!collapsed && <span className="flex-1 truncate">{label}</span>}
            {collapsed && (
              <div className="absolute left-full ml-2 px-2 py-1 bg-[color:var(--sidebar-foreground)] text-[color:var(--sidebar)] text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                {label}
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div className="border-t border-[color:var(--sidebar-border)] px-2 py-3 space-y-0.5 flex-shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="h-2 w-2 rounded-full bg-[color:var(--primary)] animate-pulse" />
            <span className="text-xs font-mono text-[color:var(--primary)] font-semibold">{balance.toLocaleString()} cr</span>
          </div>
        )}
        <NavLink to="/settings" onClick={onClose}
          className={({ isActive }) => cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
            isActive ? 'bg-[color:var(--primary)]/15 text-[color:var(--primary)]'
                     : 'text-[color:var(--sidebar-foreground)]/70 hover:bg-[color:var(--sidebar-accent)]/20',
            collapsed && 'justify-center px-0 py-3'
          )}>
          <Settings className="h-4 w-4 flex-shrink-0" />
          {!collapsed && <span>Settings</span>}
        </NavLink>

        {/* User */}
        <div className={cn('flex items-center gap-3 px-3 py-2.5 rounded-xl mt-1', collapsed && 'justify-center px-0')}>
          <Avatar name={fullName} src={profile?.avatarUrl} size="sm" />
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[color:var(--sidebar-foreground)] truncate">{profile?.firstName} {profile?.lastName}</p>
              <p className="text-[0.6rem] font-semibold uppercase text-[color:var(--primary)]">{role}</p>
            </div>
          )}
          {!collapsed && (
            <button onClick={() => signOut().then(() => navigate('/'))}
              className="p-1.5 rounded-lg hover:bg-red-500/20 text-[color:var(--sidebar-foreground)]/40 hover:text-red-500 transition-colors flex-shrink-0"
              title="Sign out">
              <LogOut className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Collapse toggle */}
      <button onClick={() => setCollapsed(c => !c)}
        className="absolute -right-3 top-20 h-6 w-6 rounded-full bg-[color:var(--sidebar)] border border-[color:var(--sidebar-border)] flex items-center justify-center text-[color:var(--sidebar-foreground)]/60 hover:text-[color:var(--sidebar-foreground)] shadow-sm transition-all">
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>
    </aside>
  )
}

// ── TopBar ────────────────────────────────────────────────────
function TopBar({ title, action }: { title?: string; action?: React.ReactNode }) {
  const { profile } = useAuth()
  const { balance } = useCredits()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [search, setSearch] = useState('')

  const fullName = profile ? `${profile.firstName} ${profile.lastName}` : 'User'

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (search.trim()) { navigate(`/feed?q=${encodeURIComponent(search.trim())}`); setSearch('') }
  }

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full z-50">
            <Sidebar onClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}
      <header className="sticky top-0 z-30 flex items-center gap-3 px-4 lg:px-6 py-3 bg-[color:var(--background)]/80 backdrop-blur-xl border-b border-[color:var(--border)] flex-shrink-0">
        <button className="lg:hidden p-2 rounded-lg hover:bg-[color:var(--muted)] transition-colors" onClick={() => setMobileOpen(o => !o)}>
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        {title ? (
          <h1 className="font-bold text-lg text-[color:var(--foreground)] truncate">{title}</h1>
        ) : (
          <form onSubmit={handleSearch} className="flex-1 flex items-center gap-2 rounded-xl bg-[color:var(--muted)]/50 border border-[color:var(--border)] px-3 py-2 max-w-md">
            <Search className="h-4 w-4 text-[color:var(--muted-foreground)] flex-shrink-0" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search projects, people, or ideas..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-[color:var(--muted-foreground)] text-[color:var(--foreground)] min-w-0" />
          </form>
        )}

        <div className="flex items-center gap-1.5 ml-auto">
          <Link to="/wallet" className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[color:var(--primary)]/10 border border-[color:var(--primary)]/20 text-[color:var(--primary)] text-xs font-mono font-medium hover:bg-[color:var(--primary)]/15 transition-colors">
            <Zap className="h-3.5 w-3.5" />{balance.toLocaleString()}
          </Link>
          <Link to="/messages" className="p-2 rounded-lg hover:bg-[color:var(--muted)] transition-colors text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]">
            <MessageCircle className="h-5 w-5" />
          </Link>
          <Link to="/notifications" className="p-2 rounded-lg hover:bg-[color:var(--muted)] transition-colors text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]">
            <Bell className="h-5 w-5" />
          </Link>
          {action}
          <Link to="/settings">
            <Avatar name={fullName} src={profile?.avatarUrl} size="sm" />
          </Link>
        </div>
      </header>
    </>
  )
}

// ── DashboardLayout ───────────────────────────────────────────
interface DashboardLayoutProps {
  children: React.ReactNode
  title?: string
  action?: React.ReactNode
  className?: string
  noPadding?: boolean
}

export default function DashboardLayout({ children, title, action, className, noPadding }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen w-full flex bg-[color:var(--background)] text-[color:var(--foreground)]">
      <div className="hidden lg:block flex-shrink-0">
        <Sidebar />
      </div>
      <div className="flex-1 flex flex-col min-h-screen lg:ml-64 transition-all duration-300">
        <TopBar title={title} action={action} />
        <main className={cn('flex-1', !noPadding && 'px-4 lg:px-6 py-5', className)}>
          {children}
        </main>
      </div>
    </div>
  )
}
