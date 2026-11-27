'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { BookOpen, ChevronDown, HelpCircle } from 'lucide-react';
import { BsGrid3X3Gap } from 'react-icons/bs';
import { TypingSearchInput } from '@/components/common/TypingSearchInput';
import { MobileGridActionsModal } from '@/components/crm/MobileGridActionsModal';
import { DOCS_NAV, docsPath, filterDocsNav } from '@/lib/docs/nav';

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const activeSection = DOCS_NAV.find((section) => section.pages.some((page) => page.slug === activeSlug));
    return activeSection ? { [activeSection.id]: true } : {};
  });
  const sections = useMemo(() => filterDocsNav(query), [query]);

  const flatPages = useMemo(
    () =>
      DOCS_NAV.flatMap((section) =>
        section.pages.map((page) => ({
          id: page.slug,
          href: docsPath(locale, page.slug),
          label: page.title,
          icon: BookOpen,
          isActive: page.slug === activeSlug,
        }))
      ),
    [locale, activeSlug]
  );

  const mobileStrip = useMemo(() => {
    const section = DOCS_NAV.find((item) => item.pages.some((page) => page.slug === activeSlug)) ?? DOCS_NAV[0];
    return section?.pages ?? [];
  }, [activeSlug]);

  return (
    <>
      {/* Mobile: horizontal strip + grid menu, same pattern as CRM/Admin. */}
      <div className="z-40 w-full shrink-0 border-b-2 border-black bg-white md:hidden">
        <div className="relative flex h-[60px] items-center px-2 py-2">
          <nav className="scrollbar-custom flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pr-12">
            {mobileStrip.map((page) => {
              const active = page.slug === activeSlug;
              return (
                <Link
                  key={page.slug}
                  href={docsPath(locale, page.slug)}
                  className={`flex h-10 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border-2 px-3 text-sm font-medium transition-all hover:scale-[1.02] ${
                    active
                      ? 'border-black bg-black text-white'
                      : 'border-transparent bg-transparent text-black hover:border-gray-400'
                  }`}
                >
                  <BookOpen className={`h-4 w-4 ${active ? 'text-white' : 'text-red-600'}`} aria-hidden />
                  {page.title}
                </Link>
              );
            })}
          </nav>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg border-2 border-black bg-black hover:bg-gray-800"
            aria-label={labels.menu}
          >
            <BsGrid3X3Gap className="h-5 w-5 text-white" />
          </button>
        </div>
      </div>

      <MobileGridActionsModal
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={labels.menu}
        items={[
          ...flatPages,
          {
            id: 'help',
            href: `/${locale}/help`,
            label: labels.help,
            icon: HelpCircle,
            isActive: false,
          },
        ]}
      />

      {/* Desktop: full-height sidebar like ProsCRM / Admin Dash. */}
      <aside className="hidden h-full min-h-0 w-64 shrink-0 overflow-y-auto overscroll-contain border-r-2 border-black bg-white md:block">
        <div className="space-y-4 p-4 pb-24">
          <TypingSearchInput
            value={query}
            onChange={setQuery}
            placeholder={labels.search}
            clearLabel={labels.clear}
          />

          <nav aria-label="Docs" className="space-y-2">
            {sections.map((section) => {
              const childActive = section.pages.some((page) => page.slug === activeSlug);
              const open = Boolean(query.trim()) || (openGroups[section.id] ?? childActive);
              return (
                <div key={section.id}>
                  <button
                    type="button"
                    onClick={() =>
                      setOpenGroups((current) => {
                        const currentlyOpen = current[section.id] ?? childActive;
                        return { ...current, [section.id]: !currentlyOpen };
                      })
                    }
                    aria-expanded={open}
                    className={`flex w-full cursor-pointer items-center rounded-lg border-2 px-4 py-3 text-left transition-all hover:border-gray-400 ${
                      childActive && !open ? 'border-black font-medium' : 'border-transparent'
                    }`}
                  >
                    <BookOpen className="mr-3 h-5 w-5 text-red-600" aria-hidden />
                    <span className="flex-1 font-semibold text-black">{section.label}</span>
                    <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>
                  {open ? (
                    <div className="mt-1 space-y-1">
                      {section.pages.map((page) => {
                        const active = page.slug === activeSlug;
                        return (
                          <Link
                            key={page.slug}
                            href={docsPath(locale, page.slug)}
                            className={`flex items-center rounded-lg border-2 py-2 pl-8 pr-4 text-sm transition-all hover:scale-[1.02] ${
                              active
                                ? 'border-black bg-white font-medium text-black'
                                : 'border-transparent text-black hover:border-gray-400'
                            }`}
                          >
                            {page.title}
                          </Link>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}

            <Link
              href={`/${locale}/help`}
              className="flex items-center rounded-lg border-2 border-transparent px-4 py-3 text-black transition-all hover:scale-[1.02] hover:border-gray-400"
            >
              <HelpCircle className="mr-3 h-5 w-5 text-red-600" aria-hidden />
              {labels.help}
            </Link>

            {sections.length === 0 ? (
              <p className="px-3 text-sm text-gray-500">No guides match “{query}”.</p>
            ) : null}
          </nav>
        </div>
      </aside>
    </>
  );
}
