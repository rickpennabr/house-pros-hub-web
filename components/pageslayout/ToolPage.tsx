'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useLocale } from 'next-intl';
import ProfileIcon from '@/components/pageslayout/ProfileIcon';

interface ToolPageProps {
  title: string;
  children: ReactNode;
  headerExtra?: ReactNode;
}

export function ToolPage({ title, children, headerExtra }: ToolPageProps) {
  const locale = useLocale();
  return (
    <div className="min-h-screen w-full bg-white">
      <div className="w-full max-w-[960px] min-h-screen mx-auto border-2 border-black bg-white">
        <header className="w-full h-[60px] border-b-2 border-black p-2">
          <div className="relative w-full h-full flex items-center">
            <Link
              href={`/${locale}`}
              className="w-10 h-10 rounded-lg border-2 border-black flex items-center justify-center bg-white shrink-0 overflow-hidden"
              aria-label="Home"
            >
              <Image src="/house-pros-hub-logo-simble-bot.png" alt="" width={40} height={40} className="w-full h-full object-contain" />
            </Link>
            <h1 className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-lg md:text-2xl font-bold text-black whitespace-nowrap">
              {title}
            </h1>
            <div className="ml-auto flex items-center gap-2">
              {headerExtra}
              <ProfileIcon />
            </div>
          </div>
        </header>
        <div className="p-4 md:p-6">{children}</div>
      </div>
    </div>
  );
}
