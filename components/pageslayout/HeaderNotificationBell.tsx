'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { NotificationBellDropdown } from '@/components/admin/NotificationBellDropdown';
import { useAuth } from '@/contexts/AuthContext';
import { useChat } from '@/contexts/ChatContext';

const NEW_SIGNUPS_POLL_MS = 60 * 1000;

/**
 * The header notification bell used on the business list.
 * Admins see platform activity; everyone else sees unread ProBot messages.
 */
export function HeaderNotificationBell() {
  const locale = useLocale();
  const { isAdmin, isAuthenticated } = useAuth();
  const { chatUnreadCount } = useChat();
  const [notificationCount, setNotificationCount] = useState(0);

  const fetchNewSignupsCount = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch('/api/admin/notifications/new-signups-count', {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!res.ok) return;
      const data = await res.json();
      if (typeof data.count === 'number') setNotificationCount(data.count);
    } catch {
      // ignore
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    fetchNewSignupsCount();
    const interval = setInterval(fetchNewSignupsCount, NEW_SIGNUPS_POLL_MS);
    return () => clearInterval(interval);
  }, [isAdmin, fetchNewSignupsCount]);

  if (!isAuthenticated) return null;

  if (isAdmin) {
    return (
      <NotificationBellDropdown
        notificationCount={notificationCount}
        onMarkAllRead={fetchNewSignupsCount}
      />
    );
  }

  return (
    <NotificationBellDropdown
      variant="chat"
      notificationCount={chatUnreadCount}
      locale={locale}
    />
  );
}
