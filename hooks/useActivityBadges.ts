'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { unreadCounts, stepTab, type TimelineStep } from '@/lib/timeline/steps';

/** How long a tab must stay open before its badge clears. */
const SEEN_DELAY_MS = 1500;

/**
 * Notification badges for one property's tabs. `prefix` is the seen scope, e.g. "crm:<customer>:<place>:"
 * or "place:<placeId>:". Counts what the other side did since the viewer last opened each tab, and
 * clears the open tab's badge after a moment. `newIds` keeps the "New" tags for this visit.
 */
export function useActivityBadges(prefix: string | null, steps: TimelineStep[], viewer: 'pro' | 'customer', openTab: string) {
  const [seen, setSeen] = useState<Record<string, string | undefined> | null>(null);
  const [loadedPrefix, setLoadedPrefix] = useState<string | null>(null);
  const snapshot = useRef<Record<string, string | undefined>>({});

  useEffect(() => {
    if (!prefix) return;
    let cancelled = false;
    void fetch(`/api/activity/seen?prefix=${encodeURIComponent(prefix)}`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { seen: {} }))
      .then((data: { seen?: Record<string, string> }) => {
        if (cancelled) return;
        const byTab = Object.fromEntries(Object.entries(data.seen ?? {}).map(([scope, at]) => [scope.slice(prefix.length), at]));
        snapshot.current = byTab;
        setSeen(byTab);
        setLoadedPrefix(prefix);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [prefix]);

  const markSeen = useCallback(
    (tab: string) => {
      if (!prefix) return;
      const now = new Date().toISOString();
      setSeen((current) => ({ ...(current ?? {}), [tab]: now }));
      void fetch('/api/activity/seen', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scopes: [`${prefix}${tab}`] }),
      }).catch(() => undefined);
    },
    [prefix]
  );

  const ready = seen !== null && loadedPrefix === prefix;
  const counts = useMemo(() => (ready ? unreadCounts(steps, viewer, seen) : {}), [ready, steps, viewer, seen]);

  // Opening a tab with something new clears it after a moment.
  const openCount = counts[openTab] ?? 0;
  useEffect(() => {
    if (!ready || openCount === 0) return;
    const handle = window.setTimeout(() => markSeen(openTab), SEEN_DELAY_MS);
    return () => window.clearTimeout(handle);
  }, [ready, openTab, openCount, markSeen]);

  // "New" tags: unread as of when the page loaded, kept while the viewer looks.
  const newIds = useMemo(() => {
    if (!ready) return new Set<string>();
    const base = snapshot.current;
    const ids = new Set<string>();
    const time = (iso: string) => Date.parse(iso.length === 10 ? `${iso}T12:00:00` : iso) || 0;
    for (const step of steps) {
      if ((step.by ?? 'pro') === viewer) continue;
      if (viewer === 'customer' && step.customerSees === false) continue;
      const tab = openTab === 'timeline' ? 'timeline' : stepTab(step);
      const seenAt = tab ? base[tab] : undefined;
      if (!seenAt || time(step.at) > time(seenAt)) ids.add(step.id);
    }
    return ids;
  }, [ready, steps, viewer, openTab]);

  return { counts, newIds };
}
