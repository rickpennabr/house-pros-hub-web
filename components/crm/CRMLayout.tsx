'use client';

import { ReactNode, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { CRMHeader } from './CRMHeader';
import { CRMSidebar } from './CRMSidebar';
import { CRMChromeProvider, useCRMChrome } from './CRMChromeContext';

interface CRMLayoutProps {
  children: ReactNode;
  locale: string;
}

function CRMLayoutFrame({ children, locale }: CRMLayoutProps) {
  const pathname = usePathname();
  const chrome = useCRMChrome();
  const searchOpen = chrome?.searchOpen ?? false;
  const setSearchOpen = chrome?.setSearchOpen;

  useEffect(() => {
    setSearchOpen?.(false);
  }, [pathname, setSearchOpen]);

  const collapsed =
    'max-md:pointer-events-none max-md:invisible max-md:h-0 max-md:min-h-0 max-md:max-h-0 max-md:overflow-hidden max-md:opacity-0 max-md:border-0';

  return (
    <div className="w-full min-h-screen flex flex-col bg-white overflow-y-auto md:overflow-hidden md:h-screen">
      <div className={searchOpen ? collapsed : undefined}>
        <CRMHeader locale={locale} />
      </div>
      <div className="flex flex-col md:flex-row md:flex-1 md:min-h-0 md:overflow-hidden">
        <CRMSidebar locale={locale} mobileCollapsed={searchOpen} />
        <main className="flex-1 min-w-0 bg-white flex flex-col md:overflow-y-auto pt-0 md:pt-0">
          <div className="px-2 md:px-[100px] md:py-3 flex-1">{children}</div>
        </main>
      </div>
    </div>
  );
}

export function CRMLayout({ children, locale }: CRMLayoutProps) {
  return (
    <CRMChromeProvider>
      <CRMLayoutFrame locale={locale}>{children}</CRMLayoutFrame>
    </CRMChromeProvider>
  );
}
