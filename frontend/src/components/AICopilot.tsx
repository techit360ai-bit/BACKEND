import { useState } from "react";
import { X } from "lucide-react";

interface Suggestion {
  id: string;
  text: string;
  priority: "critical" | "medium" | "low";
}

interface AICopilotProps {
  suggestions?: Suggestion[];
  onSuggestionClick?: (suggestion: Suggestion) => void;
  onClose?: () => void;
  initialOpen?: boolean;
  hideButton?: boolean;
}

const defaultSuggestions: Suggestion[] = [
  {
    id: "1",
    text: "Focus on HealthTrack deadline",
    priority: "critical",
  },
  {
    id: "2",
    text: "Review design system PR",
    priority: "medium",
  },
  {
    id: "3",
    text: "Respond to 2 pending messages",
    priority: "low",
  },
  {
    id: "4",
    text: "Optimize My Workload",
    priority: "medium",
  },
];

const AICopilot = ({
  suggestions = defaultSuggestions,
  onSuggestionClick,
  onClose,
  initialOpen = false,
  hideButton = false,
}: AICopilotProps) => {
  const [isOpen, setIsOpen] = useState(initialOpen);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical":
        return "bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800";
      case "medium":
        return "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800";
      case "low":
        return "bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      default:
        return "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300";
    }
  };

  return (
    <>
      {/* AI Copilot Toggle Button */}
      {!hideButton && (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-linear-to-br from-violet-500 to-violet-600 text-white shadow-lg shadow-violet-500/30 dark:shadow-violet-600/30 hover:from-violet-600 hover:to-violet-700 transition-all duration-300"
          title="AI Copilot Suggestions"
        >
          <svg
            className="h-5 w-5"
            fill="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
          </svg>
        </button>
      )}

      {/* AI Copilot Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40"
            onClick={() => {
              setIsOpen(false);
              onClose?.();
            }}
          />

          {/* Panel */}
          <div className="fixed right-6 top-20 w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl shadow-2xl dark:shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-linear-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500 animate-pulse">
                  <div className="h-3 w-3 rounded-full bg-green-400"></div>
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  AI Copilot
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsOpen(false);
                  onClose?.();
                }}
                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-slate-500 dark:text-slate-400" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4 max-h-96 overflow-y-auto">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3">
                  Smart suggestions for right now:
                </p>
              </div>

              <div className="space-y-2.5">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion.id}
                    onClick={() => {
                      onSuggestionClick?.(suggestion);
                      setIsOpen(false);
                      onClose?.();
                    }}
                    className="w-full flex items-center justify-between p-3.5 rounded-xl border bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left group"
                  >
                    <span className="text-sm text-slate-900 dark:text-slate-100 group-hover:text-slate-700 dark:group-hover:text-white">
                      {suggestion.text}
                    </span>
                    <span
                      className={`text-[0.65rem] font-semibold uppercase px-2 py-1 rounded-md border whitespace-nowrap ml-2 ${getPriorityColor(
                        suggestion.priority,
                      )}`}
                    >
                      {suggestion.priority}
                    </span>
                  </button>
                ))}
              </div>

              {/* Action Button */}
              <button className="w-full mt-4 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm">
                Optimize My Workload
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default AICopilot;
