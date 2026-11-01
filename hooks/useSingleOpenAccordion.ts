import { useState, useCallback } from 'react';

/**
 * Standard accordion behavior across the app:
 * - On load: only the section at `defaultOpenKey` is open.
 * - When the user opens a section: that section opens and all others close (only one open at a time).
 * - When the user clicks the currently open section: it closes (no section open).
 *
 * Use this hook wherever you have multiple Accordion sections that should behave as a single-open group.
 *
 * @param keys - All accordion keys in order (used to build initial state).
 * @param defaultOpenKey - The key that is open on initial load.
 */
export function useSingleOpenAccordion<T extends string>(
  keys: readonly T[],
  defaultOpenKey: T
) {
  const [openKey, setOpenKey] = useState<T | null>(defaultOpenKey);

  const toggle = useCallback((key: T) => {
    setOpenKey((prev) => (prev === key ? null : key));
  }, []);

  const isOpen = useCallback(
    (key: T) => openKey === key,
    [openKey]
  );

  return { openKey, toggle, isOpen };
}
