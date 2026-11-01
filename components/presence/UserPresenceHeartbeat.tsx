'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { runWhileVisible } from '@/lib/utils/runWhileVisible';

const USER_HEARTBEAT_MS = 60_000;

/**
 * When the current user is authenticated, sends periodic presence heartbeats
 * so they show as online in the admin ProBot Contacts list.
 * Pauses while the tab is hidden. Skips requests when not logged in.
 */
export default function UserPresenceHeartbeat() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const run = () => {
      fetch('/api/chat/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'user' }),
        credentials: 'include',
      }).catch(() => {});
    };

    return runWhileVisible(run, USER_HEARTBEAT_MS);
  }, [user]);

  return null;
}
