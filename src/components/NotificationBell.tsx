'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { useSession } from '@/lib/auth-client';
import {
  getPusherClient,
  getUserChannelName,
  PUSHER_EVENTS,
  type NotificationEvent,
} from '@/lib/pusher-client';

interface Notification {
  id: string;
  chatId: string;
  chatTitle: string;
  action: 'approve' | 'block' | 'admin_response' | 'warning';
  message: string;
  timestamp: string;
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();

  // tRPC queries
  const { data: notificationCount, refetch: refetchCount } =
    trpc.chat.getNotificationCount.useQuery(undefined, {
      enabled: !!session,
      refetchInterval: 30000, // Refetch every 30 seconds as fallback
    });

  const { data: notificationsData, refetch: refetchNotifications } =
    trpc.chat.getNotifications.useQuery(undefined, {
      enabled: !!session && isOpen,
    });

  const markNotificationRead = trpc.chat.markNotificationRead.useMutation({
    onSuccess: () => {
      refetchCount();
      refetchNotifications();
    },
  });

  const markAllRead = trpc.chat.markAllNotificationsRead.useMutation({
    onSuccess: () => {
      refetchCount();
      refetchNotifications();
    },
  });

  // Sync notifications from query data without using useEffect with setState
  const displayNotifications = notificationsData ?? notifications;

  // Subscribe to real-time notifications via Pusher
  useEffect(() => {
    if (!session?.user?.id) return;

    const pusher = getPusherClient();
    const channelName = getUserChannelName(session.user.id);
    const channel = pusher.subscribe(channelName);

    channel.bind(PUSHER_EVENTS.NOTIFICATION, (data: NotificationEvent) => {
      // For warnings, always show notification
      // For chat notifications, check if user is currently on that chat page
      const isOnChatPage = data.chatId && pathname === `/chat/${data.chatId}`;

      if (!isOnChatPage) {
        // Add to local notifications
        setNotifications(prev => [data, ...prev.slice(0, 19)]);
        // Refetch count
        refetchCount();
      }
    });

    return () => {
      channel.unbind(PUSHER_EVENTS.NOTIFICATION);
      pusher.unsubscribe(channelName);
    };
  }, [session?.user?.id, pathname, refetchCount]);

  // Handle click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = async (notification: Notification) => {
    // For warning notifications with no chatId, just mark as read
    if (notification.action === 'warning' && !notification.chatId) {
      // Remove from local notifications
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
      setIsOpen(false);
      return;
    }
    
    // Mark as read (only for message-based notifications)
    if (!notification.id.startsWith('warning-')) {
      await markNotificationRead.mutateAsync({ messageId: notification.id });
    } else {
      // For warnings, just remove from local state
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    }
    
    // Navigate to chat if there's a chatId
    if (notification.chatId) {
      router.push(`/chat/${notification.chatId}`);
    }
    setIsOpen(false);
  };

  const handleMarkAllRead = async () => {
    await markAllRead.mutateAsync();
  };

  const getActionIcon = (action: Notification['action']) => {
    switch (action) {
      case 'approve':
        return (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
        );
      case 'block':
        return (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-600">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </svg>
          </span>
        );
      case 'admin_response':
        return (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </span>
        );
      case 'warning':
        return (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </span>
        );
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const count = notificationCount?.count ?? 0;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-all duration-300 hover:text-foreground hover:bg-muted cursor-pointer"
        aria-label="Notifications"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 origin-top-right rounded-xl border border-border bg-popover shadow-lg animate-in fade-in zoom-in-95 duration-200 z-50">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">
              Notifications
            </h3>
            {count > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-primary hover:underline cursor-pointer"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-100 overflow-y-auto">
            {displayNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mb-2 opacity-50"
                >
                  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                  <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                </svg>
                <p className="text-sm">No new notifications</p>
              </div>
            ) : (
              displayNotifications.map(notification => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors cursor-pointer border-b border-border/50 last:border-0"
                >
                  {getActionIcon(notification.action)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {notification.chatTitle}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      {formatTimestamp(notification.timestamp)}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
