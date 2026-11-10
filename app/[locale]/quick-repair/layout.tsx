'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import Footer from '@/components/layout/Footer';
import ProfileIcon from '@/components/pageslayout/ProfileIcon';
import { RepairCameraMark } from '@/components/pageslayout/PagesMenu';

interface QuickRepairLayoutProps {
  children: ReactNode;
}

/** Quick Repair stands alone, like account management: logo, brand, profile. */
export default function QuickRepairLayout({ children }: QuickRepairLayoutProps) {
  const t = useTranslations('procam');
  const locale = useLocale();

  return (
    <div className="flex min-h-dvh w-full items-start justify-center bg-white p-2 md:min-h-screen md:items-center md:p-0">
      <div className="mx-auto flex h-[calc(100dvh-1rem)] w-full max-w-[960px] min-h-0 flex-col overflow-hidden border-2 border-black bg-white md:my-2 md:h-[calc(100vh-1rem)] md:rounded-lg">
        <header className="relative z-30 h-[60px] w-full shrink-0 border-b-2 border-black bg-white px-2">
          <div className="relative flex h-full w-full items-center justify-between gap-2">
            <Link
              href={`/${locale}`}
              className="z-10 flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-black bg-white transition-colors hover:bg-gray-50"
              aria-label="Go to home page"
            >
              <Image
                src="/house-pros-hub-logo-simble-bot.png"
                alt="House Pros Hub"
                width={40}
                height={40}
                className="h-full w-full object-contain"
                priority
              />
            </Link>

            <div className="pointer-events-none absolute left-1/2 top-1/2 z-0 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2">
              <span className="relative block h-7 w-[2.3rem] shrink-0 overflow-hidden">
                <RepairCameraMark />
              </span>
              <h1 className="whitespace-nowrap text-lg font-bold leading-none text-black md:text-xl">
                {t('brandTitle')}
              </h1>
            </div>

            <div className="z-[100] flex shrink-0 items-center">
              <ProfileIcon />
            </div>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
          {children}
          <Footer />
        </div>
      </div>
    </div>
  );
}
