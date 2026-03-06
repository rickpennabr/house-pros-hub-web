'use client';

import { ReactNode } from 'react';
import { CRMHeader } from './CRMHeader';
import { CRMSidebar } from './CRMSidebar';

interface CRMLayoutProps {
  children: ReactNode;
  locale: string;
}

export function CRMLayout({ children, locale }: CRMLayoutProps) {
  return (
    <div className="w-full min-h-screen flex flex-col bg-white overflow-y-auto md:overflow-hidden md:h-screen">
      <CRMHeader locale={locale} />
      <div className="flex flex-col md:flex-row md:flex-1 md:min-h-0 md:overflow-hidden">
        <CRMSidebar locale={locale} />
        <main className="flex-1 min-w-0 bg-white flex flex-col md:overflow-y-auto pt-0 md:pt-0">
          <div className="px-2 md:px-[100px] md:py-4 flex-1">{children}</div>
        </main>
      </div>
    </div>
  );
}
