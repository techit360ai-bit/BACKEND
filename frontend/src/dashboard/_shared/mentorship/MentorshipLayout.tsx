import { Outlet, Link, useLocation } from "react-router-dom";
import {
  Home,
  FileText,
  BarChart3,
  CreditCard,
  Network,
  Plus,
  ArrowLeft,
  GraduationCap,
} from "lucide-react";
import { ACCENT_SOLID, ACCENT_TEXT, ACCENT_SOFT } from "./theme";

const BASE = "/investor/mentorship";

const navItems = [
  { path: BASE, icon: Home, label: "Overview", end: true },
  { path: `${BASE}/applications`, icon: FileText, label: "Applications" },
  { path: `${BASE}/analytics`, icon: BarChart3, label: "Analytics" },
  { path: `${BASE}/payments`, icon: CreditCard, label: "Payments" },
  { path: `${BASE}/hub`, icon: Network, label: "Advanced Hub" },
];

/**
 * Focused layout for the Mentorship Hub — its own header + sub-nav, separate
 * from the investor sidebar (the user gets a dedicated, prototype-style space).
 * Surfaces use semantic tokens so the whole hub flips with the global theme.
 */
export function MentorshipLayout() {
  const location = useLocation();

  const isActive = (path: string, end?: boolean) =>
    end ? location.pathname === path : location.pathname.startsWith(path);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${ACCENT_SOFT}`}>
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="text-xl font-semibold">
              TECH<span className={ACCENT_TEXT}>IT</span> Mentorship
            </span>
          </div>
          <Link to={`${BASE}/create-room`}>
            <button
              className={`flex items-center gap-2 rounded-lg px-4 py-2 transition-colors ${ACCENT_SOLID}`}
            >
              <Plus className="h-4 w-4" />
              Create Room
            </button>
          </Link>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl">
        {/* Sidebar */}
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 border-r border-border bg-card md:block">
          <nav className="space-y-1 p-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path, item.end);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 rounded-lg px-4 py-3 transition-colors ${
                    active
                      ? `${ACCENT_SOFT} font-medium`
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-border p-4">
            <Link
              to="/investor"
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Investor
            </Link>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
