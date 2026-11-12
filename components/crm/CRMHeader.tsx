'use client';

import Link from 'next/link';
import Image from 'next/image';
import ProfileIcon from '@/components/pageslayout/ProfileIcon';
import { useCRMChrome } from '@/components/crm/CRMChromeContext';

interface CRMHeaderProps {
  locale: string;
}

export function CRMHeader({ locale }: CRMHeaderProps) {
  const chrome = useCRMChrome();

  return (
    <header className="no-print relative w-full h-[60px] border-b-2 border-black px-2 md:px-2 py-2 md:py-2 bg-white sticky top-0 z-50 shrink-0">
      <div
        ref={chrome?.setHeaderSearchEl}
        className="pointer-events-none absolute left-1/2 top-1/2 hidden w-[min(32rem,calc(100%-28rem))] -translate-x-1/2 -translate-y-1/2 md:block"
      />
      <div className="w-full h-full flex items-center justify-between gap-2">
        <div className="flex items-center flex-shrink-0 gap-2">
          <Link
            href={`/${locale}`}
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
          <h1 className="text-xl font-bold text-black whitespace-nowrap max-md:absolute max-md:left-1/2 max-md:top-1/2 max-md:-translate-x-1/2 max-md:-translate-y-1/2 md:text-2xl">
            ProsCRM
          </h1>
        </div>
        <div className="flex items-center flex-shrink-0">
          <ProfileIcon />
        </div>
      </div>
    </header>
  );
}
