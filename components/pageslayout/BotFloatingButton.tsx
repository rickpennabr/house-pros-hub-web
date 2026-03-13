'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { useWelcome } from '@/contexts/WelcomeContext';
import { useProBotTransition } from '@/contexts/ProBotTransitionContext';
import { useChat } from '@/contexts/ChatContext';

/** Display size of the button in pixels (1.2x scale: 56 → 67). */
const BUTTON_SIZE = 67;

const TYPEWRITER_MS = 130;
const REPEAT_AFTER_MS = 3000;
/** Brief black transition before navigating; kept short so we spend less time on black. */
const BLACKOUT_MS = 500;

/**
 * Floating bot button on the home/main area (mobile and desktop).
 * On click: set transition (black overlay in [locale] fades in), hold 2s, navigate to ProBot.
 * ProBot page then clears transition and grows from center.
 * Shows a badge with unread ProBot message count (from ChatContext single source).
 */
export default function BotFloatingButton() {
  const t = useTranslations('bot');
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const { setTransitioningToProbot } = useProBotTransition();
  const { chatUnreadCount } = useChat();
  const tooltipText = t('tooltip');
  const { isWelcomeOverlayVisible } = useWelcome();
  const [src, setSrc] = useState<string>('/pro-bot-solo.gif');
  const [typedLength, setTypedLength] = useState(0);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (typedLength >= tooltipText.length) {
      const restart = setTimeout(() => setTypedLength(0), REPEAT_AFTER_MS);
      return () => clearTimeout(restart);
    }
    const id = setTimeout(() => setTypedLength((n) => n + 1), TYPEWRITER_MS);
    return () => clearTimeout(id);
  }, [typedLength, tooltipText.length]);

  // Don't render until mounted so we can read pathname (avoids showing floating bot on business list on reload).
  if (!mounted) return null;

  // On business list (HousePros) we show ProBot in the view toggle / bottom bar instead; never show the floating bot there.
  const isBusinessList = Boolean(pathname?.includes('/businesslist'));

  const handleClick = () => {
    setTransitioningToProbot(true);
    setTimeout(() => {
      router.push(`/${locale}/probot`);
    }, BLACKOUT_MS);
  };

  const handleImageError = () => {
    setSrc('/pro-bot-solo.png');
  };

  const displayText = tooltipText.slice(0, typedLength);
  const isTyping = typedLength < tooltipText.length;

  if (isWelcomeOverlayVisible || isBusinessList) return null;

  const probotHref = `/${locale}/probot`;

  return (
    <>
      {/* Hidden Link so Next.js prefetches the ProBot route when this button is in view; reduces load time when user clicks. */}
      <Link
        href={probotHref}
        prefetch
        className="sr-only"
        aria-hidden
        tabIndex={-1}
      >
        ProBot
      </Link>
      <button
        type="button"
        onClick={handleClick}
        className="fixed z-30 flex flex-col items-center bottom-[125px] right-[35px] md:bottom-[180px] md:right-[calc(max(1rem,calc((100vw-960px)/2+1rem))+40px)] cursor-pointer hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-black rounded-lg p-0 bg-transparent border-0"
        aria-label={tooltipText}
      >
      <div className="mb-1 flex flex-col items-center bg-transparent pointer-events-none">
        <div className="relative w-[108px] h-[97px] flex flex-col items-center justify-center gap-0.5 p-2.5 rounded-md bg-gray-900 text-white text-[12px] leading-tight text-center">
          {chatUnreadCount > 0 && (
            <span
              className="absolute top-0 right-0 min-w-[22px] h-[22px] px-1.5 flex items-center justify-center rounded-full bg-red-600 text-white text-xs font-semibold border-2 border-white shadow -translate-y-1/2 translate-x-1/2"
              aria-label={chatUnreadCount === 1 ? '1 unread message' : `${chatUnreadCount} unread messages`}
            >
              {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
            </span>
          )}
          <span>{t('greeting')}</span>
          <span>
            {displayText}
            {isTyping && <span className="animate-pulse">|</span>}
          </span>
          {/* Always-online status: same size/position as ProCard logo indicator (bottom-right overlap) */}
          <span
            className="absolute bottom-[-5px] right-[-5px] w-3 h-3 rounded-full border-2 border-white bg-green-500 shrink-0 z-[100]"
            aria-hidden
          />
        </div>
        <div
          className="w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent border-t-[10px] border-t-gray-900 -mt-px"
          aria-hidden
        />
      </div>
      <div className="relative h-[67px] w-[67px] flex items-center justify-center pointer-events-none">
        <img
          src={src}
          alt=""
          width={BUTTON_SIZE}
          height={BUTTON_SIZE}
          className="w-full h-full object-contain object-center"
          onError={handleImageError}
        />
      </div>
    </button>
    </>
  );
}
