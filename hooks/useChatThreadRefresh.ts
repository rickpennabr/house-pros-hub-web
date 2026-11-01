'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

/** Slow fallback when realtime cannot deliver the new row (visitor RLS). */
const FALLBACK_POLL_MS = 20_000;

/**
 * Keep an open chat thread current.
 * Admin sessions receive inserts over Supabase realtime. Everyone else falls back
 * to a slow poll that pauses while the tab is hidden.
 */
export function useChatThreadRefresh(
  conversationId: string | null | undefined,
  enabled: boolean,
  onRefresh: () => void
): void {
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    if (!enabled || !conversationId) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;
    const supabase = createClient();
    const channel = supabase
      .channel(`chat-thread:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'probot_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          onRefreshRef.current();
        }
      )
      .subscribe();

    const stop = () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const start = () => {
      stop();
      if (document.visibilityState !== 'visible') return;
      intervalId = setInterval(() => {
        if (document.visibilityState === 'visible') onRefreshRef.current();
      }, FALLBACK_POLL_MS);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        onRefreshRef.current();
        start();
      } else {
        stop();
      }
    };

    start();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      supabase.removeChannel(channel);
    };
  }, [conversationId, enabled]);
}
