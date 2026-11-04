'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

interface CRMChromeContextValue {
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  customerCount: number | null;
  setCustomerCount: (count: number | null) => void;
}

const CRMChromeContext = createContext<CRMChromeContextValue | null>(null);

export function CRMChromeProvider({ children }: { children: ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [customerCount, setCustomerCount] = useState<number | null>(null);
  const value = useMemo(
    () => ({ searchOpen, setSearchOpen, customerCount, setCustomerCount }),
    [searchOpen, customerCount],
  );
  return (
    <CRMChromeContext.Provider value={value}>
      {children}
    </CRMChromeContext.Provider>
  );
}

/** Null outside CRM, so shared tables can ignore it. */
export function useCRMChrome() {
  return useContext(CRMChromeContext);
}
