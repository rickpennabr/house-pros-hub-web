'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import ProfileIcon from '@/components/pageslayout/ProfileIcon';

interface PlacesLayoutProps {
  children: ReactNode;
}

export default function PlacesLayout({ children }: PlacesLayoutProps) {
  const t = useTranslations('places');
  const locale = useLocale();

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-2 md:p-0 bg-white">
      <div
        className="w-full max-w-[960px] mx-auto bg-white flex flex-col min-h-0 border-2 border-black shadow-lg
        h-[calc(100vh-1rem)] overflow-y-auto overflow-x-hidden
        md:my-2 md:rounded-lg md:h-[calc(100vh-1rem)]"
      >
        <header className="w-full h-[60px] shrink-0 border-b-2 border-black p-2 sticky top-0 z-50 bg-white">
          <div className="relative w-full h-full flex items-center justify-between gap-2">
            <div className="flex items-center flex-shrink-0 z-10">
              <Link
                href={`/${locale}`}
                className="w-10 h-10 rounded-lg border-2 border-black flex items-center justify-center bg-white shrink-0 hover:bg-gray-50 transition-colors overflow-hidden cursor-pointer"
                aria-label="Go to home page"
              >
                <Image
                  src="/house-pros-hub-logo-simble-bot.png"
                  alt="House Pros Hub"
                  width={40}
                  height={40}
                  className="w-full h-full object-contain"
                  priority
                />
              </Link>
            </div>
            <h1 className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-base md:text-lg font-bold text-black whitespace-nowrap">
              {t('title')}
            </h1>
            <div className="flex items-center flex-shrink-0 z-[100]">
              <ProfileIcon />
            </div>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
