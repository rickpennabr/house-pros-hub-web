'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * Generic typed localStorage hook
 * Handles SSR safely and provides error handling
 * @param key - The localStorage key
 * @param initialValue - Initial value if key doesn't exist
 * @returns Tuple of [storedValue, setValue]
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void] {
  // Always start with initialValue so server and client first render match (avoids hydration mismatch).
  // We sync from localStorage in useEffect after mount.
  const [storedValue, setStoredValue] = useState<T>(initialValue);

  // After mount, read from localStorage and sync state (client-only).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const item = window.localStorage.getItem(key);
      if (!item) return;
      try {
        const parsed = JSON.parse(item) as T;
        setStoredValue(parsed);
      } catch (parseError) {
        const trimmed = item.trim();
        if (trimmed && !trimmed.startsWith('{') && !trimmed.startsWith('[') && !trimmed.startsWith('"')) {
          console.warn(`Invalid JSON in localStorage key "${key}". Clearing corrupted value.`);
          window.localStorage.removeItem(key);
        } else {
          console.error(`Error parsing localStorage key "${key}":`, parseError);
          window.localStorage.removeItem(key);
        }
      }
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
    }
  }, [key]);

  // Return a wrapped version of useState's setter function that
  // persists the new value to localStorage.
  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        // Allow value to be a function so we have same API as useState
        const valueToStore = value instanceof Function ? value(storedValue) : value;
        // Save state
        setStoredValue(valueToStore);
        // Save to local storage
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        }
      } catch (error) {
        // A more advanced implementation would handle the error case
        console.error(`Error saving to localStorage key "${key}":`, error);
      }
    },
    [key, storedValue]
  );

  // Sync with localStorage changes from other tabs/windows
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue) {
        try {
          setStoredValue(JSON.parse(e.newValue));
        } catch (error) {
          console.error(`Error parsing localStorage value for key "${key}":`, error);
          // On error, reset to initialValue
          setStoredValue(initialValue);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [key, initialValue]);

  return [storedValue, setValue];
}
