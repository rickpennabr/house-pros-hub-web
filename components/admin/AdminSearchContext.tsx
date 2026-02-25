'use client';

import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react';

interface AdminSearchContextValue {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onSearchChange?: (query: string) => void;
}

const AdminSearchContext = createContext<AdminSearchContextValue | null>(null);

export function AdminSearchProvider({
  children,
  onSearchChange,
}: {
  children: ReactNode;
  onSearchChange?: (query: string) => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearchChange?.(searchQuery);
      debounceRef.current = null;
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, onSearchChange]);

  const setQuery = useCallback((query: string) => setSearchQuery(query), []);

  return (
    <AdminSearchContext.Provider
      value={{ searchQuery, setSearchQuery: setQuery, onSearchChange }}
    >
      {children}
    </AdminSearchContext.Provider>
  );
}

export function useAdminSearch() {
  const ctx = useContext(AdminSearchContext);
  return ctx ?? { searchQuery: '', setSearchQuery: () => {} };
}
