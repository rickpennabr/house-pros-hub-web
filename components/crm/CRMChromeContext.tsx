'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

interface CRMChromeContextValue {
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  customerCount: number | null;
  setCustomerCount: (count: number | null) => void;
  /** Desktop header slot. The dashboard search portals into this on large screens. */
  headerSearchEl: HTMLDivElement | null;
  setHeaderSearchEl: (el: HTMLDivElement | null) => void;
  /** Name of the open menu item, shown centered in the desktop header. */
  pageTitle: string | null;
  setPageTitle: (title: string | null) => void;
}

const CRMChromeContext = createContext<CRMChromeContextValue | null>(null);

export function CRMChromeProvider({ children }: { children: ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [customerCount, setCustomerCount] = useState<number | null>(null);
  const [headerSearchEl, setHeaderSearchEl] = useState<HTMLDivElement | null>(null);
  const [pageTitle, setPageTitle] = useState<string | null>(null);
  const value = useMemo(
    () => ({ searchOpen, setSearchOpen, customerCount, setCustomerCount, headerSearchEl, setHeaderSearchEl, pageTitle, setPageTitle }),
    [searchOpen, customerCount, headerSearchEl, pageTitle],
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
