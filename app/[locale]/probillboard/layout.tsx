'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import ProfileIcon from '@/components/pageslayout/ProfileIcon';

export default function ProBillboardLayout({ children }: { children: ReactNode }) {
  const locale = useLocale();
  const t = useTranslations('proBillboard');

  return (
    <div className="min-h-screen w-full bg-white">
      <div className="mx-auto min-h-screen w-full max-w-[960px] border-2 border-black bg-white">
        <header className="h-[60px] w-full border-b-2 border-black p-2 md:px-2 md:py-4">
          <div className="relative flex h-full w-full items-center">
            <Link
              href={`/${locale}/account-management`}
              className="z-10 flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-black bg-white hover:bg-gray-50"
              aria-label={t('back')}
            >
              <Image src="/house-pros-hub-logo-simble-bot.png" alt="House Pros Hub" width={40} height={40} className="h-full w-full object-contain" />
            </Link>
            <h1 className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-lg font-bold text-black md:text-2xl">
              {t('title')}
            </h1>
            <div className="z-[100] ml-auto">
              <ProfileIcon />
            </div>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
