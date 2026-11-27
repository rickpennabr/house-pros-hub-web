'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { TypingSearchInput } from '@/components/common/TypingSearchInput';
import { docsPath, filterDocsNav } from '@/lib/docs/nav';

interface DocsSidebarProps {
  locale: string;
  activeSlug: string;
  labels: {
    search: string;
    clear: string;
    menu: string;
    close: string;
    help: string;
  };
}

export function DocsSidebar({ locale, activeSlug, labels }: DocsSidebarProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const sections = useMemo(() => filterDocsNav(query), [query]);

  const nav = (
    <nav aria-label="Docs" className="space-y-6">
      {sections.map((section) => (
        <div key={section.id}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{section.label}</p>
          <ul className="space-y-1">
            {section.pages.map((page) => {
              const active = page.slug === activeSlug;
              return (
                <li key={page.slug}>
                  <Link
                    href={docsPath(locale, page.slug)}
                    onClick={() => setOpen(false)}
                    className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                      active
                        ? 'border-2 border-black bg-black font-medium text-white'
                        : 'border-2 border-transparent text-gray-800 hover:bg-gray-100'
                    }`}
                  >
                    {page.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Help</p>
        <Link
          href={`/${locale}/help`}
          onClick={() => setOpen(false)}
          className="block rounded-lg border-2 border-transparent px-3 py-2 text-sm text-gray-800 hover:bg-gray-100"
        >
          {labels.help}
        </Link>
      </div>
      {sections.length === 0 ? (
        <p className="px-3 text-sm text-gray-500">No guides match “{query}”.</p>
      ) : null}
    </nav>
  );

  return (
    <>
      <div className="mb-3 flex items-center gap-2 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg border-2 border-black bg-white px-3 py-2 text-sm font-medium text-black"
        >
          <Menu className="h-4 w-4" aria-hidden />
          {labels.menu}
        </button>
      </div>

      <aside className="hidden w-60 shrink-0 border-r-2 border-black lg:block">
        <div className="sticky top-16 space-y-4 px-3 py-6">
          <TypingSearchInput
            value={query}
            onChange={setQuery}
            placeholder={labels.search}
            clearLabel={labels.clear}
          />
          {nav}
        </div>
      </aside>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label={labels.close}
            className="absolute inset-0 cursor-pointer bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-[min(100%,20rem)] flex-col border-r-2 border-black bg-white shadow-lg">
            <div className="flex items-center justify-between border-b-2 border-black px-3 py-3">
              <p className="font-semibold text-black">Hub Docs</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="cursor-pointer rounded-lg border-2 border-black p-1.5"
                aria-label={labels.close}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 overflow-y-auto px-3 py-4">
              <TypingSearchInput
                value={query}
                onChange={setQuery}
                placeholder={labels.search}
                clearLabel={labels.clear}
              />
              {nav}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
