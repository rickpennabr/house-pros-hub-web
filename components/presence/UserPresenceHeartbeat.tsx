'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const USER_HEARTBEAT_MS = 35_000;

/**
 * When the current user is authenticated, sends periodic presence heartbeats
 * so they show as online in the admin ProBot Contacts list (anywhere on the platform).
 * Skips requests when not logged in to avoid 401 noise in the console.
 */
export default function UserPresenceHeartbeat() {
  const { user } = useAuth();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user) return;

    let mounted = true;

    const run = async () => {
      try {
        await fetch('/api/chat/presence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'user' }),
          credentials: 'include',
        });
      } catch {
        // ignore
      }
    };

    run();
    if (!intervalRef.current) {
      intervalRef.current = setInterval(run, USER_HEARTBEAT_MS);
    }
    return () => {
      mounted = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user]);

  return null;
}
