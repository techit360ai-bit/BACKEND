import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  Flame,
  MessageCircle,
  Users,
  ArrowUp,
  Zap,
  CheckCheck,
  AtSign,
  Star,
  Settings,
} from 'lucide-react';

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

const allNotifications: Notification[] = [
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
  {
    id: '10',
    type: 'comment',
    read: true,
    content: 'replied to your comment on the Problem Signal discussion',
    author: 'Ngozi Obi',
    avatar: 'from-score-red to-score-amber',
    timeAgo: '3d ago',
    linkTo: '/post/5',
  },
];

const typeConfig: Record<NotifType, { icon: React.ReactNode; bg: string; color: string; label: string }> = {
  fire: {
    icon: <Flame className="w-3.5 h-3.5" />,
    bg: 'rgba(239,68,68,0.15)',
    color: 'var(--score-red)',
    label: 'Reactions',
  },
  comment: {
    icon: <MessageCircle className="w-3.5 h-3.5" />,
    bg: 'rgba(79,110,247,0.15)',
    color: 'var(--accent-primary)',
    label: 'Comments',
  },
  collab: {
    icon: <Users className="w-3.5 h-3.5" />,
    bg: 'rgba(168,85,247,0.15)',
    color: 'var(--score-purple)',
    label: 'Collab',
  },
  gsis: {
    icon: <ArrowUp className="w-3.5 h-3.5" />,
    bg: 'rgba(34,197,94,0.15)',
    color: 'var(--score-green)',
    label: 'GSIS',
  },
  milestone: {
    icon: <Zap className="w-3.5 h-3.5" />,
    bg: 'rgba(245,158,11,0.15)',
    color: 'var(--score-amber)',
    label: 'Milestones',
  },
  mention: {
    icon: <AtSign className="w-3.5 h-3.5" />,
    bg: 'rgba(236,72,153,0.15)',
    color: '#EC4899',
    label: 'Mentions',
  },
  answer: {
    icon: <Star className="w-3.5 h-3.5" />,
    bg: 'rgba(34,197,94,0.15)',
    color: 'var(--score-green)',
    label: 'Answers',
  },
};

type FilterTab = 'all' | NotifType;

export function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>(allNotifications);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const filterTabs: { id: FilterTab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'comment', label: 'Comments' },
    { id: 'fire', label: 'Reactions' },
    { id: 'collab', label: 'Collab' },
    { id: 'mention', label: 'Mentions' },
    { id: 'gsis', label: 'GSIS' },
  ];

  const filtered =
    activeFilter === 'all'
      ? notifications
      : notifications.filter((n) => n.type === activeFilter);

  const unread = filtered.filter((n) => !n.read);
  const read = filtered.filter((n) => n.read);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-20 lg:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-text-primary mb-1 flex items-center gap-2">
            <Bell className="w-5 h-5 text-accent-primary" />
            Notifications
            {unreadCount > 0 && (
              <span
                className="text-white text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: 'var(--accent-primary)' }}
              >
                {unreadCount} new
              </span>
            )}
          </h1>
          <p className="text-xs text-text-muted">Stay on top of your activity and progress</p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-accent-primary transition-colors px-3 py-1.5 rounded-lg border border-border-default hover:border-accent-primary"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark all read
            </button>
          )}
          <button className="p-1.5 rounded-lg border border-border-default text-text-muted hover:text-text-primary hover:border-border-active transition-all">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1 scrollbar-none">
        {filterTabs.map((tab) => {
          const count =
            tab.id === 'all'
              ? notifications.filter((n) => !n.read).length
              : notifications.filter((n) => n.type === tab.id && !n.read).length;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-all border"
              style={{
                backgroundColor:
                  activeFilter === tab.id ? 'rgba(79,110,247,0.15)' : 'var(--bg-elevated)',
                borderColor:
                  activeFilter === tab.id ? 'var(--accent-primary)' : 'var(--border-default)',
                color:
                  activeFilter === tab.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
              }}
            >
              {tab.label}
              {count > 0 && (
                <span
                  className="text-white text-[9px] font-bold px-1 py-0.5 rounded-full min-w-[14px] text-center"
                  style={{ backgroundColor: 'var(--accent-primary)' }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Notifications */}
      <div className="bg-bg-surface border border-border-default rounded-xl overflow-hidden">
        {unread.length > 0 && (
          <>
            <div className="px-4 pt-3 pb-1.5 border-b border-border-default/30">
              <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
                New · {unread.length}
              </p>
            </div>
            {unread.map((notif, idx) => (
              <NotificationRow
                key={notif.id}
                notif={notif}
                onRead={markRead}
                isLast={idx === unread.length - 1 && read.length === 0}
              />
            ))}
          </>
        )}

        {read.length > 0 && (
          <>
            <div className="px-4 pt-3 pb-1.5 border-b border-border-default/30">
              <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
                Earlier
              </p>
            </div>
            {read.map((notif, idx) => (
              <NotificationRow
                key={notif.id}
                notif={notif}
                onRead={markRead}
                isLast={idx === read.length - 1}
              />
            ))}
          </>
        )}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'var(--bg-elevated)' }}
            >
              <Bell className="w-6 h-6 text-text-muted" />
            </div>
            <p className="text-sm text-text-secondary">No notifications in this category</p>
            <p className="text-xs text-text-muted">Activity will appear here as it happens</p>
          </div>
        )}
      </div>
    </div>
  );
}

function NotificationRow({
  notif,
  onRead,
  isLast,
}: {
  notif: Notification;
  onRead: (id: string) => void;
  isLast: boolean;
}) {
  const config = typeConfig[notif.type];

  return (
    <Link
      to={notif.linkTo}
      onClick={() => onRead(notif.id)}
      className="flex items-start gap-3 px-4 py-4 hover:bg-bg-elevated transition-colors block"
      style={{
        borderBottom: isLast ? 'none' : '1px solid var(--border-default)',
        backgroundColor: !notif.read ? 'rgba(79,110,247,0.03)' : undefined,
      }}
    >
      {/* Avatar + type badge */}
      <div className="relative flex-shrink-0 mt-0.5">
        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${notif.avatar}`} />
        <div
          className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border-2"
          style={{
            backgroundColor: config.bg,
            color: config.color,
            borderColor: 'var(--bg-surface)',
          }}
        >
          {config.icon}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-text-primary leading-snug">
          <span className="font-medium">{notif.author}</span>{' '}
          <span className="text-text-secondary">{notif.content}</span>
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-[11px] text-text-muted">{notif.timeAgo}</p>
          <span className="text-text-muted text-[10px]">·</span>
          <span
            className="text-[10px] font-medium uppercase tracking-wide"
            style={{ color: config.color }}
          >
            {config.label}
          </span>
        </div>
      </div>

      {/* Unread indicator */}
      {!notif.read && (
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-2"
          style={{ backgroundColor: 'var(--accent-primary)' }}
        />
      )}
    </Link>
  );
}
