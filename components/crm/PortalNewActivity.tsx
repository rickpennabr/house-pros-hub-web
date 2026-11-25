'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { Bell } from 'lucide-react';

type RecentItem = { id: string; title: string; detail: string | null; at: string; href: string; who: 'pro' | 'customer' };

/**
 * Top of the Customer portal: what customers did since the pro last looked (estimates or invoices
 * opened, estimates signed, online payments, bookings). This is the count on the house button;
 * opening the portal marks it seen, and the list stays on screen for this visit.
 */
export function PortalNewActivity() {
  const locale = useLocale();
  const [data, setData] = useState<{ total: number; recent: RecentItem[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/activity/unread', { credentials: 'include', cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled || !json) return;
        const total = json.crmTotal ?? 0;
        const recent = ((json.recent ?? []) as RecentItem[]).filter((item) => item.who === 'customer');
        setData({ total, recent });
        if (total > 0) {
          void fetch('/api/activity/seen', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scopes: ['feed:crm'] }),
            keepalive: true,
          }).catch(() => undefined);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data || data.total === 0) return null;
  const others = Math.max(0, data.total - data.recent.length);

  return (
    <section className="rounded-lg border-2 border-black bg-white p-3">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <Bell className="h-4 w-4 text-red-600" /> New activity ({data.total})
      </h2>
      <ul className="divide-y divide-gray-200">
        {data.recent.map((item) => (
          <li key={item.id}>
            <Link
              href={`/${locale}${item.href}`}
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
      {others > 0 ? (
        <p className="mt-1 text-xs text-gray-600">
          {data.recent.length > 0 ? `+ ${others} more: ` : ''}customers opened estimates or invoices you sent.
        </p>
      ) : null}
    </section>
  );
}
