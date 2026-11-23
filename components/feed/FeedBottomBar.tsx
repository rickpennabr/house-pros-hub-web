'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Filter, Globe, MapPin, Plus, Search, X } from 'lucide-react';
import { FEED_FILTERS, type FeedFilter, type FeedScope } from '@/lib/feed/types';

const ICON_BUTTON =
  'relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-white bg-black text-white transition-colors hover:bg-gray-800 active:scale-95';

/**
 * Feed controls at the bottom of the column, BrazaFeed style:
 * left half Local / All, right half Search, Filter and Add (pros).
 */
export function FeedBottomBar({
  scope,
  onScope,
  filter,
  onFilter,
  localCity,
  searchOpen,
  onToggleSearch,
  onAdd,
}: {
  scope: FeedScope;
  onScope: (scope: FeedScope) => void;
  filter: FeedFilter;
  onFilter: (filter: FeedFilter) => void;
  localCity: string;
  searchOpen: boolean;
  onToggleSearch: () => void;
  /** Pros only: opens the Add chooser. */
  onAdd?: () => void;
}) {
  const t = useTranslations('feed');
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!filterOpen) return;
    const close = (event: MouseEvent) => {
      if (!filterRef.current?.contains(event.target as Node)) setFilterOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setFilterOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [filterOpen]);

  const modes = [
    { id: 'local' as const, Icon: MapPin, label: t('scope.local'), title: t('localTitle', { city: localCity }) },
    { id: 'all' as const, Icon: Globe, label: t('scope.all'), title: t('allTitle') },
  ];

  return (
    <div
      className="sticky bottom-0 z-30 mt-auto px-1 pt-2 md:px-2"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="flex min-h-[56px] items-center rounded-lg border-2 border-black bg-black px-2 py-1.5 shadow-[0_-4px_12px_rgba(0,0,0,0.12)]" role="toolbar">
        {/* Left half: Local / All */}
        <div className="flex w-1/2 items-center justify-around gap-1">
          {modes.map(({ id, Icon, label, title }) => {
            const active = scope === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onScope(id)}
                aria-pressed={active}
                title={title}
                aria-label={title}
                className={`flex h-10 items-center justify-center gap-1.5 rounded-lg border-2 transition-colors ${
                  active ? 'border-white bg-white px-3 text-black' : 'w-10 border-transparent text-white hover:border-white/60'
                }`}
              >
                <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-red-500' : ''}`} />
                {active ? <span className="text-sm font-bold">{label}</span> : null}
              </button>
            );
          })}
        </div>

        <div className="h-10 w-px shrink-0 bg-white/80" aria-hidden />

        {/* Right half: Search, Filter, Add */}
        <div className="flex w-1/2 items-center justify-around gap-1">
          <button
            type="button"
            onClick={onToggleSearch}
            className={`${ICON_BUTTON} ${searchOpen ? '!bg-white !text-black' : ''}`}
            aria-label={t('search')}
            aria-pressed={searchOpen}
          >
            <Search className="h-5 w-5" />
          </button>

          <div ref={filterRef} className="relative">
            <button
              type="button"
              onClick={() => setFilterOpen((v) => !v)}
              className={`${ICON_BUTTON} ${filter !== 'all' ? '!bg-white !text-black' : ''}`}
              aria-label={t('filter')}
              aria-expanded={filterOpen}
            >
              <Filter className="h-5 w-5" />
            </button>
            {filter !== 'all' ? (
              <button
                type="button"
                onClick={() => onFilter('all')}
                className="absolute -left-1.5 -top-1.5 z-10 flex h-4 w-4 items-center justify-center rounded-md bg-red-500 text-white hover:bg-red-600"
                aria-label={t('removeFilter')}
              >
                <X className="h-3 w-3" />
              </button>
            ) : null}
            {filterOpen ? (
              <div className="absolute bottom-[calc(100%+12px)] right-0 z-40 w-56 rounded-lg border-2 border-black bg-white p-2 shadow-xl" role="menu">
                <p className="px-1 pb-1 text-xs font-bold uppercase tracking-wide text-gray-500">{t('filter')}</p>
                <div className="grid grid-cols-1 gap-1">
                  {FEED_FILTERS.map((value) => {
                    const selected = filter === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        role="menuitemradio"
                        aria-checked={selected}
                        onClick={() => {
                          onFilter(value);
                          setFilterOpen(false);
                        }}
                        className={`rounded-lg border-2 px-3 py-2 text-left text-sm font-semibold ${
                          selected ? 'border-black bg-black text-white' : 'border-gray-200 bg-white text-black hover:border-black'
                        }`}
                      >
                        {t(`filters.${value}`)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          {onAdd ? (
            <button type="button" onClick={onAdd} className={`${ICON_BUTTON} !bg-white !text-black`} aria-label={t('add')}>
              <Plus className="h-5 w-5" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
