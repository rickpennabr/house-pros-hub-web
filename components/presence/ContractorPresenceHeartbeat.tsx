'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const CONTRACTOR_HEARTBEAT_MS = 35_000;

/**
 * When the current user owns businesses, sends periodic presence heartbeats
 * so contractors show as online in the ProBot sidebar.
 * Fires an immediate heartbeat for user.businessId (from auth) so status shows green right away.
 */
export default function ContractorPresenceHeartbeat() {
  const { user } = useAuth();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Immediate heartbeat for primary business so online status shows as soon as user is on platform
  useEffect(() => {
    const businessId = user?.businessId;
    if (!businessId) return;
    fetch('/api/chat/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'business', businessId }),
    }).catch(() => {});
  }, [user?.businessId]);

  useEffect(() => {
    if (!user) return;

    let mounted = true;

    const run = async () => {
      try {
        const res = await fetch('/api/me/businesses', { credentials: 'include' });
        if (!mounted) return;
        if (!res.ok) return; // not logged in or error - don't start interval
        const data = await res.json();
        const ids = data.businessIds as string[] | undefined;
        if (!ids?.length) return;

        await Promise.all(
          ids.map((businessId: string) =>
            fetch('/api/chat/presence', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: 'business', businessId }),
              credentials: 'include',
            })
          )
        );
        if (mounted && !intervalRef.current) {
          intervalRef.current = setInterval(run, CONTRACTOR_HEARTBEAT_MS);
        }
      } catch {
        // ignore
      }
    };

    run();
    return () => {
      mounted = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user]);

  return null;
}
