'use client';

import { useEffect, useState } from 'react';
import type { ProCardData } from '@/components/proscard/ProCard';
import { DIRECTORY_CARD_PAGE_SIZE } from '@/lib/constants/businessDirectory';

export interface UseBusinessesArgs {
  initialBusinesses?: ProCardData[] | null;
  initialTotal?: number;
  category?: string;
  search?: string;
  city?: string;
  page?: number;
  pageSize?: number;
  initialCategory?: string;
  initialCity?: string;
}

export interface UseBusinessesResult {
  businesses: ProCardData[];
  total: number;
  isLoading: boolean;
  error: string | null;
}

const SEARCH_DEBOUNCE_MS = 300;

function stripUserId(rows: Array<ProCardData & { userId?: string }>): ProCardData[] {
  return rows.map((business) => {
    const { userId: _userId, ...card } = business;
    void _userId;
    return card;
  });
}

/**
 * One page of the public directory.
 * The server-rendered first page is reused. Search, category, and later pages
 * are requested from the API instead of filtering a full catalog in the browser.
 */
export function useBusinesses({
  initialBusinesses = null,
  initialTotal = 0,
  category = 'All',
  search = '',
  city = '',
  page = 1,
  pageSize = DIRECTORY_CARD_PAGE_SIZE,
  initialCategory = 'All',
  initialCity = '',
}: UseBusinessesArgs = {}): UseBusinessesResult {
  const matchesServerPage =
    page === 1 &&
    pageSize === DIRECTORY_CARD_PAGE_SIZE &&
    (category || 'All') === (initialCategory || 'All') &&
    (city || '') === (initialCity || '') &&
    search.trim().length === 0;
  const [debouncedSearch, setDebouncedSearch] = useState(search.trim());
  const [businesses, setBusinesses] = useState<ProCardData[]>(matchesServerPage ? (initialBusinesses ?? []) : []);
  const [total, setTotal] = useState(matchesServerPage ? initialTotal || initialBusinesses?.length || 0 : 0);
  const [isLoading, setIsLoading] = useState(!matchesServerPage);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [search]);

  useEffect(() => {
    const isFirstCardPage =
      page === 1 &&
      pageSize === DIRECTORY_CARD_PAGE_SIZE &&
      (category || 'All') === (initialCategory || 'All') &&
      (city || '') === (initialCity || '') &&
      debouncedSearch.length === 0;

    if (isFirstCardPage && initialBusinesses) {
      setBusinesses(initialBusinesses);
      setTotal(initialTotal || initialBusinesses.length);
      setIsLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const offset = (Math.max(page, 1) - 1) * pageSize;
    const params = new URLSearchParams({
      limit: String(pageSize),
      offset: String(offset),
    });
    if (category && category !== 'All') params.set('category', category);
    if (city) params.set('city', city);
    if (debouncedSearch) params.set('search', debouncedSearch);

    setIsLoading(true);
    setError(null);

    fetch(`/api/businesses?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          let message = 'Failed to load businesses';
          try {
            const body = (await response.json()) as { error?: string };
            if (body.error) message = body.error;
          } catch {
            // keep the default message
          }
          throw new Error(message);
        }
        return response.json() as Promise<{
          businesses?: Array<ProCardData & { userId?: string }>;
          pagination?: { total?: number };
        }>;
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        const next = stripUserId(data.businesses ?? []);
        setBusinesses(next);
        setTotal(typeof data.pagination?.total === 'number' ? data.pagination.total : next.length);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Failed to load businesses');
        setIsLoading(false);
      });

    return () => controller.abort();
  }, [category, city, debouncedSearch, page, pageSize, initialBusinesses, initialTotal, initialCategory, initialCity]);

  return { businesses, total, isLoading, error };
}
