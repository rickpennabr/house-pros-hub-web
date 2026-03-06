'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ProBotContact } from '@/components/probot/ProBotSidebar';

const HUB_PRESENCE_POLL_MS = 45_000;
const VISITOR_HEARTBEAT_MS = 35_000;
const BUSINESS_PRESENCE_POLL_MS = 45_000;

export function useProBotPresence(
  businessIds: string[],
  customerUserIds: string[],
  isAdmin: boolean,
  isContractor: boolean,
  currentUserBusinessId: string | undefined,
  setContacts: React.Dispatch<React.SetStateAction<ProBotContact[]>>
) {
  const [hubOnline, setHubOnline] = useState<boolean | null>(null);

  const businessIdsRef = useRef<string[]>([]);
  businessIdsRef.current = businessIds;
  const customerUserIdsRef = useRef<string[]>([]);
  customerUserIdsRef.current = customerUserIds;
  const currentUserBusinessIdRef = useRef<string | undefined>(currentUserBusinessId);
  currentUserBusinessIdRef.current = currentUserBusinessId;

  useEffect(() => {
    const run = () => {
      const ids = businessIdsRef.current.slice(0, 100);
      if (ids.length === 0) return;
      const selfBusinessId = currentUserBusinessIdRef.current;
      fetch(`/api/chat/presence?businessIds=${ids.join(',')}`)
        .then((res) => (res.ok ? res.json() : { onlineByBusiness: {} }))
        .then((data) => {
          const map = (data.onlineByBusiness ?? {}) as Record<string, boolean>;
          setContacts((prev) =>
            prev.map((c) => {
              if (!c.businessId) return c;
              const fromServer = map[c.businessId] === true;
              const isSelf = selfBusinessId && c.businessId === selfBusinessId;
              return { ...c, online: isSelf ? true : fromServer };
            })
          );
        })
        .catch(() => {});
    };
    run();
    const earlyPoll = setTimeout(run, 2_000);
    const interval = setInterval(run, BUSINESS_PRESENCE_POLL_MS);
    return () => {
      clearTimeout(earlyPoll);
      clearInterval(interval);
    };
  }, [setContacts]);

  useEffect(() => {
    if (!isAdmin && !isContractor) return;
    const run = () => {
      const ids = customerUserIdsRef.current.slice(0, 100);
      if (ids.length === 0) return;
      fetch(`/api/chat/presence?userIds=${ids.join(',')}`)
        .then((res) => (res.ok ? res.json() : { onlineByUser: {} }))
        .then((data) => {
          const map = (data.onlineByUser ?? {}) as Record<string, boolean>;
          setContacts((prev) =>
            prev.map((c) => {
              if (!c.id.startsWith('customer-')) return c;
              const userId = c.id.slice('customer-'.length);
              return { ...c, online: map[userId] === true };
            })
          );
        })
        .catch(() => {});
    };
    run();
    const earlyPoll = setTimeout(run, 2_000);
    const interval = setInterval(run, BUSINESS_PRESENCE_POLL_MS);
    return () => {
      clearTimeout(earlyPoll);
      clearInterval(interval);
    };
  }, [isAdmin, isContractor, setContacts]);

  const fetchHubPresence = useCallback(() => {
    fetch('/api/chat/presence?for=hub')
      .then((res) => (res.ok ? res.json() : { online: false }))
      .then((data) => setHubOnline(data.online === true))
      .catch(() => setHubOnline(false));
  }, []);

  return { hubOnline, setHubOnline, fetchHubPresence, HUB_PRESENCE_POLL_MS, VISITOR_HEARTBEAT_MS };
}
