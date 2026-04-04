import { Menu, X } from "lucide-react";

interface MobileNavBarProps {
  title: string;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onCloseSidebar: () => void;
}

const MobileNavBar = ({
  title,
  isSidebarOpen,
  onToggleSidebar,
  onCloseSidebar,
}: MobileNavBarProps) => {
  return (
    <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between">
      <h1 className="font-semibold text-foreground text-sm truncate flex-1">
        {title}
      </h1>
      <div className="flex items-center gap-2">
        {isSidebarOpen && (
          <button
            onClick={onCloseSidebar}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5 text-foreground" />
          </button>
        )}
        <button
          onClick={onToggleSidebar}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          aria-label="Toggle sidebar"
        >
          <Menu className="h-5 w-5 text-foreground" />
        </button>
      </div>
    </div>
  );
};

export default MobileNavBar;
