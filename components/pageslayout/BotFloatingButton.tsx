'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useChat } from '@/contexts/ChatContext';
import { useWelcome } from '@/contexts/WelcomeContext';

/** Display size of the button in pixels (1.2x scale: 56 → 67). */
const BUTTON_SIZE = 67;

const TYPEWRITER_MS = 130;
const REPEAT_AFTER_MS = 3000;

/**
 * Floating bot button on the home/main area (mobile and desktop).
 * Opens ProBot chat drawer when clicked.
 */
export default function BotFloatingButton() {
  const t = useTranslations('bot');
  const tooltipText = t('tooltip');
  const { openChat, isOpen } = useChat();
  const { isWelcomeOverlayVisible } = useWelcome();
  const [src, setSrc] = useState<string>('/pro-bot-solo.gif');
  const [typedLength, setTypedLength] = useState(0);

  useEffect(() => {
    if (typedLength >= tooltipText.length) {
      const restart = setTimeout(() => setTypedLength(0), REPEAT_AFTER_MS);
      return () => clearTimeout(restart);
    }
    const id = setTimeout(() => setTypedLength((n) => n + 1), TYPEWRITER_MS);
    return () => clearTimeout(id);
  }, [typedLength, tooltipText.length]);

  const handleClick = () => {
    openChat();
  };

  const handleImageError = () => {
    setSrc('/pro-bot-solo.png');
  };

  const displayText = tooltipText.slice(0, typedLength);
  const isTyping = typedLength < tooltipText.length;

  if (isOpen || isWelcomeOverlayVisible) return null;

  return (
    <button
      type="button"
      onClick={handleClick}
      className="fixed z-30 flex flex-col items-center bottom-[125px] right-[35px] md:bottom-[180px] md:right-[calc(max(1rem,calc((100vw-960px)/2+1rem))+40px)] cursor-pointer hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-black rounded-lg p-0 bg-transparent border-0"
      aria-label={tooltipText}
    >
      <div className="mb-1 flex flex-col items-center bg-transparent pointer-events-none">
        <div className="w-[108px] h-[97px] flex flex-col items-center justify-center gap-0.5 p-2.5 rounded-md bg-gray-900 text-white text-[12px] leading-tight text-center">
          <span>{t('greeting')}</span>
          <span>
            {displayText}
            {isTyping && <span className="animate-pulse">|</span>}
          </span>
        </div>
        <div
          className="w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent border-t-[10px] border-t-gray-900 -mt-px"
          aria-hidden
        />
      </div>
      <div className="h-[67px] w-[67px] flex items-center justify-center pointer-events-none">
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
  );
}
