import { cn } from '../../lib/utils'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

// ── Button ────────────────────────────────────────────────────
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive'
  size?: 'sm' | 'default' | 'lg' | 'icon' | 'icon-sm'
  loading?: boolean
}

export function Button({
  className, variant = 'default', size = 'default',
  loading, disabled, children, ...props
}: ButtonProps) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)] focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]'
  const variants = {
    default:     'bg-[color:var(--primary)] text-white hover:opacity-90 shadow-sm',
    outline:     'border border-[color:var(--border)] bg-transparent hover:bg-[color:var(--muted)] text-[color:var(--foreground)]',
    ghost:       'bg-transparent hover:bg-[color:var(--muted)] text-[color:var(--foreground)]',
    destructive: 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20',
  }
  const sizes = {
    sm:     'h-8 px-3 text-sm',
    default:'h-9 px-4 text-sm',
    lg:     'h-11 px-6 text-base',
    icon:   'h-9 w-9',
    'icon-sm': 'h-8 w-8',
  }
  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
        </svg>
      )}
      {children}
    </button>
  )
}

// ── Card ──────────────────────────────────────────────────────
export function Card({ className, children, ...props }: { className?: string; children: ReactNode; onClick?: () => void }) {
  return (
    <div
      className={cn('rounded-xl bg-[color:var(--card)] border border-[color:var(--border)] text-[color:var(--card-foreground)]', className)}
      {...props}
    >
      {children}
    </div>
  )
}

// ── Badge ─────────────────────────────────────────────────────
interface BadgeProps { children: ReactNode; variant?: 'default' | 'outline' | 'violet' | 'cyan' | 'teal' | 'rose' | 'amber' | 'emerald'; className?: string }
export function Badge({ children, variant = 'default', className }: BadgeProps) {
  const variants = {
    default: 'bg-[color:var(--primary)]/10 text-[color:var(--primary)] border-[color:var(--primary)]/20',
    outline: 'border-[color:var(--border)] text-[color:var(--muted-foreground)] bg-transparent',
    violet:  'bg-violet-500/10 text-violet-400 border-violet-500/20',
    cyan:    'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    teal:    'bg-teal-500/10 text-teal-400 border-teal-500/20',
    rose:    'bg-rose-500/10 text-rose-400 border-rose-500/20',
    amber:   'bg-amber-500/10 text-amber-400 border-amber-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  }
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border', variants[variant], className)}>
      {children}
    </span>
  )
}

// ── Input ─────────────────────────────────────────────────────
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}
export function Input({ label, error, hint, className, ...props }: InputProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">
          {label}
        </label>
      )}
      <input
        className={cn(
          'w-full h-10 rounded-xl border border-[color:var(--border)] bg-[color:var(--input)] px-3 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)] transition-all',
          error && 'border-red-500 focus:ring-red-500/30',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      {hint && !error && <p className="text-xs text-[color:var(--muted-foreground)]">{hint}</p>}
    </div>
  )
}

// ── Avatar ────────────────────────────────────────────────────
import { initials, avatarGradient } from '../../lib/utils'

interface AvatarProps {
  name?: string
  src?: string | null
  size?: 'sm' | 'default' | 'lg' | 'xl'
  className?: string
}
export function Avatar({ name = 'U', src, size = 'default', className }: AvatarProps) {
  const sizes = { sm: 'h-8 w-8 text-xs', default: 'h-10 w-10 text-sm', lg: 'h-12 w-12 text-base', xl: 'h-16 w-16 text-xl' }
  const grad = avatarGradient(name)
  return (
    <div className={cn('rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center bg-gradient-to-br text-white font-bold', sizes[size], `${grad}`, className)}>
      {src
        ? <img src={src} alt={name} className="h-full w-full object-cover" />
        : initials(name)
      }
    </div>
  )
}

// ── Progress ──────────────────────────────────────────────────
export function Progress({ value, label, color = 'bg-[color:var(--primary)]', className }: { value: number; label?: string; color?: string; className?: string }) {
  return (
    <div className={cn('space-y-1', className)}>
      {label && (
        <div className="flex justify-between text-xs text-[color:var(--muted-foreground)]">
          <span>{label}</span><span className="font-mono font-semibold text-[color:var(--foreground)]">{Math.round(value)}%</span>
        </div>
      )}
      <div className="h-1.5 w-full rounded-full bg-[color:var(--muted)] overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-700', color)} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  )
}

// ── StatCard ──────────────────────────────────────────────────
interface StatCardProps {
  label: string; value: string; icon: ReactNode
  color?: 'violet' | 'cyan' | 'teal' | 'rose' | 'amber'
  helper?: string
}
export function StatCard({ label, value, icon, color = 'violet', helper }: StatCardProps) {
  const colors = {
    violet: 'bg-violet-500/10 border-violet-500/20 text-violet-400',
    cyan:   'bg-cyan-500/10 border-cyan-500/20 text-cyan-400',
    teal:   'bg-teal-500/10 border-teal-500/20 text-teal-400',
    rose:   'bg-rose-500/10 border-rose-500/20 text-rose-400',
    amber:  'bg-amber-500/10 border-amber-500/20 text-amber-400',
  }
  return (
    <Card className="p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[color:var(--muted-foreground)] font-medium">{label}</span>
        <div className={cn('h-8 w-8 rounded-lg border flex items-center justify-center', colors[color])}>{icon}</div>
      </div>
      <div>
        <p className="font-bold text-2xl text-[color:var(--foreground)] leading-none">{value}</p>
        {helper && <p className="text-xs text-[color:var(--muted-foreground)] mt-1">{helper}</p>}
      </div>
    </Card>
  )
}
