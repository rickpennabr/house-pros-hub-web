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

/** Black tagline bar that slides through three short lines, like BrazaFeed's header pill. */
function FeedTagline() {
  const t = useTranslations('feed');
  const lines = t.raw('tagline') as string[];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % lines.length), SLIDE_MS);
    return () => window.clearInterval(id);
  }, [lines.length]);

  return (
    <div className="flex h-10 w-full min-w-0 overflow-hidden rounded-lg border-2 border-black bg-black" aria-live="polite">
      <div
        className="flex h-full w-full min-w-0 transition-transform duration-500 ease-in-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {lines.map((line, i) => (
          <p
            key={i}
            aria-hidden={i !== index}
            className={`flex h-full w-full min-w-full shrink-0 items-center justify-center truncate px-2 text-center font-semibold text-white ${
              i === 0 ? 'text-base md:text-lg' : 'text-xs md:text-sm'
            }`}
          >
            {i === 0 ? (
              <>
                {line.replace('HubFeed', '')}
                <span className="ml-1 text-red-500">HubFeed</span>
              </>
            ) : (
              line
            )}
          </p>
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
