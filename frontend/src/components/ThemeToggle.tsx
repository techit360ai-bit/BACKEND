import { Sun, Moon, Monitor, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

const options: { value: Theme; label: string; icon: typeof Sun }[] = [
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
          className="min-w-28 rounded-lg border border-border bg-popover py-1 shadow-xl shadow-violet-500/20 dark:shadow-violet-600/20"
        >
          {options.map((opt) => {
            const OptIcon = opt.icon;
            return (
              <li key={opt.value} role="option">
                <button
                  type="button"
                  onClick={() => {
                    setTheme(opt.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
                    theme === opt.value
                      ? "bg-accent text-accent-foreground"
                      : "text-popover-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <OptIcon className="size-4" />
                  {opt.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex size-12 items-center justify-center rounded-full border-2 border-violet-500/50 dark:border-violet-600/50 bg-linear-to-br from-violet-50 to-cyan-50 dark:from-violet-950 dark:to-cyan-950 text-violet-600 dark:text-violet-400 shadow-xl shadow-violet-500/25 dark:shadow-violet-600/25 ring-2 ring-violet-500/10 hover:bg-linear-to-br hover:from-violet-100 hover:to-cyan-100 dark:hover:from-violet-900 dark:hover:to-cyan-900 hover:border-violet-500 dark:hover:border-violet-500 transition-all"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Theme"
      >
        <span className="flex flex-col items-center gap-0.5">
          <Icon className="size-5" />
          <ChevronDown className="size-3 opacity-70" />
        </span>
      </button>
    </div>
  );
}
