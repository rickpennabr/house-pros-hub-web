'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { ReactNode } from 'react';
import ProfileIcon from '@/components/pageslayout/ProfileIcon';
import { DocsSidebar } from '@/components/docs/DocsSidebar';
import { DocsToc } from '@/components/docs/DocsToc';
import type { DocsHeading } from '@/lib/docs/types';

interface DocsShellProps {
  locale: string;
  activeSlug: string;
  pageTitle: string;
  headings: DocsHeading[];
  labels: {
    brand: string;
    backToHub: string;
    search: string;
    clear: string;
    menu: string;
    close: string;
    help: string;
    onThisPage: string;
  };
  children: ReactNode;
}

export function DocsShell({
  locale,
  activeSlug,
  pageTitle,
  headings,
  labels,
  children,
}: DocsShellProps) {
  return (
    <div className="flex min-h-screen w-full flex-col overflow-y-auto bg-white text-black md:h-screen md:overflow-hidden">
      <header className="sticky top-0 z-50 h-[60px] w-full shrink-0 border-b-2 border-black bg-white px-2 py-2">
        <div className="flex h-full w-full items-center justify-between gap-2">
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={`/${locale}`}
              className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-black bg-white transition-colors hover:bg-gray-50"
              aria-label={labels.backToHub}
            >
              <Image
                src="/house-pros-hub-logo-simble-bot.png"
                alt="House Pros Hub"
                width={40}
                height={40}
                className="h-full w-full object-contain"
              />
            </Link>
            <h1 className="whitespace-nowrap text-xl font-bold text-black max-md:absolute max-md:left-1/2 max-md:top-1/2 max-md:-translate-x-1/2 max-md:-translate-y-1/2 md:text-2xl">
              {labels.brand}
            </h1>
          </div>

          <p className="pointer-events-none absolute left-1/2 top-1/2 hidden max-w-[calc(100%-28rem)] -translate-x-1/2 -translate-y-1/2 truncate text-xl font-bold text-black md:block">
            {pageTitle}
          </p>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={`/${locale}/help`}
              className="hidden cursor-pointer rounded-lg border-2 border-black bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50 sm:inline-flex"
            >
              {labels.help}
            </Link>
            <ProfileIcon />
          </div>
        </div>
      </header>

      <div className="flex flex-col md:min-h-0 md:flex-1 md:flex-row md:overflow-hidden">
        <DocsSidebar
          locale={locale}
          activeSlug={activeSlug}
          labels={{
            search: labels.search,
            clear: labels.clear,
            menu: labels.menu,
            close: labels.close,
            help: labels.help,
          }}
        />
        <main className="flex min-w-0 flex-1 flex-col bg-white md:overflow-y-auto">
          <div className="flex flex-1 px-2 pb-10 md:px-[100px] md:pt-3">
            <div className="flex min-w-0 flex-1 gap-8">
              <div className="min-w-0 flex-1">{children}</div>
              <DocsToc headings={headings} title={labels.onThisPage} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
