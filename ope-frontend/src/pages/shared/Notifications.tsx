import { useState, useEffect } from 'react'
import { Bell, CheckCheck, Users, MessageCircle, Zap, Heart, Star, Info } from 'lucide-react'
import DashboardLayout from '../../components/shared/DashboardLayout'
import { Card, Badge, Button } from '../../components/ui'
import { useAuth } from '../../contexts/AuthContext'
import { cn, timeAgo } from '../../lib/utils'

interface AppNotification {
  id: string; user_id: string; type: string; title: string; body: string; read: boolean; created_at: string
}

const TYPE_CONFIG: Record<string, { Icon: React.ComponentType<{ className?: string }>; color: string; badge: 'violet'|'cyan'|'teal'|'rose'|'amber'|'default' }> = {
  collab_request: { Icon: Users,         color: 'bg-violet-500/10 border-violet-500/20 text-violet-400', badge: 'violet' },
  message:        { Icon: MessageCircle, color: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400',       badge: 'cyan' },
  credit:         { Icon: Zap,           color: 'bg-teal-500/10 border-teal-500/20 text-teal-400',       badge: 'teal' },
  like:           { Icon: Heart,         color: 'bg-rose-500/10 border-rose-500/20 text-rose-400',       badge: 'rose' },
  match:          { Icon: Star,          color: 'bg-amber-500/10 border-amber-500/20 text-amber-400',    badge: 'amber' },
  system:         { Icon: Info,          color: 'bg-[color:var(--muted)] border-[color:var(--border)] text-[color:var(--muted-foreground)]', badge: 'default' },
}

const FILTER_LABELS: Record<string, string> = {
  all: 'All', collab_request: 'Requests', message: 'Messages', credit: 'Credits', like: 'Likes', system: 'System',
}

const getLS = (k: string): AppNotification[] => { try { return JSON.parse(localStorage.getItem(k) || '[]') } catch { return [] } }
const setLS = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v))

// Seed mock notifications if none exist
function seedNotifications(userId: string) {
  const existing = getLS('techit_notifications').filter(n => n.user_id === userId)
  if (existing.length === 0) {
    const mocks: AppNotification[] = [
      { id: '1', user_id: userId, type: 'system',  title: 'Welcome to TechIT Network!', body: 'Your account is ready. Start by completing your profile and submitting your first idea.', read: false, created_at: new Date().toISOString() },
      { id: '2', user_id: userId, type: 'credit',  title: 'Welcome Credits Added',       body: 'You have received 250 free credits to get started on the platform.',                     read: false, created_at: new Date(Date.now() - 3600000).toISOString() },
    ]
    const all = getLS('techit_notifications')
    setLS('techit_notifications', [...mocks, ...all])
  }
}

export default function Notifications() {
  const { profile } = useAuth()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    if (profile?.id) {
      seedNotifications(profile.id)
      load()
    }
  }, [profile?.id])

  function load() {
    const all = getLS('techit_notifications').filter(n => n.user_id === profile!.id)
    all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    setNotifications(all)
  }

  const markRead = (id: string) => {
    const all = getLS('techit_notifications')
    const idx = all.findIndex(n => n.id === id)
    if (idx !== -1) { all[idx].read = true; setLS('techit_notifications', all) }
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  const markAllRead = () => {
    const all = getLS('techit_notifications').map((n: AppNotification) => n.user_id === profile!.id ? { ...n, read: true } : n)
    setLS('techit_notifications', all)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const unread = notifications.filter(n => !n.read).length
  const filtered = filter === 'all' ? notifications : notifications.filter(n => n.type === filter)

  return (
    <DashboardLayout title="Notifications">
      <div className="max-w-2xl mx-auto space-y-5 page-enter">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-[color:var(--primary)]" />
            <h2 className="font-bold">Notifications</h2>
            {unread > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-[color:var(--primary)] text-white text-xs font-bold">{unread}</span>
            )}
          </div>
          {unread > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllRead} className="gap-1.5 text-xs">
              <CheckCheck className="h-4 w-4" /> Mark all read
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {Object.entries(FILTER_LABELS).map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)}
              className={cn('px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-all flex-shrink-0',
                filter === key ? 'bg-[color:var(--primary)] text-white border-[color:var(--primary)]' : 'border-[color:var(--border)] text-[color:var(--muted-foreground)] hover:border-[color:var(--primary)]/40')}>
              {label}
            </button>
          ))}
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <Card className="p-12 text-center">
            <Bell className="h-12 w-12 text-[color:var(--muted-foreground)]/30 mx-auto mb-4" />
            <p className="font-semibold mb-1">No notifications yet</p>
            <p className="text-sm text-[color:var(--muted-foreground)]">When something happens, you will see it here.</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map(n => {
              const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.system
              const { Icon } = cfg
              return (
                <div key={n.id} onClick={() => !n.read && markRead(n.id)}
                  className={cn('flex items-start gap-4 p-4 rounded-2xl border cursor-pointer transition-all',
                    n.read ? 'bg-[color:var(--card)] border-[color:var(--border)] hover:border-[color:var(--primary)]/20'
                           : 'bg-[color:var(--primary)]/3 border-[color:var(--primary)]/15 hover:border-[color:var(--primary)]/30')}>
                  <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 border', cfg.color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="text-sm font-semibold">{n.title}</p>
                      <Badge variant={cfg.badge as any} className="text-[0.65rem]">{FILTER_LABELS[n.type] ?? n.type}</Badge>
                    </div>
                    <p className="text-xs text-[color:var(--muted-foreground)] leading-relaxed">{n.body}</p>
                    <p className="text-xs text-[color:var(--muted-foreground)] mt-1.5">{timeAgo(n.created_at)}</p>
                  </div>
                  <div className="flex-shrink-0 mt-1">
                    {n.read
                      ? <CheckCheck className="h-4 w-4 text-[color:var(--muted-foreground)]/30" />
                      : <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--primary)] block" />
                    }
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
