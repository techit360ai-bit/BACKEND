interface ChatTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const ChatTabs = ({ activeTab, onTabChange }: ChatTabsProps) => {
  const tabs = [
    "Global Pulse",
    "Your Tribe",
    "Build Logs",
    "Questions",
    "Problems",
  ];

  return (
    <div className="flex gap-6 border-b border-slate-800 mb-6 overflow-x-auto">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onTabChange(tab)}
          className={`pb-3 px-2 text-sm font-medium whitespace-nowrap transition-colors ${
            activeTab === tab
              ? "text-white border-b-2 border-cyan-400"
              : "text-slate-400 hover:text-slate-300"
          }`}
        >
          {tab}
        </button>
      ))}
    </div>
  );
};

export default ChatTabs;
