import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  const w = Math.floor(d / 7)
  if (w < 5) return `${w}w ago`
  const mo = Math.floor(d / 30)
  if (mo < 12) return `${mo}mo ago`
  return `${Math.floor(d / 365)}y ago`
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export function initials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0] || '')
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function avatarGradient(name: string): string {
  const gradients = [
    'from-violet-500 to-purple-600',
    'from-cyan-500 to-blue-600',
    'from-teal-500 to-emerald-600',
    'from-rose-500 to-pink-600',
    'from-amber-500 to-orange-600',
    'from-indigo-500 to-violet-600',
    'from-blue-500 to-cyan-600',
    'from-green-500 to-teal-600',
  ]
  const idx = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % gradients.length
  return gradients[idx]
}

export function roleColor(role: string): { bg: string; text: string; border: string } {
  const map: Record<string, { bg: string; text: string; border: string }> = {
    founder:      { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/30' },
    collaborator: { bg: 'bg-cyan-500/10',   text: 'text-cyan-400',   border: 'border-cyan-500/30' },
    investor:     { bg: 'bg-teal-500/10',   text: 'text-teal-400',   border: 'border-teal-500/30' },
    organisation: { bg: 'bg-rose-500/10',   text: 'text-rose-400',   border: 'border-rose-500/30' },
  }
  return map[role] || map.founder
}

export function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len) + '…' : str
}
