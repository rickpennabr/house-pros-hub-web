'use client';

import { ReactNode } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { CategoryProvider } from '@/contexts/CategoryContext';
import PageContainer from '@/components/pageslayout/PagesContainer';
import PageHeader from '@/components/pageslayout/PagesHeader';
import PagesMenu from '@/components/pageslayout/PagesMenu';
import PageCategories from '@/components/pageslayout/PageCategories';
import PageContent from '@/components/pageslayout/PageContent';
import Footer from '@/components/layout/Footer';

export default function MainLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { getThemeClasses, theme } = useTheme();
  const backgroundClass = getThemeClasses('background');

  // Mobile: Black background, Desktop: Theme background
  // For colorful theme: black on mobile, animated background on desktop
  // For default theme: black on mobile, transparent on desktop
  // Use separate classes for mobile/desktop to avoid conflicts
  const backgroundClasses = theme === 'colorful' 
    ? 'bg-black md:color-changing-bg'
    : 'bg-black md:bg-transparent';

  return (
    <CategoryProvider>
      <div className={`min-h-screen w-full flex items-center justify-center p-2 md:p-0 ${backgroundClasses}`}>
        {/* Hidden color-changing element for color detection on mobile - always present for sync */}
        {theme === 'colorful' && (
          <div className="color-changing-bg fixed w-1 h-1 opacity-0 pointer-events-none -z-50" aria-hidden="true" />
        )}
        <PageContainer>
          <PageHeader>
          </PageHeader>
          <PagesMenu>
          </PagesMenu>
          <PageCategories>
          </PageCategories>
          <PageContent>
            {children}
          </PageContent>
          <Footer />
        </PageContainer>
      </div>
    </CategoryProvider>
  );
}

