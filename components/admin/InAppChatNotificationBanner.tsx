'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { MessageCircle, X } from 'lucide-react';
import { playNotificationSound } from '@/lib/utils/notificationSound';

const BANNER_AUTO_DISMISS_MS = 8_000;

interface PushPayload {
  title?: string;
  body?: string;
  url?: string;
  badge?: number;
}

/**
 * Shows a top-of-page banner when the admin has the site open and a new chat
 * push is received (e.g. visitor sent a message). Also plays the notification sound.
 * Similar to in-app notification behavior in mobile apps and major web apps.
 */
export function InAppChatNotificationBanner() {
  const [banner, setBanner] = useState<PushPayload | null>(null);

  const dismiss = useCallback(() => setBanner(null), []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.type !== 'PROBOT_PUSH') return;
      const payload = (data.payload || {}) as PushPayload;
      setBanner(payload);
      playNotificationSound();
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(dismiss, BANNER_AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [banner, dismiss]);

  if (!banner) return null;

  const title = banner.title || 'New message';
  const body = banner.body || 'You have a new chat message';
  const url = banner.url || '/admin/chat';

  return (
    <div
      role="alert"
      className="fixed top-0 left-0 right-0 z-[100] flex items-center gap-3 px-4 py-3 bg-gray-900 text-white shadow-lg border-b border-gray-700"
      aria-live="polite"
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="shrink-0 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
          <MessageCircle className="w-5 h-5 text-white" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm truncate">{title}</p>
          <p className="text-xs text-gray-300 truncate">{body}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link
          href={url}
          onClick={dismiss}
          className="px-3 py-1.5 rounded-lg bg-white text-gray-900 text-sm font-medium hover:bg-gray-100 transition-colors"
        >
          Open chat
        </Link>
        <button
          type="button"
          onClick={dismiss}
          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
