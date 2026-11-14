'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';

export const CRM_LIST_PAGE_SIZE = 25;

interface UseCrmListQueryOptions {
  endpoint: string;
  rowsKey: string;
  defaultSort: string;
  defaultSortDir?: 'asc' | 'desc';
  /** Extra query params. Empty strings are omitted. */
  extraParams?: Record<string, string>;
  loadError: string;
}

interface UseCrmListQueryResult<T> {
  rows: T[];
  total: number;
  page: number;
  setPage: (page: number) => void;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  searchInput: string;
  isLoading: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  hasLoadedOnce: boolean;
  /** Chart payload when the request asked for `chart=1`. Null on list and map loads. */
  chart: unknown;
  /** Debounced search currently applied to the request. */
  search: string;
  reload: () => Promise<void>;
  handleSort: (key: string, dir: 'asc' | 'desc') => void;
  handleSearchInput: (value: string) => void;
  handleSearchSubmit: (event: FormEvent) => void;
}

/**
 * Shared page, sort, debounced search, and fetch lifecycle for CRM lists.
 * Callers keep their own columns, forms, and row actions.
 */
export function useCrmListQuery<T>({
  endpoint,
  rowsKey,
  defaultSort,
  defaultSortDir = 'desc',
  extraParams,
  loadError,
}: UseCrmListQueryOptions): UseCrmListQueryResult<T> {
  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState(defaultSort);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(defaultSortDir);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const searchDebounceRef = useRef<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [chart, setChart] = useState<unknown>(null);
  const hasLoadedOnceRef = useRef(false);
  const extraKey = JSON.stringify(extraParams ?? {});

  const reload = useCallback(async () => {
    const isFirst = !hasLoadedOnceRef.current;
    try {
      if (isFirst) setIsLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(CRM_LIST_PAGE_SIZE),
        sortBy,
        sortDir,
      });
      if (search) params.set('search', search);
      const extras = JSON.parse(extraKey) as Record<string, string>;
      for (const [key, value] of Object.entries(extras)) {
        if (value) params.set(key, value);
      }
      const res = await fetch(`${endpoint}?${params}`, { credentials: 'include' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const list = data[rowsKey];
      setRows(Array.isArray(list) ? (list as T[]) : []);
      setTotal(typeof data.total === 'number' ? data.total : 0);
      setChart(data.chart ?? null);
      hasLoadedOnceRef.current = true;
      setHasLoadedOnce(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : loadError);
      if (isFirst) {
        setRows([]);
        setTotal(0);
        setChart(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, [endpoint, extraKey, loadError, page, rowsKey, search, sortBy, sortDir]);

  useEffect(() => {
    // Fetch on the next turn. Calling reload() here sets list state, which the
    // react-hooks rule rejects when it happens in the same turn as the effect.
    const id = window.setTimeout(() => {
      void reload();
    }, 0);
    return () => window.clearTimeout(id);
  }, [reload]);

  const handleSort = (key: string, dir: 'asc' | 'desc') => {
    setSortBy(key);
    setSortDir(dir);
    setPage(1);
  };

  const handleSearchInput = (value: string) => {
    setSearchInput(value);
    if (searchDebounceRef.current) window.clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = window.setTimeout(() => {
      setSearch(value.trim());
      setPage(1);
    }, 200);
  };

  const handleSearchSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (searchDebounceRef.current) window.clearTimeout(searchDebounceRef.current);
    setSearch(searchInput.trim());
    setPage(1);
  };

  useEffect(
    () => () => {
      if (searchDebounceRef.current) window.clearTimeout(searchDebounceRef.current);
    },
    []
  );

  return {
    rows,
    total,
    page,
    setPage,
    sortBy,
    sortDir,
    searchInput,
    isLoading,
    error,
    setError,
    hasLoadedOnce,
    chart,
    search,
    reload,
    handleSort,
    handleSearchInput,
    handleSearchSubmit,
  };
}
