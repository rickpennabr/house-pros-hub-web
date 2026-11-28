'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Mic, MessageSquare, Sparkles } from 'lucide-react';

interface Usage {
  plan: string;
  unlimited: boolean;
  signedIn: boolean;
  answers: { used: number; limit: number };
  voice: { used: number; limit: number };
  resetsAt: string;
}

/**
 * Next to ProBot's name: answers and voice replies left today, and Subscribe when they run out
 * (or always on the Free plan, smaller). Refreshes after each message (`refreshKey`).
 */
export function ProBotUsageIndicator({ conversationId, locale, refreshKey }: { conversationId: string | null; locale: string; refreshKey: number }) {
  const [usage, setUsage] = useState<Usage | null>(null);

  const load = useCallback(async () => {
    const query = conversationId ? `?conversationId=${encodeURIComponent(conversationId)}` : '';
    const response = await fetch(`/api/probot/usage${query}`, { credentials: 'include' }).catch(() => null);
    if (!response?.ok) return;
    setUsage((await response.json()) as Usage);
  }, [conversationId]);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load, refreshKey]);

  if (!usage || usage.unlimited) return null;
  const answersLeft = Math.max(0, usage.answers.limit - usage.answers.used);
  const voiceLeft = Math.max(0, usage.voice.limit - usage.voice.used);
  const out = answersLeft === 0 || voiceLeft === 0;
  const low = (n: number, limit: number) => n === 0 ? 'text-red-600' : n <= Math.max(2, Math.round(limit * 0.2)) ? 'text-amber-600' : 'text-gray-700';
  const subscribeHref = usage.signedIn ? `/${locale}/subscription` : `/${locale}/signup`;

  return (
    <div className="flex shrink-0 items-center gap-2 text-xs">
      <span
        className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-2 py-1"
        title={`Today: ${answersLeft} of ${usage.answers.limit} answers and ${voiceLeft} of ${usage.voice.limit} voice replies left. Resets at midnight UTC.`}
      >
        <span className={`flex items-center gap-1 font-semibold ${low(answersLeft, usage.answers.limit)}`}>
          <MessageSquare className="h-3.5 w-3.5" aria-hidden />
          {answersLeft}
          <span className="sr-only"> answers left today</span>
        </span>
        <span className={`flex items-center gap-1 font-semibold ${low(voiceLeft, usage.voice.limit)}`}>
          <Mic className="h-3.5 w-3.5" aria-hidden />
          {voiceLeft}
          <span className="sr-only"> voice replies left today</span>
        </span>
      </span>
      {out || usage.plan === 'free' ? (
        <Link
          href={subscribeHref}
          className={`flex items-center gap-1 rounded-md px-2 py-1 font-semibold ${out ? 'bg-red-600 text-white hover:bg-red-700' : 'border border-black bg-white text-black hover:bg-gray-50'}`}
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          {out ? 'Get more' : 'Subscribe'}
        </Link>
      ) : null}
    </div>
  );
}
