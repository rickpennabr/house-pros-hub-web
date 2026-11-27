'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { PROBOT_ASSETS } from '@/lib/constants/probot';

export type ProBotStartCrmButton = {
  id: string;
  label: string;
  onClick: () => void;
};

/**
 * A new ProBot chat: GIF, greeting and option boxes up top; Ask ProBot lower, as before.
 * The first message moves the input down.
 */
export function ProBotStart({
  firstName,
  crmButtons,
  children,
}: {
  firstName: string;
  /** Business CRM shortcuts (Calendar, Invoices, …). Omit for personal profiles. */
  crmButtons?: ProBotStartCrmButton[];
  /** The message input. */
  children: ReactNode;
}) {
  const name = firstName.trim();
  const [gifStep, setGifStep] = useState(0);
  const [showStatic, setShowStatic] = useState(false);

  useEffect(() => {
    if (showStatic) return;
    const timer = window.setTimeout(() => {
      if (gifStep < 3) setGifStep((step) => step + 1);
      else setShowStatic(true);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [gifStep, showStatic]);

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col items-center overflow-hidden bg-[#f8f9fb] px-4 pb-10 pt-[130px]">

      <div className="relative z-[1] flex w-full max-w-2xl shrink-0 flex-col items-center">
        {/* Soft smoke centered behind ProBot: drifts and holds one rainbow color at a time. */}
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-12 z-0 h-0 w-0">
          <div className="probot-cloud probot-start-smoke absolute left-0 top-0 h-[460px] w-[760px] max-w-[160vw] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl" />
          <div className="probot-cloud-slow probot-start-smoke-soft absolute left-0 top-0 h-[320px] w-[480px] max-w-[110vw] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl" />
          <div className="probot-cloud-slow probot-start-smoke-soft absolute left-0 top-0 h-[220px] w-[320px] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl" />
        </div>
        <div className="relative z-[1] mb-4 flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white shadow-sm">
          {showStatic ? (
            <img src="/pro-bot-solo.png" alt="ProBot" width={96} height={96} className="h-full w-full object-contain" />
          ) : (
            <img
              src={gifStep % 2 === 0 ? PROBOT_ASSETS.avatarWelcome : PROBOT_ASSETS.avatarWelcomeSecond}
              alt="ProBot"
              width={96}
              height={96}
              className="h-full w-full object-contain"
            />
          )}
        </div>

        <h2 className="mb-4 text-center text-2xl font-normal text-gray-900 sm:text-3xl">
          {name ? `Hi ${name}, where should we start?` : 'Where should we start?'}
        </h2>

        {crmButtons && crmButtons.length > 0 ? (
          <div className="mb-[100px] flex w-full max-w-xl flex-wrap justify-center gap-2">
            {crmButtons.map((button) => (
              <button
                key={button.id}
                type="button"
                onClick={button.onClick}
                className="probot-sky-btn cursor-pointer rounded-lg border-2 border-black bg-white px-4 py-2.5 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50"
              >
                {button.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="mb-[100px]" />
        )}

        {/* Ask ProBot: 100px under the option boxes. */}
        <div className="w-full rounded-lg shadow-[0_8px_40px_rgba(59,130,246,0.18)]">{children}</div>
      </div>
    </div>
  );
}
