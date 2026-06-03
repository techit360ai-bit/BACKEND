import { Sun, Moon, Monitor, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

const options: { value: Theme; label: string; icon: React.ElementType }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "Auto", icon: Monitor },
];

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  const current = options.find((o) => o.value === theme) ?? options[2];
  const Icon = current.icon;

  return (
    <div
      ref={ref}
      className={cn(
        "fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2",
        className,
      )}
    >
      {open && (
        <ul
          role="listbox"
          className="min-w-32 rounded-2xl border border-[color:var(--border)] bg-[color:var(--popover)] py-1.5 shadow-2xl shadow-violet-500/20 dark:shadow-violet-700/30 backdrop-blur-sm overflow-hidden"
        >
          {options.map((opt) => {
            const OptIcon = opt.icon;
            const isActive = theme === opt.value;
            return (
              <li key={opt.value} role="option">
                <button
                  type="button"
                  onClick={() => {
                    setTheme(opt.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium transition-all duration-150",
                    isActive
                      ? "bg-violet-500/15 text-violet-600 dark:text-violet-400"
                      : "text-[color:var(--popover-foreground)] hover:bg-[color:var(--accent)] hover:text-[color:var(--accent-foreground)]",
                  )}
                >
                  <OptIcon className="size-4 shrink-0" />
                  {opt.label}
                  {isActive && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-violet-500 dark:bg-violet-400" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "group flex size-12 items-center justify-center rounded-2xl",
          "bg-gradient-to-br from-violet-500 to-indigo-600",
          "shadow-xl shadow-violet-500/40 dark:shadow-violet-700/50",
          "ring-2 ring-violet-500/20 dark:ring-violet-600/20",
          "hover:shadow-violet-500/60 hover:ring-violet-500/40",
          "hover:from-violet-400 hover:to-indigo-500",
          "active:scale-95 transition-all duration-200",
          open && "ring-violet-500/50 scale-95",
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Switch theme"
      >
        <span className="flex flex-col items-center gap-0.5 text-white">
          <Icon className="size-5 drop-shadow" />
          <ChevronDown
            className={cn(
              "size-3 opacity-70 transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        </span>
      </button>
    </div>
  );
}
