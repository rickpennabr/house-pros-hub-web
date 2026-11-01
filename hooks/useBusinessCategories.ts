'use client';

import { useEffect, useState } from 'react';

const CACHE_MS = 60_000;

let cachedCategories: { at: number; categories: string[] } | null = null;
let inFlight: Promise<string[]> | null = null;

async function loadCategories(): Promise<string[]> {
  const now = Date.now();
  if (cachedCategories && now - cachedCategories.at < CACHE_MS) {
    return cachedCategories.categories;
  }
  if (inFlight) return inFlight;

  inFlight = fetch('/api/businesses/categories')
    .then(async (response) => {
      if (!response.ok) return [];
      const data = (await response.json()) as { categories?: string[] };
      const categories = Array.isArray(data.categories) ? data.categories : [];
      cachedCategories = { at: Date.now(), categories };
      return categories;
    })
    .catch(() => cachedCategories?.categories ?? [])
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

/**
 * Category chips for the directory. One small cached request, not the full catalog.
 */
export function useBusinessCategories(): { categories: string[]; isLoading: boolean } {
  const [categories, setCategories] = useState<string[]>(cachedCategories?.categories ?? []);
  const [isLoading, setIsLoading] = useState(!cachedCategories);

  useEffect(() => {
    let cancelled = false;
    loadCategories().then((next) => {
      if (cancelled) return;
      setCategories(next);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { categories, isLoading };
}
