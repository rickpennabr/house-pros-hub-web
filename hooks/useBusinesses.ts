'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { ProCardData } from '@/components/proscard/ProCard';

export interface UseBusinessesResult {
  businesses: ProCardData[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Client-side request deduplication and in-memory cache (60s).
 * next.revalidate only applies to server-side fetch; this hook uses its own cache and deduplication.
 */
const requestCache = new Map<string, Promise<{ businesses: unknown[]; pagination?: unknown }>>();
const CACHE_DURATION = 60 * 1000; // 60 seconds
const cacheTimestamps = new Map<string, number>();

/**
 * Deduplicated fetch: same URL+options share one promise; result cached for CACHE_DURATION.
 */
async function deduplicatedFetch(
  url: string, 
  options?: RequestInit
): Promise<{ businesses: unknown[]; pagination?: unknown }> {
  const cacheKey = `${url}_${JSON.stringify(options)}`;
  const now = Date.now();
  
  // Check if there's an in-flight request
  const inFlightRequest = requestCache.get(cacheKey);
  if (inFlightRequest) {
    return inFlightRequest;
  }
  
  // Check cache timestamp (stale-while-revalidate pattern)
  const cacheTime = cacheTimestamps.get(cacheKey);
  const isStale = !cacheTime || (now - cacheTime) > CACHE_DURATION;
  
  // Client-side fetch: next.revalidate only applies to server fetch; we use in-memory cache above
  const requestPromise = fetch(url, options)
    .then(async (response) => {
      if (!response.ok) {
        // Remove from cache on error
        requestCache.delete(cacheKey);
        let message = response.statusText;
        try {
          const body = await response.json();
          if (body && typeof body.error === 'string') {
            message = body.error;
          }
        } catch {
          // ignore
        }
        throw new Error(`Failed to fetch: ${message}`);
      }
      
      // Parse JSON once
      const data = await response.json();
      
      // Remove from in-flight cache after completion
      requestCache.delete(cacheKey);
      
      // Update cache timestamp
      cacheTimestamps.set(cacheKey, now);
      
      return data as { businesses: unknown[]; pagination?: unknown };
    })
    .catch((error) => {
      // Remove from in-flight cache on error
      requestCache.delete(cacheKey);
      throw error;
    });
  
  // Store in-flight request (parsed data promise)
  requestCache.set(cacheKey, requestPromise);
  
  return requestPromise;
}

/**
 * Hook to fetch and manage businesses from the API.
 * Optionally accepts initial data from server (e.g. from getCachedBusinessesList) for fast first paint.
 * Uses request deduplication and in-memory cache; refetches on focus and when navigating to list.
 * @param initialData - Optional server-fetched list for initial render (avoids loading flash)
 * @returns Businesses data, loading state, error, and refetch function
 */
export function useBusinesses(initialData?: ProCardData[] | null): UseBusinessesResult {
  const [businesses, setBusinesses] = useState<ProCardData[]>(initialData ?? []);
  const [isLoading, setIsLoading] = useState(!initialData?.length);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const pathname = usePathname();
  const previousPathnameRef = useRef<string | null>(null);
  const hasInitialData = Boolean(initialData?.length);

  const fetchBusinesses = useCallback(async (forceRefresh: boolean = false) => {
    // Cancel previous request if still in flight
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    
    if (!hasInitialData) setIsLoading(true);
    setError(null);
    
    try {
      // deduplicatedFetch now returns parsed data directly
      const data = await deduplicatedFetch('/api/businesses', {
        signal: abortController.signal,
        headers: {
          'Cache-Control': forceRefresh ? 'no-cache' : 'max-age=60',
        },
      });
      
      // Remove userId from businesses before displaying (it's for internal use only)
      const businessesForDisplay = ((data.businesses || []) as (ProCardData & { userId?: string })[]).map(
        (business) => {
          const { userId: _userId, ...businessData } = business;
          void _userId;
          return businessData;
        }
      );
      
      setBusinesses(businessesForDisplay);
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      
      const errorMessage = err instanceof Error ? err.message : 'Failed to load businesses';
      setError(errorMessage);
      console.error('Error loading businesses:', err);
      setBusinesses([]);
    } finally {
      if (!abortController.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [hasInitialData]);

  useEffect(() => {
    const isBusinessListPage = pathname?.includes('/businesslist');
    
    // If we're on the businesslist page, always fetch fresh data
    if (isBusinessListPage) {
      // Clear cache to ensure fresh data
      cacheTimestamps.clear();
      requestCache.clear();
      fetchBusinesses(true);
    } else {
      // For other pages, use normal fetch (may use cache)
      fetchBusinesses();
    }

    // Reload when window gains focus (useful if business was created in another tab/window)
    // Use a debounce to prevent rapid refetches
    let focusTimeout: NodeJS.Timeout;
    const handleFocus = () => {
      clearTimeout(focusTimeout);
      focusTimeout = setTimeout(() => {
        fetchBusinesses(true); // Force refresh on focus
      }, 500);
    };
    
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
      clearTimeout(focusTimeout);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchBusinesses, pathname]);

  // Refresh businesses when navigating to businesslist page (e.g., from account-management)
  useEffect(() => {
    const isBusinessListPage = pathname?.includes('/businesslist');
    const wasBusinessListPage = previousPathnameRef.current?.includes('/businesslist');
    
    // If we just navigated TO the businesslist page (from another page), force refresh
    if (isBusinessListPage && !wasBusinessListPage && previousPathnameRef.current !== null) {
      console.log('[useBusinesses] Navigating to businesslist, forcing refresh');
      // Clear cache timestamps to force fresh fetch
      cacheTimestamps.clear();
      requestCache.clear();
      fetchBusinesses(true);
    }
    
    // Update previous pathname
    previousPathnameRef.current = pathname;
  }, [pathname, fetchBusinesses]);

  return {
    businesses,
    isLoading,
    error,
    refetch: () => fetchBusinesses(true),
  };
}
