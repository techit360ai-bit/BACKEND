import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  return (
    <button
      onClick={toggleTheme}
      className="fixed bottom-5 right-5 z-50 h-10 w-10 rounded-full bg-[color:var(--card)] border border-[color:var(--border)] shadow-lg flex items-center justify-center text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] hover:bg-[color:var(--muted)] transition-all hover:scale-110"
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}
