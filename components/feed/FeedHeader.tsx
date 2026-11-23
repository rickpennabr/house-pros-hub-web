'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import ProfileIcon from '@/components/pageslayout/ProfileIcon';
import { HeaderNotificationBell } from '@/components/pageslayout/HeaderNotificationBell';
import { TypingSearchInput } from '@/components/common/TypingSearchInput';
import { useAuth } from '@/contexts/AuthContext';

const SLIDE_MS = 4500;
/** Wait before a line that does not fit starts moving left, so the start can be read. */
const SCROLL_DELAY_MS = 2000;
/** Reading speed for the moving text. */
const SCROLL_PX_PER_SEC = 40;
/** Pause on the end of the line before sliding to the next one. */
const END_PAUSE_MS = 1500;

/**
 * One tagline line. When it is wider than the bar (phones), it sits left-aligned and,
 * 2 seconds after it shows, moves left until its end is visible.
 * Reports how long it needs so the bar waits for it before sliding on.
 */
function TaglineLine({
  active,
  className,
  children,
  onNeed,
}: {
  active: boolean;
  className: string;
  children: React.ReactNode;
  onNeed: (ms: number) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(0);
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    const measure = () => {
      const box = boxRef.current;
      const text = textRef.current;
      if (!box || !text) return;
      const extra = Math.max(0, Math.ceil(text.scrollWidth - box.clientWidth));
      setOverflow(extra);
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (boxRef.current) observer.observe(boxRef.current);
    return () => observer.disconnect();
  }, []);

  const scrollMs = Math.round((overflow / SCROLL_PX_PER_SEC) * 1000);

  useEffect(() => {
    onNeed(overflow > 0 ? SCROLL_DELAY_MS + scrollMs + END_PAUSE_MS : 0);
  }, [overflow, scrollMs, onNeed]);

  useEffect(() => {
    if (!active || overflow === 0) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const start = window.setTimeout(() => setMoving(true), SCROLL_DELAY_MS);
    return () => {
      window.clearTimeout(start);
      setMoving(false);
    };
  }, [active, overflow]);

  return (
    <div
      ref={boxRef}
      aria-hidden={!active}
      className={`flex h-full w-full min-w-full shrink-0 items-center overflow-hidden px-2 font-semibold text-white ${
        overflow > 0 ? 'justify-start' : 'justify-center'
      } ${className}`}
    >
      <span
        ref={textRef}
        className="whitespace-nowrap"
        style={{
          transform: moving ? `translateX(-${overflow}px)` : 'translateX(0)',
          transition: moving ? `transform ${scrollMs}ms linear` : 'none',
        }}
      >
        {children}
      </span>
    </div>
  );
}

/** Black tagline bar that slides through three short lines, like BrazaFeed's header pill. */
function FeedTagline() {
  const t = useTranslations('feed');
  const lines = t.raw('tagline') as string[];
  const [index, setIndex] = useState(0);
  const needs = useRef<number[]>([]);

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    // Stay on a long line until its text has finished moving.
    const wait = Math.max(SLIDE_MS, needs.current[index] ?? 0);
    const id = window.setTimeout(() => setIndex((i) => (i + 1) % lines.length), wait);
    return () => window.clearTimeout(id);
  }, [index, lines.length]);

  return (
    <div className="flex h-10 w-full min-w-0 overflow-hidden rounded-lg border-2 border-black bg-black" aria-live="polite">
      <div
        className="flex h-full w-full min-w-0 transition-transform duration-500 ease-in-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {lines.map((line, i) => (
          <TaglineLine
            key={i}
            active={i === index}
            className={i === 0 ? 'text-base md:text-lg' : 'text-xs md:text-sm'}
            onNeed={(ms) => {
              needs.current[i] = ms;
            }}
          >
            {i === 0 ? (
              <>
                {line.replace('HubFeed', '')}
                <span className="ml-1 text-red-500">HubFeed</span>
              </>
            ) : (
              line
            )}
          </TaglineLine>
        ))}
      </div>
    </div>
  );
}

/**
 * Feed header: logo (back to HousePros) · sliding tagline · bell and account.
 * While searching, the search field takes the whole row.
 */
export function FeedHeader({
  searchOpen,
  search,
  onSearch,
  onCloseSearch,
}: {
  searchOpen: boolean;
  search: string;
  onSearch: (value: string) => void;
  onCloseSearch: () => void;
}) {
  const t = useTranslations('feed');
  const locale = useLocale();
  const { isAuthenticated } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  return (
    <header className="sticky top-0 z-30 border-b-2 border-black bg-white px-1.5 py-2 md:px-2">
      {searchOpen ? (
        <div className="flex items-center gap-2">
          <TypingSearchInput
            value={search}
            onChange={onSearch}
            placeholder={t('searchPlaceholder')}
            clearLabel={t('clearSearch')}
            inputRef={inputRef}
          />
          <button
            type="button"
            onClick={onCloseSearch}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-black bg-white text-black hover:bg-gray-50"
            aria-label={t('closeSearch')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      ) : (
        <div className="grid items-center gap-2" style={{ gridTemplateColumns: 'auto minmax(0, 1fr) auto' }}>
          <Link
            href={`/${locale}/businesslist`}
            className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 border-black bg-white hover:bg-gray-50"
            aria-label={t('home')}
          >
            <Image src="/house-pros-hub-logo-simble-bot.png" alt="" width={40} height={40} className="h-full w-full object-contain" priority />
          </Link>
          <div className="min-w-0">
            <h1 className="sr-only">{t('title')}</h1>
            <FeedTagline />
          </div>
          <div className="flex h-10 items-center gap-2">
            {isAuthenticated ? <HeaderNotificationBell /> : null}
            <ProfileIcon />
          </div>
        </div>
      )}
    </header>
  );
}
