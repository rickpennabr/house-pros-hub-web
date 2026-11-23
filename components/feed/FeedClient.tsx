'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { FeedHeader } from '@/components/feed/FeedHeader';
import { FeedBottomBar } from '@/components/feed/FeedBottomBar';
import { FeedPost, feedItemSearchText } from '@/components/feed/FeedPost';
import { isHubPro, ProAddModal } from '@/components/pageslayout/ProAddChooser';
import { useAuth } from '@/contexts/AuthContext';
import type { FeedFilter, FeedItem, FeedPage, FeedScope } from '@/lib/feed/types';

function FeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="mb-1.5 ml-1 h-3 w-40 rounded-md bg-gray-200" />
          <div className="flex gap-3 rounded-lg border-2 border-gray-200 p-3">
            <div className="h-12 w-12 shrink-0 rounded-lg bg-gray-200" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-4 w-4/5 rounded-md bg-gray-200" />
              <div className="h-3 w-1/3 rounded-md bg-gray-200" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function FeedClient({ initialPage, localCity }: { initialPage: FeedPage; localCity: string }) {
  const t = useTranslations('feed');
  const { isAuthenticated, roles } = useAuth();
  const isPro = isAuthenticated && isHubPro(roles as readonly string[]);
  const [scope, setScope] = useState<FeedScope>('local');
  const [filter, setFilter] = useState<FeedFilter>('all');
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [items, setItems] = useState<FeedItem[]>(initialPage.items);
  const [cursor, setCursor] = useState<string | null>(initialPage.nextCursor);
  const [isAdmin, setIsAdmin] = useState(initialPage.isAdmin);
  const [reloading, setReloading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [lightbox, setLightbox] = useState<{ photos: string[]; index: number } | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);
  const busyRef = useRef(false);
  const firstRender = useRef(true);

  const fetchPage = useCallback(async (next: { scope: FeedScope; filter: FeedFilter; cursor: string | null }) => {
    const qs = new URLSearchParams({ scope: next.scope, filter: next.filter });
    if (next.cursor) qs.set('cursor', next.cursor);
    const res = await fetch(`/api/feed?${qs.toString()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as FeedPage;
  }, []);

  const reload = useCallback(async () => {
    const id = ++requestId.current;
    busyRef.current = true;
    setReloading(true);
    setError(false);
    try {
      const page = await fetchPage({ scope, filter, cursor: null });
      if (id !== requestId.current) return;
      setItems(page.items);
      setCursor(page.nextCursor);
      setIsAdmin(page.isAdmin);
    } catch {
      if (id === requestId.current) setError(true);
    } finally {
      if (id === requestId.current) {
        busyRef.current = false;
        setReloading(false);
      }
    }
  }, [fetchPage, scope, filter]);

  const loadMore = useCallback(async () => {
    if (!cursor || busyRef.current) return;
    const id = requestId.current;
    busyRef.current = true;
    setLoadingMore(true);
    try {
      const page = await fetchPage({ scope, filter, cursor });
      if (id !== requestId.current) return;
      setItems((current) => {
        const seen = new Set(current.map((row) => row.id));
        return [...current, ...page.items.filter((row) => !seen.has(row.id))];
      });
      setCursor(page.nextCursor && page.nextCursor !== cursor ? page.nextCursor : null);
    } catch {
      if (id === requestId.current) setError(true);
    } finally {
      busyRef.current = false;
      setLoadingMore(false);
    }
  }, [cursor, fetchPage, scope, filter]);

  // Scope or filter change: start over (the first render already has the server page).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, filter]);

  // Infinite scroll: load the next page when the end of the list comes into view.
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !cursor) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore();
      },
      { rootMargin: '600px 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [cursor, loadMore]);

  const visibleItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) => feedItemSearchText(item).includes(term));
  }, [items, search]);

  const changeVisibility = async (item: FeedItem, visibility: 'public' | 'hidden') => {
    if (visibility === 'hidden' && !isAdmin && !window.confirm(t('removeConfirm'))) return;
    setBusyId(item.id);
    try {
      const res = await fetch(`/api/feed/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility }),
      });
      if (!res.ok) return;
      setItems((current) =>
        visibility === 'hidden'
          ? current.filter((row) => row.id !== item.id)
          : current.map((row) => (row.id === item.id ? { ...row, visibility } : row))
      );
    } finally {
      setBusyId(null);
    }
  };

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLightbox(null);
      if (event.key === 'ArrowRight') setLightbox((lb) => (lb ? { ...lb, index: (lb.index + 1) % lb.photos.length } : lb));
      if (event.key === 'ArrowLeft') setLightbox((lb) => (lb ? { ...lb, index: (lb.index - 1 + lb.photos.length) % lb.photos.length } : lb));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox]);

  const isEmpty = !reloading && !loadingMore && !error && visibleItems.length === 0 && !(search && cursor);
  const emptyText = search
    ? `${t('noMatches')} ${t('trySearch')}`
    : scope === 'local'
      ? `${t('noMatches')} ${t('tryAll')}`
      : filter !== 'all'
        ? t('noMatches')
        : t('empty');

  return (
    <div className="flex min-h-full w-full flex-1 flex-col">
      <FeedHeader
        searchOpen={searchOpen}
        search={search}
        onSearch={setSearch}
        onCloseSearch={() => {
          setSearch('');
          setSearchOpen(false);
        }}
      />

      <div className="flex-1 px-1.5 pb-2 pt-3 md:px-3">
        {reloading ? (
          <FeedSkeleton />
        ) : (
          <div className="space-y-4">
            {visibleItems.map((item) => (
              <FeedPost
                key={item.id}
                item={item}
                isAdmin={isAdmin}
                busy={busyId === item.id}
                onVisibility={changeVisibility}
                onOpenPhoto={(row, index) => setLightbox({ photos: row.photos, index })}
              />
            ))}
          </div>
        )}

        {isEmpty ? (
          <p className="mt-2 rounded-lg border-2 border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-600">{emptyText}</p>
        ) : null}

        {error ? (
          <div className="mt-3 flex items-center justify-center gap-3 text-sm text-red-700">
            <span>{t('error')}</span>
            <button
              type="button"
              onClick={() => (items.length > 0 && cursor ? void loadMore() : void reload())}
              className="rounded-lg border-2 border-black px-3 py-1 font-semibold text-black"
            >
              {t('retry')}
            </button>
          </div>
        ) : null}

        {loadingMore ? (
          <div className="mt-4">
            <FeedSkeleton count={1} />
          </div>
        ) : null}
        {cursor && !reloading ? <div ref={sentinelRef} className="h-px w-full" aria-hidden /> : null}
      </div>

      <FeedBottomBar
        scope={scope}
        onScope={setScope}
        filter={filter}
        onFilter={setFilter}
        localCity={localCity}
        searchOpen={searchOpen}
        onToggleSearch={() => {
          if (searchOpen) setSearch('');
          setSearchOpen((v) => !v);
        }}
        onAdd={isPro ? () => setAddOpen(true) : undefined}
      />

      {isPro ? <ProAddModal isOpen={addOpen} onClose={() => setAddOpen(false)} /> : null}

      {lightbox ? (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 p-4" role="dialog" aria-modal="true" onClick={() => setLightbox(null)}>
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-lg border-2 border-white text-white"
            aria-label={t('close')}
          >
            <X className="h-5 w-5" />
          </button>
          {lightbox.photos.length > 1 ? (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setLightbox({ ...lightbox, index: (lightbox.index - 1 + lightbox.photos.length) % lightbox.photos.length });
                }}
                className="absolute left-3 z-10 flex h-10 w-10 items-center justify-center rounded-lg border-2 border-white text-white"
                aria-label="Previous"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setLightbox({ ...lightbox, index: (lightbox.index + 1) % lightbox.photos.length });
                }}
                className="absolute right-3 z-10 flex h-10 w-10 items-center justify-center rounded-lg border-2 border-white text-white"
                aria-label="Next"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          ) : null}
          <div className="relative h-full max-h-[85vh] w-full max-w-4xl" onClick={(event) => event.stopPropagation()}>
            <Image src={lightbox.photos[lightbox.index]} alt={t('photoAlt', { n: lightbox.index + 1 })} fill unoptimized sizes="100vw" className="object-contain" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
