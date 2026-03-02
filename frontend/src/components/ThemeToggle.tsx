import { Sun, Moon, Monitor, ChevronDown } from "lucide-react"
import { useState, useRef, useEffect } from "react"
import { useTheme, type Theme } from "@/contexts/ThemeContext"
import { cn } from "@/lib/utils"

const options: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "Auto", icon: Monitor },
]

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("click", handler)
    return () => document.removeEventListener("click", handler)
  }, [])

  const current = options.find((o) => o.value === theme) ?? options[2]
  const Icon = current.icon

  return (
    <div
      ref={ref}
      className={cn(
        "fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2",
        className
      )}
    >
      {open && (
        <ul
          role="listbox"
          className="min-w-28 rounded-lg border border-border bg-popover py-1 shadow-xl shadow-black/20 dark:shadow-black/40"
        >
          {options.map((opt) => {
            const OptIcon = opt.icon
            return (
              <li key={opt.value} role="option">
                <button
                  type="button"
                  onClick={() => {
                    setTheme(opt.value)
                    setOpen(false)
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
                    theme === opt.value
                      ? "bg-accent text-accent-foreground"
                      : "text-popover-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <OptIcon className="size-4" />
                  {opt.label}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex size-12 items-center justify-center rounded-full border-2 border-border bg-background text-foreground shadow-xl shadow-black/25 ring-2 ring-foreground/10 hover:bg-accent hover:text-accent-foreground transition-colors"
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
  )
}
