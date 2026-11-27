'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { DocsSidebar } from '@/components/docs/DocsSidebar';
import { DocsToc } from '@/components/docs/DocsToc';
import type { DocsHeading } from '@/lib/docs/types';

interface DocsShellProps {
  locale: string;
  activeSlug: string;
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

export function DocsShell({ locale, activeSlug, headings, labels, children }: DocsShellProps) {
  return (
    <div className="min-h-screen w-full bg-white text-black">
      <header className="sticky top-0 z-40 border-b-2 border-black bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-3 md:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href={`/${locale}`}
              className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border-2 border-transparent px-2 py-1 text-sm text-gray-700 hover:border-black hover:bg-gray-50"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">{labels.backToHub}</span>
            </Link>
            <Link href={`/${locale}/docs`} className="truncate text-lg font-bold tracking-tight text-black">
              {labels.brand}
            </Link>
          </div>
          <Link
            href={`/${locale}/help`}
            className="shrink-0 cursor-pointer rounded-lg border-2 border-black bg-white px-3 py-1.5 text-sm font-medium hover:bg-gray-50"
          >
            {labels.help}
          </Link>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl flex-col lg:flex-row">
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
        <div className="flex min-w-0 flex-1">
          {children}
          <DocsToc headings={headings} title={labels.onThisPage} />
        </div>
      </div>
    </div>
  );
}
