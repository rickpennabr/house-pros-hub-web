'use client';

import { ReactNode, useState, useEffect, useCallback } from 'react';
import { AdminSearchProvider } from './AdminSearchContext';
import { AdminHeader } from './AdminHeader';
import { AdminSidebar } from './AdminSidebar';

const NEW_SIGNUPS_POLL_MS = 60 * 1000;

interface AdminLayoutProps {
  children: ReactNode;
  userEmail: string;
  onSearchChange?: (query: string) => void;
}

export function AdminLayout({ children, userEmail, onSearchChange }: AdminLayoutProps) {
  const [notificationCount, setNotificationCount] = useState(0);

  const fetchNewSignupsCount = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchNewSignupsCount();
    const interval = setInterval(fetchNewSignupsCount, NEW_SIGNUPS_POLL_MS);
    return () => clearInterval(interval);
  }, [fetchNewSignupsCount]);

  return (
    <AdminSearchProvider onSearchChange={onSearchChange}>
      {/* Mobile: whole page scrolls (overflow-y-auto). Desktop: only main scrolls (overflow-hidden). */}
      <div className="w-full min-h-screen flex flex-col bg-white overflow-y-auto md:overflow-hidden md:h-screen">
        <AdminHeader
          userEmail={userEmail}
          notificationCount={notificationCount}
          onMarkAllRead={fetchNewSignupsCount}
        />
        {/* Mobile: flex-col so menu bar stacks above main and scrolls with page. Desktop: flex-row, main scrolls. */}
        <div className="flex flex-col md:flex-row md:flex-1 md:min-h-0 md:overflow-hidden">
          <AdminSidebar />
          <main className="flex-1 min-w-0 bg-white flex flex-col md:overflow-y-auto pt-0 md:pt-0">
            <div className="px-2 md:px-[100px] md:py-4 flex-1">{children}</div>
          </main>
        </div>
      </div>
    </AdminSearchProvider>
  );
}

