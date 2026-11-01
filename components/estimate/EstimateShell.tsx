'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import ProfileIcon from '@/components/pageslayout/ProfileIcon';

interface EstimateShellProps {
  children: ReactNode;
}

export default function EstimateShell({ children }: EstimateShellProps) {
  const t = useTranslations('estimate.page');

  return (
    <div className="min-h-screen w-full bg-white">
      <div className="w-full max-w-[960px] min-h-screen mx-auto border-2 border-black bg-white">
        <header className="w-full h-[60px] border-b-2 border-black p-2 md:px-2 md:py-4">
          <div className="relative w-full h-full flex items-center">
            <div className="flex items-center flex-shrink-0 z-10">
              <Link
                href="/"
                className="w-10 h-10 rounded-lg border-2 border-black flex items-center justify-center bg-white shrink-0 hover:bg-gray-50 transition-colors overflow-hidden cursor-pointer"
                aria-label="Go to home"
              >
                <Image
                  src="/house-pros-hub-logo-simble-bot.png"
                  alt="House Pros Hub"
                  width={40}
                  height={40}
                  className="w-full h-full object-contain"
                />
              </Link>
            </div>

            <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center z-0">
              <h1 className="text-xl md:text-2xl font-bold text-black whitespace-nowrap">
                {t('title')}
              </h1>
            </div>

            <div className="flex items-center flex-shrink-0 ml-auto z-[100]">
              <ProfileIcon />
            </div>
          </div>
        </header>

        {children}
      </div>
    </div>
  );
}
