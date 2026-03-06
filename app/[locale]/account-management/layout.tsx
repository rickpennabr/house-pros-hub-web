'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslations, useLocale } from 'next-intl';
import ProfileIcon from '@/components/pageslayout/ProfileIcon';

interface AccountManagementLayoutProps {
  children: ReactNode;
}

export default function AccountManagementLayout({ children }: AccountManagementLayoutProps) {
  const t = useTranslations('accountManagement');
  const locale = useLocale();

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-2 md:p-0 bg-white">
      {/* Container: fixed height + scroll only inside card on all breakpoints; no window scroll */}
      <div className="w-full max-w-[960px] mx-auto bg-white flex flex-col min-h-0 border-2 border-black shadow-lg
        h-[calc(100vh-1rem)] overflow-y-auto overflow-x-hidden
        md:my-2 md:rounded-lg md:h-[calc(100vh-1rem)]">
        {/* Header: home link, centered title, profile */}
        <header className="w-full h-[60px] shrink-0 border-b-2 border-black p-2 md:px-2 md:py-4">
          <div className="relative w-full h-full flex items-center justify-between gap-2">
            {/* Left: Home link with icon */}
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

            {/* Center: Account Management title */}
            <div className="flex items-center justify-center flex-1 min-w-0 absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-0">
              <h1 className="text-base md:text-lg font-bold text-black whitespace-nowrap">
                {t('title')}
              </h1>
            </div>

            {/* Right: Profile Icon with Account Menu */}
            <div className="flex items-center flex-shrink-0 z-[100]">
              <ProfileIcon />
            </div>
          </div>
        </header>

        {/* Page Content */}
        {children}
      </div>
    </div>
  );
}

