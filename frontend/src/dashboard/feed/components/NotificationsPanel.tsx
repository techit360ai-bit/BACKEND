import { useState } from 'react';
import { X, Flame, MessageCircle, Users, ArrowUp, Zap, CheckCheck, Bell, AtSign, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPortal } from 'react-dom';

type NotifType = 'fire' | 'comment' | 'collab' | 'gsis' | 'milestone' | 'mention' | 'answer';

interface Notification {
  id: string;
  type: NotifType;
  read: boolean;
  content: string;
  author: string;
  avatar: string;
  timeAgo: string;
  linkTo: string;
}

const mockNotifications: Notification[] = [
  {
    id: '1',
    type: 'fire',
    read: false,
    content: 'reacted 🔥 to your milestone post "Shipped MVP"',
    author: 'Kwame Mensah',
    avatar: 'from-accent-primary to-score-blue',
    timeAgo: '2m ago',
    linkTo: '/post/1',
  },
  {
    id: '2',
    type: 'comment',
    read: false,
    content: 'commented: "Congrats! The first 50 users are the hardest."',
    author: 'Chioma Eze',
    avatar: 'from-score-green to-score-amber',
    timeAgo: '15m ago',
    linkTo: '/post/1',
  },
  {
    id: '3',
    type: 'collab',
    read: false,
    content: 'expressed interest in your Collab Call — Technical Co-founder role',
    author: 'Tunde Balogun',
    avatar: 'from-score-purple to-accent-primary',
    timeAgo: '1h ago',
    linkTo: '/post/3',
  },
  {
    id: '4',
    type: 'gsis',
    read: false,
    content: 'Your GSIS score jumped to 68 (+7 pts) after your MVP milestone 🚀',
    author: 'TechIT Platform',
    avatar: 'from-accent-primary to-score-purple',
    timeAgo: '2h ago',
    linkTo: '/my-log',
  },
  {
    id: '5',
    type: 'mention',
    read: false,
    content: 'mentioned you: "@you Great insight on healthcare pricing in Africa!"',
    author: 'David Osei',
    avatar: 'from-score-amber to-score-red',
    timeAgo: '3h ago',
    linkTo: '/post/2',
  },
  {
    id: '6',
    type: 'answer',
    read: true,
    content: 'answered your question about rural market validation strategies',
    author: 'Fatima Al-Hassan',
    avatar: 'from-score-purple to-accent-primary',
    timeAgo: '1d ago',
    linkTo: '/post/6',
  },
  {
    id: '7',
    type: 'milestone',
    read: true,
    content: "You're 42% to Beta stage. Post a Build Update to accelerate your score!",
    author: 'TechIT Platform',
    avatar: 'from-score-green to-accent-primary',
    timeAgo: '1d ago',
    linkTo: '/my-log',
  },
  {
    id: '8',
    type: 'fire',
    read: true,
    content: 'and 12 others reacted 🔥 to your Insight post',
    author: 'Adaeze Okonkwo',
    avatar: 'from-score-green to-score-amber',
    timeAgo: '2d ago',
    linkTo: '/post/2',
  },
  {
    id: '9',
    type: 'collab',
    read: true,
    content: 'wants to connect with you — 92% compatibility match!',
    author: 'Yemi Adebayo',
    avatar: 'from-score-blue to-score-purple',
    timeAgo: '3d ago',
    linkTo: '/tribe',
  },
];

function NotifIcon({ type }: { type: NotifType }) {
  const map: Record<NotifType, { icon: React.ReactNode; bg: string; color: string }> = {
    fire: {
      icon: <Flame className="w-3 h-3" />,
      bg: 'rgba(239,68,68,0.2)',
      color: 'var(--score-red)',
    },
    comment: {
      icon: <MessageCircle className="w-3 h-3" />,
      bg: 'rgba(79,110,247,0.15)',
      color: 'var(--accent-primary)',
    },
    collab: {
      icon: <Users className="w-3 h-3" />,
      bg: 'rgba(168,85,247,0.15)',
      color: 'var(--score-purple)',
    },
    gsis: {
      icon: <ArrowUp className="w-3 h-3" />,
      bg: 'rgba(34,197,94,0.15)',
      color: 'var(--score-green)',
    },
    milestone: {
      icon: <Zap className="w-3 h-3" />,
      bg: 'rgba(245,158,11,0.15)',
      color: 'var(--score-amber)',
    },
    mention: {
      icon: <AtSign className="w-3 h-3" />,
      bg: 'rgba(236,72,153,0.15)',
      color: '#EC4899',
    },
    answer: {
      icon: <Star className="w-3 h-3" />,
      bg: 'rgba(34,197,94,0.15)',
      color: 'var(--score-green)',
    },
  };

  const { icon, bg, color } = map[type];

  return (
    <div
      className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
      style={{ backgroundColor: bg, color }}
    >
      {icon}
    </div>
  );
}

function NotificationItem({
  notif,
  onRead,
  onClose,
}: {
  notif: Notification;
  onRead: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <Link
      to={notif.linkTo}
      onClick={() => {
        onRead(notif.id);
        onClose();
      }}
      className="flex items-start gap-3 px-4 py-3 hover:bg-bg-elevated transition-colors border-b border-border-default/40 block"
      style={{
        backgroundColor: !notif.read ? 'rgba(79,110,247,0.04)' : undefined,
      }}
    >
      {/* Avatar + type icon */}
      <div className="relative flex-shrink-0 mt-0.5">
        <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${notif.avatar}`} />
        <div className="absolute -bottom-1 -right-1">
          <NotifIcon type={notif.type} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-text-primary leading-snug">
          <span className="font-medium">{notif.author}</span>{' '}
          <span className="text-text-secondary">{notif.content}</span>
        </p>
        <p className="text-[11px] text-text-muted mt-0.5">{notif.timeAgo}</p>
      </div>

      {/* Unread dot */}
      {!notif.read && (
        <div
          className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
          style={{ backgroundColor: 'var(--accent-primary)' }}
        />
      )}
    </Link>
  );
}

interface NotificationsPanelProps {
  open: boolean;
  onClose: () => void;
}

export function NotificationsPanel({ open, onClose }: NotificationsPanelProps) {
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const unread = notifications.filter((n) => !n.read);
  const read = notifications.filter((n) => n.read);

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[150] flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        onClick={onClose}
      />

      {/* Slide-in Panel */}
      <div
        className="absolute right-0 top-0 h-full w-full max-w-[380px] flex flex-col"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderLeft: '1px solid var(--border-default)',
          boxShadow: '-8px 0 40px rgba(0,0,0,0.4)',
          animation: 'slideInRight 200ms ease-out',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border-default)' }}
        >
          <div className="flex items-center gap-2.5">
            <Bell className="w-4 h-4 text-text-secondary" />
            <h3 className="text-sm font-semibold text-text-primary">Notifications</h3>
            {unreadCount > 0 && (
              <span
                className="text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: 'var(--accent-primary)' }}
              >
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-[11px] text-text-secondary hover:text-accent-primary transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-bg-elevated text-text-muted hover:text-text-primary transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Notifications list */}
        <div className="flex-1 overflow-y-auto">
          {unread.length > 0 && (
            <>
              <div className="px-4 pt-3 pb-1.5">
                <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
                  New · {unreadCount}
                </p>
              </div>
              {unread.map((notif) => (
                <NotificationItem
                  key={notif.id}
                  notif={notif}
                  onRead={markRead}
                  onClose={onClose}
                />
              ))}
            </>
          )}

          {read.length > 0 && (
            <>
              <div className="px-4 pt-4 pb-1.5">
                <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
                  Earlier
                </p>
              </div>
              {read.map((notif) => (
                <NotificationItem
                  key={notif.id}
                  notif={notif}
                  onRead={markRead}
                  onClose={onClose}
                />
              ))}
            </>
          )}

          {notifications.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <Bell className="w-8 h-8 text-text-muted" />
              <p className="text-sm text-text-muted">No notifications yet</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-5 py-3 flex-shrink-0 flex items-center justify-between"
          style={{ borderTop: '1px solid var(--border-default)' }}
        >
          <p className="text-[11px] text-text-muted">
            Based on your activity and posts
          </p>
          <Link
            to="/feed/notifications"
            onClick={onClose}
            className="text-[11px] font-medium transition-colors"
            style={{ color: 'var(--accent-primary)' }}
          >
            View all →
          </Link>
        </div>
      </div>
    </div>,
    document.body
  );
}