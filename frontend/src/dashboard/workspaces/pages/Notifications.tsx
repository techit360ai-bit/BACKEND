import { useState } from 'react';
import { Bell, Check, Trash2, Filter, Video, MessageSquare, GitPullRequest, Users, Code, AlertCircle } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

type NotificationType = 'message' | 'mention' | 'pr' | 'build' | 'meeting' | 'system';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  avatar?: string;
  action?: string;
}

export function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      type: 'pr',
      title: 'Sarah Chen reviewed your PR',
      message: 'API Integration: Authentication Flow - Approved with minor comments',
      timestamp: '5 minutes ago',
      read: false,
      avatar: 'SC',
    },
    {
      id: '2',
      type: 'mention',
      title: 'Mike Johnson mentioned you',
      message: '@you Can you review the new dashboard design?',
      timestamp: '12 minutes ago',
      read: false,
      avatar: 'MJ',
    },
    {
      id: '3',
      type: 'meeting',
      title: 'Upcoming Meeting',
      message: 'Sprint Planning - starts in 30 minutes',
      timestamp: '30 minutes',
      read: false,
    },
    {
      id: '4',
      type: 'build',
      title: 'Build completed successfully',
      message: 'Production deployment #247 completed in 4m 32s',
      timestamp: '1 hour ago',
      read: true,
    },
    {
      id: '5',
      type: 'message',
      title: 'New message from Alex Kim',
      message: 'Hey, I uploaded the latest designs to the Files section',
      timestamp: '2 hours ago',
      read: true,
      avatar: 'AK',
    },
    {
      id: '6',
      type: 'system',
      title: 'System Update',
      message: 'New AI Agent "Claude Code" is now available in your workspace',
      timestamp: '3 hours ago',
      read: true,
    },
  ]);

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'message':
        return <MessageSquare className="w-5 h-5" />;
      case 'mention':
        return <Users className="w-5 h-5" />;
      case 'pr':
        return <GitPullRequest className="w-5 h-5" />;
      case 'build':
        return <Code className="w-5 h-5" />;
      case 'meeting':
        return <Video className="w-5 h-5" />;
      case 'system':
        return <AlertCircle className="w-5 h-5" />;
    }
  };

  const getIconColor = (type: NotificationType) => {
    switch (type) {
      case 'message':
        return 'bg-blue-500/10 text-blue-500';
      case 'mention':
        return 'bg-purple-500/10 text-purple-500';
      case 'pr':
        return 'bg-green-500/10 text-green-500';
      case 'build':
        return 'bg-orange-500/10 text-orange-500';
      case 'meeting':
        return 'bg-pink-500/10 text-pink-500';
      case 'system':
        return 'bg-muted-foreground/20/10 text-muted-foreground';
    }
  };

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="bg-background border-b border-border px-8 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#2196F3]/10 rounded-lg">
              <Bell className="w-6 h-6 text-[#2196F3]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                Notifications
              </h1>
              <p className="text-sm text-muted-foreground">
                {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={markAllAsRead}>
              <Check className="w-4 h-4 mr-2" />
              Mark all as read
            </Button>
            <Button variant="outline" size="sm">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="flex-1 overflow-auto px-8 py-6">
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread">Unread ({unreadCount})</TabsTrigger>
            <TabsTrigger value="mentions">Mentions</TabsTrigger>
            <TabsTrigger value="prs">Pull Requests</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-3">
            {notifications.map(notification => (
              <div
                key={notification.id}
                className={`bg-background border rounded-lg p-4 transition-all hover:shadow-md ${
                  !notification.read ? 'border-[#2196F3] bg-[#2196F3]/5' : 'border-border'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-lg ${getIconColor(notification.type)}`}>
                    {getIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <h3 className="font-semibold text-sm mb-1">{notification.title}</h3>
                        <p className="text-sm text-muted-foreground mb-2">{notification.message}</p>
                        <span className="text-xs text-muted-foreground/70">{notification.timestamp}</span>
                      </div>
                      {!notification.read && (
                        <Badge className="bg-[#2196F3] text-white shrink-0">New</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {!notification.read && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => markAsRead(notification.id)}
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteNotification(notification.id)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="unread" className="space-y-3">
            {notifications
              .filter(n => !n.read)
              .map(notification => (
                <div
                  key={notification.id}
                  className="bg-background border border-[#2196F3] bg-[#2196F3]/5 rounded-lg p-4"
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg ${getIconColor(notification.type)}`}>
                      {getIcon(notification.type)}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-sm mb-1">{notification.title}</h3>
                      <p className="text-sm text-muted-foreground mb-2">{notification.message}</p>
                      <span className="text-xs text-muted-foreground/70">{notification.timestamp}</span>
                    </div>
                  </div>
                </div>
              ))}
          </TabsContent>

          <TabsContent value="mentions">
            {notifications
              .filter(n => n.type === 'mention')
              .map(notification => (
                <div key={notification.id} className="bg-background border rounded-lg p-4 mb-3">
                  <h3 className="font-semibold text-sm mb-1">{notification.title}</h3>
                  <p className="text-sm text-muted-foreground">{notification.message}</p>
                </div>
              ))}
          </TabsContent>

          <TabsContent value="prs">
            {notifications
              .filter(n => n.type === 'pr')
              .map(notification => (
                <div key={notification.id} className="bg-background border rounded-lg p-4 mb-3">
                  <h3 className="font-semibold text-sm mb-1">{notification.title}</h3>
                  <p className="text-sm text-muted-foreground">{notification.message}</p>
                </div>
              ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
