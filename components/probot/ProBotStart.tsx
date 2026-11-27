'use client';

import type { ReactNode } from 'react';
import { CalendarDays, ClipboardList, DollarSign, FolderKanban, Home, Search, Sparkles } from 'lucide-react';

/**
 * A new ProBot chat (Gemini-style): greeting, the input in the middle of the screen and a few
 * suggestions under it. Tapping a suggestion sends it. The first message moves the input down.
 */
export function ProBotStart({
  firstName,
  business,
  onPick,
  children,
}: {
  firstName: string;
  /** Business profile: business suggestions; personal: homeowner ones. */
  business: boolean;
  onPick: (text: string) => void;
  /** The message input. */
  children: ReactNode;
}) {
  const name = firstName.trim();
  const suggestions = business
    ? [
        { icon: DollarSign, text: 'Who owes me money?' },
        { icon: CalendarDays, text: "What's on my schedule today?" },
        { icon: ClipboardList, text: 'Which estimates are waiting for an answer?' },
        { icon: FolderKanban, text: 'Which projects finish this week?' },
      ]
    : [
        { icon: Search, text: 'Find a pro near me' },
        { icon: Home, text: 'What is going on at my places?' },
        { icon: Sparkles, text: 'I want a free estimate' },
      ];

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col items-center justify-center overflow-hidden bg-[#f8f9fb] px-4 py-10">
      {/* A soft blue cloud around the input, like Gemini's start screen: a few blurred, slowly drifting layers. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="probot-cloud absolute left-1/2 top-1/2 h-[560px] w-[900px] max-w-[160vw] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(closest-side, rgba(147,197,253,0.55), rgba(191,219,254,0.35) 45%, rgba(255,255,255,0) 100%)' }}
        />
        <div
          className="probot-cloud-slow absolute left-[58%] top-[56%] h-[360px] w-[520px] max-w-[110vw] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(closest-side, rgba(96,165,250,0.35), rgba(255,255,255,0))' }}
        />
        <div
          className="probot-cloud-slow absolute left-[40%] top-[44%] h-[300px] w-[460px] max-w-[100vw] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(closest-side, rgba(255,255,255,0.9), rgba(255,255,255,0))' }}
        />
      </div>
      <div className="relative flex w-full max-w-2xl flex-col items-center">
        <h2 className="mb-6 text-center text-2xl font-normal text-gray-900 sm:text-3xl">
          {name ? `Hi ${name}, where should we start?` : 'Where should we start?'}
        </h2>
        <div className="w-full rounded-lg shadow-[0_8px_40px_rgba(59,130,246,0.18)]">{children}</div>
        <ul className="mt-5 w-full max-w-md space-y-1 self-center">
          {suggestions.map(({ icon: Icon, text }) => (
            <li key={text}>
              <button
                type="button"
                onClick={() => onPick(text)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-100"
              >
                <Icon className="h-4 w-4 shrink-0 text-gray-600" aria-hidden />
                {text}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
