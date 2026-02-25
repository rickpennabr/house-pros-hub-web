'use client';

import { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { Bell, User, Briefcase } from 'lucide-react';

export type NewSignupItem = {
  id: string;
  type: 'customer' | 'contractor';
  name: string;
  createdAt: string;
  href: string;
  eventType?: 'signup' | 'deletion';
};

function formatRelativeTime(iso: string) {
  const d = new Date(iso);
  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface NotificationBellDropdownProps {
  notificationCount?: number;
  /** Called after marking all read so parent can refresh the count */
  onMarkAllRead?: () => void;
}

export function NotificationBellDropdown({ notificationCount = 0, onMarkAllRead }: NotificationBellDropdownProps) {
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationItems, setNotificationItems] = useState<NewSignupItem[]>([]);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const bellButtonRef = useRef<HTMLButtonElement>(null);

  const handleMarkAllRead = async () => {
    setMarkingRead(true);
    try {
      const res = await fetch('/api/admin/notifications/mark-read', {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        setNotificationItems([]);
        onMarkAllRead?.();
      }
    } finally {
      setMarkingRead(false);
    }
  };

  useEffect(() => {
    if (!notificationOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target as Node) &&
        bellButtonRef.current &&
        !bellButtonRef.current.contains(event.target as Node)
      ) {
        setNotificationOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [notificationOpen]);

  useEffect(() => {
    if (!notificationOpen) return;
    setNotificationLoading(true);
    fetch('/api/admin/notifications/new-signups', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.items != null) setNotificationItems(data.items);
      })
      .catch(() => {})
      .finally(() => setNotificationLoading(false));
  }, [notificationOpen]);

  return (
    <div className="relative z-[100] -ml-0.5">
      <button
        ref={bellButtonRef}
        type="button"
        onClick={() => setNotificationOpen((o) => !o)}
        className="relative w-10 h-10 rounded-lg bg-white flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors bell-shake-on-hover"
        aria-label="Notifications"
        aria-expanded={notificationOpen}
      >
        <Bell className="w-5 h-5 text-black" />
        {notificationCount > 0 && (
          <span className="absolute -top-1 -right-1 mt-0.5 ml-0.5 min-w-[18px] h-[18px] px-0.5 flex items-center justify-center rounded-full bg-red-500 text-white text-[11px] md:text-[10px] font-bold text-center leading-none border-2 border-white -translate-x-[8px] translate-y-[4px]">
            {notificationCount > 99 ? '99+' : notificationCount}
        </span>
        )}
      </button>

      {notificationOpen && (
        <div
          ref={notificationRef}
          className="absolute right-0 mt-2 w-72 bg-white rounded-lg border-2 border-black shadow-lg z-[100] overflow-hidden"
        >
          <div className="px-4 py-3 border-b-2 border-black bg-gray-50">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-black">Notifications</h3>
                <p className="text-[10px] text-gray-600 mt-0.5">
                  New signups in the last 24 hours
                </p>
              </div>
              {notificationCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  disabled={markingRead}
                  className="shrink-0 text-xs font-medium text-black underline hover:no-underline disabled:opacity-50 cursor-pointer"
                >
                  {markingRead ? '…' : 'Mark all read'}
                </button>
              )}
            </div>
          </div>
          <div className="max-h-[min(60vh,320px)] overflow-y-auto p-2">
            {notificationLoading && notificationItems.length === 0 ? (
              <div className="py-6 text-center text-sm text-gray-500">
                Loading…
              </div>
            ) : notificationItems.length === 0 ? (
              <div className="py-6 text-center text-sm text-gray-500">
                No new signups
              </div>
            ) : (
              <ul className="space-y-0.5">
                {notificationItems.map((item) => {
                  const actionLabel = item.eventType === 'deletion' ? 'was deleted' : 'signed up';
                  return (
                    <li key={`${item.type}-${item.id}`}>
                      <Link
                        href={item.href}
                        onClick={() => setNotificationOpen(false)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                      >
                        <span className="flex-shrink-0 w-8 h-8 rounded-lg border-2 border-black flex items-center justify-center bg-white">
                          {item.type === 'customer' ? (
                            <User className="w-4 h-4 text-black" />
                          ) : (
                            <Briefcase className="w-4 h-4 text-black" />
                          )}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-medium truncate text-black">
                            {item.name}
                          </span>
                          <span className="block text-[10px] text-gray-500">
                            {item.type === 'customer' ? 'Customer' : 'Contractor'} {actionLabel} · {formatRelativeTime(item.createdAt)}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
