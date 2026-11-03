'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import ProfileIcon from '@/components/pageslayout/ProfileIcon';

export default function AppointmentsLayout({ children }: { children: ReactNode }) {
  const t = useTranslations('appointments');
  const locale = useLocale();

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-white p-2 md:p-0">
      <div className="mx-auto flex h-[calc(100vh-1rem)] w-full max-w-[960px] flex-col overflow-x-hidden overflow-y-auto border-2 border-black bg-white shadow-lg md:my-2 md:h-[calc(100vh-1rem)] md:rounded-lg">
        <header className="sticky top-0 z-50 h-[60px] w-full shrink-0 border-b-2 border-black bg-white p-2">
          <div className="relative flex h-full w-full items-center justify-between gap-2">
            <Link
              href={`/${locale}`}
              className="z-10 flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 border-black bg-white hover:bg-gray-50"
              aria-label="Go to home page"
            >
              <Image src="/house-pros-hub-logo-simble-bot.png" alt="House Pros Hub" width={40} height={40} className="h-full w-full object-contain" priority />
            </Link>
            <h1 className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-base font-bold text-black md:text-lg">
              {t('title')}
            </h1>
            <div className="z-[100] flex items-center">
              <ProfileIcon />
            </div>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
