import { useState } from "react";
import { LayoutGrid, TrendingUp, Users, Settings, Menu, X } from "lucide-react";

interface Tab {
  id: string;
  label: string;
  icon: React.ReactNode;
}

interface InvestorMobileTabsProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export function InvestorMobileTabs({
  activeTab,
  onTabChange,
}: InvestorMobileTabsProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const tabs: Tab[] = [
    {
      id: "overview",
      label: "Overview",
      icon: <LayoutGrid className="w-5 h-5" />,
    },
    {
      id: "deals",
      label: "Deal Flow",
      icon: <TrendingUp className="w-5 h-5" />,
    },
    {
      id: "portfolio",
      label: "Portfolio",
      icon: <Users className="w-5 h-5" />,
    },
    {
      id: "settings",
      label: "Settings",
      icon: <Settings className="w-5 h-5" />,
    },
  ];

  const handleTabClick = (tabId: string) => {
    onTabChange(tabId);
    setIsMenuOpen(false);
  };

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t-2 border-border z-40">
      {/* Mobile Menu Button */}
      <div className="flex items-center justify-between px-4 py-3">
        <h3 className="text-foreground font-medium">Navigation</h3>
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="p-2 hover:bg-muted rounded-lg transition-all"
        >
          {isMenuOpen ? (
            <X className="w-5 h-5 text-foreground" />
          ) : (
            <Menu className="w-5 h-5 text-foreground" />
          )}
        </button>
      </div>

      {/* Expanded Menu */}
      {isMenuOpen && (
        <div className="border-t-2 border-border bg-card">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-4 border-b border-border last:border-b-0 transition-all ${
                activeTab === tab.id
                  ? "bg-teal-500/10 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400"
                  : "text-foreground hover:bg-muted"
              }`}
            >
              {tab.icon}
              <span className="font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Collapsed Tab Bar */}
      {!isMenuOpen && (
        <div className="flex justify-around py-2 border-t-2 border-border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`flex flex-col items-center gap-1 px-3 py-2 transition-all rounded-lg ${
                activeTab === tab.id
                  ? "text-teal-600 dark:text-teal-400"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title={tab.label}
            >
              {tab.icon}
              <span className="text-xs hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
