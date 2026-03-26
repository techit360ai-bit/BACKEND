import { Menu } from "lucide-react";
import { useSidebar } from "../contexts/SidebarContext";

export default function MobileMenuButton() {
  const { toggleSidebar } = useSidebar();

  return (
    <button
      onClick={toggleSidebar}
      className="flex md:hidden h-9 w-9 items-center justify-center rounded-lg bg-card border border-border text-foreground hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
      aria-label="Toggle sidebar"
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}
