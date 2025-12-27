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
  // State to store our value
  // Pass initial state function to useState so logic is only executed once
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      // Get from local storage by key
      const item = window.localStorage.getItem(key);
      if (!item) {
        return initialValue;
      }
      
      // Try to parse as JSON
      try {
        return JSON.parse(item);
      } catch (parseError) {
        // If parsing fails, check if it's a simple string value that was stored incorrectly
        // This handles cases where old code stored values without JSON.stringify
        const trimmed = item.trim();
        // If it looks like it might be a valid string (wrapped in quotes or simple value)
        // Try to fix it by wrapping in quotes
        if (trimmed && !trimmed.startsWith('{') && !trimmed.startsWith('[') && !trimmed.startsWith('"')) {
          console.warn(`Invalid JSON in localStorage key "${key}". Clearing corrupted value.`);
          // Clear the corrupted value
          window.localStorage.removeItem(key);
          return initialValue;
        }
        // If it already looks like JSON but failed to parse, clear it
        console.error(`Error parsing localStorage key "${key}":`, parseError);
        window.localStorage.removeItem(key);
        return initialValue;
      }
    } catch (error) {
      // If error also return initialValue
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

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
