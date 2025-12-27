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
 * Request deduplication cache
 * Prevents multiple simultaneous identical requests
 * Caches the parsed JSON data, not the Response object
 */
const requestCache = new Map<string, Promise<{ businesses: unknown[]; pagination?: unknown }>>();
const CACHE_DURATION = 60 * 1000; // 60 seconds
const cacheTimestamps = new Map<string, number>();

/**
 * Deduplicated fetch function
 * If a request with the same URL is already in progress, returns the existing parsed data promise
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
  
  // Create new request and parse JSON
  const requestPromise = fetch(url, {
    ...options,
    next: { revalidate: 60 }, // Cache for 60 seconds
  })
    .then(async (response) => {
      if (!response.ok) {
        // Remove from cache on error
        requestCache.delete(cacheKey);
        throw new Error(`Failed to fetch: ${response.statusText}`);
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
 * Hook to fetch and manage businesses from the API
 * Automatically removes userId from business data and handles window focus refresh
 * Uses request deduplication to prevent multiple simultaneous identical requests
 * @returns Businesses data, loading state, error, and refetch function
 */
export function useBusinesses(): UseBusinessesResult {
  const [businesses, setBusinesses] = useState<ProCardData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const pathname = usePathname();
  const previousPathnameRef = useRef<string | null>(null);

  const fetchBusinesses = useCallback(async (forceRefresh: boolean = false) => {
    // Cancel previous request if still in flight
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    
    setIsLoading(true);
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
  }, []);

  useEffect(() => {
    fetchBusinesses();

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
  }, [fetchBusinesses]);

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
