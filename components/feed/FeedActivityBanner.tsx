'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { Bell, Home } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { NotificationCount } from '@/components/ui/NotificationCount';

type RecentItem = { id: string; title: string; detail: string | null; at: string; href: string; who: 'pro' | 'customer' };

/**
 * Top of the feed: new things from pros on the user's places, and (for pros) new things customers did.
 * Opening the pro link marks the CRM count seen; the places count clears as each place is opened.
 */
export function FeedActivityBanner() {
  const locale = useLocale();
  const { isAuthenticated, roles } = useAuth();
  const isPro = (roles as string[]).includes('contractor');
  const [unread, setUnread] = useState<{ placesTotal: number; crmTotal: number; recent: RecentItem[] } | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    void fetch('/api/activity/unread', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setUnread({ placesTotal: data.placesTotal ?? 0, crmTotal: data.crmTotal ?? 0, recent: data.recent ?? [] });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  if (!unread || (unread.placesTotal === 0 && (!isPro || unread.crmTotal === 0))) return null;

  const markCrmSeen = () => {
    void fetch('/api/activity/seen', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scopes: ['feed:crm'] }),
      keepalive: true,
    }).catch(() => undefined);
  };

  const row = 'flex items-center gap-2 rounded-lg border-2 border-black bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50';
  const recent = unread.recent.filter((item) => isPro || item.who === 'pro');
  return (
    <div className="mb-3 space-y-2">
    {recent.length > 0 ? (
      <section className="rounded-lg border-2 border-black bg-white p-3">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Bell className="h-4 w-4 text-red-600" /> Your updates
        </h2>
        <ul className="divide-y divide-gray-200">
          {recent.map((item) => (
            <li key={item.id}>
              <Link
                href={`/${locale}${item.href}`}
                onClick={item.who === 'customer' ? markCrmSeen : undefined}
                className="flex items-start justify-between gap-3 py-2 text-sm hover:bg-gray-50"
              >
                <span className="min-w-0">
                  <span className="block font-medium">{item.title}</span>
                  {item.detail ? <span className="block truncate text-xs text-gray-600">{item.detail}</span> : null}
                </span>
                <time className="shrink-0 text-xs text-gray-500" dateTime={item.at}>
                  {new Date(item.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    ) : null}
    <div className="flex flex-col gap-2 sm:flex-row">
      {unread.placesTotal > 0 ? (
        <Link href={`/${locale}/myplaces`} className={row}>
          <Home className="h-4 w-4 text-red-600" />
          New on My Places
          <NotificationCount count={unread.placesTotal} />
        </Link>
      ) : null}
      {isPro && unread.crmTotal > 0 ? (
        <Link href={`/${locale}/crm/portal`} onClick={markCrmSeen} className={row}>
          <Bell className="h-4 w-4 text-red-600" />
          New from your customers
          <NotificationCount count={unread.crmTotal} />
        </Link>
      ) : null}
    </div>
    </div>
  );
}
