'use client';

import { ReactNode } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import PageContainer from '@/components/pageslayout/PagesContainer';
import PageHeader from '@/components/pageslayout/PagesHeader';
import Footer from '@/components/layout/Footer';

export default function LegalLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { getThemeClasses, theme } = useTheme();
  const backgroundClass = getThemeClasses('background');

  // Mobile: Black background, Desktop: Theme background
  const backgroundClasses = theme === 'colorful' 
    ? 'bg-black md:color-changing-bg'
    : 'bg-black md:bg-transparent';

  return (
    <div className={`min-h-screen w-full flex items-center justify-center p-2 md:p-0 ${backgroundClasses}`}>
      <PageContainer>
        <PageHeader>
        </PageHeader>
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
        <Footer />
      </PageContainer>
    </div>
  );
}

