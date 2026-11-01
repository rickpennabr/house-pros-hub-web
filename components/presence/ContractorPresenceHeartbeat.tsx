'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { runWhileVisible } from '@/lib/utils/runWhileVisible';

const CONTRACTOR_HEARTBEAT_MS = 60_000;
const BUSINESS_IDS_TTL_MS = 5 * 60_000;

/**
 * When the current user owns businesses, sends periodic presence heartbeats
 * so contractors show as online in the ProBot sidebar.
 * Business ids are cached so each heartbeat does not reload the business list.
 * Pauses while the tab is hidden.
 */
export default function ContractorPresenceHeartbeat() {
  const { user } = useAuth();
  const businessIdsRef = useRef<string[] | null>(null);
  const idsFetchedAtRef = useRef(0);

  useEffect(() => {
    const businessId = user?.businessId;
    if (!businessId) return;
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    fetch('/api/chat/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'business', businessId }),
    }).catch(() => {});
  }, [user?.businessId]);

  useEffect(() => {
    if (!user) return;

    const run = async () => {
      try {
        const idsAreStale = Date.now() - idsFetchedAtRef.current > BUSINESS_IDS_TTL_MS;
        if (!businessIdsRef.current || idsAreStale) {
          const res = await fetch('/api/me/businesses', { credentials: 'include' });
          if (!res.ok) return;
          const data = (await res.json()) as { businessIds?: string[] };
          const ids = data.businessIds ?? [];
          if (ids.length === 0) {
            businessIdsRef.current = [];
            idsFetchedAtRef.current = Date.now();
            return;
          }
          businessIdsRef.current = ids;
          idsFetchedAtRef.current = Date.now();
        }

        const ids = businessIdsRef.current;
        if (!ids?.length) return;

        await Promise.all(
          ids.map((businessId) =>
            fetch('/api/chat/presence', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: 'business', businessId }),
              credentials: 'include',
            })
          )
        );
      } catch {
        // ignore
      }
    };

    return runWhileVisible(() => {
      void run();
    }, CONTRACTOR_HEARTBEAT_MS);
  }, [user]);

  return null;
}
