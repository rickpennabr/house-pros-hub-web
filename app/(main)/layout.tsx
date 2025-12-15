'use client';

import { ReactNode } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { CategoryProvider } from '@/contexts/CategoryContext';
import PageContainer from '@/components/pageslayout/PagesContainer';
import PageHeader from '@/components/pageslayout/PagesHeader';
import PagesMenu from '@/components/pageslayout/PagesMenu';
import PageCategories from '@/components/pageslayout/PageCategories';
import PageContent from '@/components/pageslayout/PageContent';

export default function MainLayout({
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
    <CategoryProvider>
      <div className={`min-h-screen w-full flex items-center justify-center p-2 md:p-0 ${backgroundClasses}`}>
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
        </PageContainer>
      </div>
    </CategoryProvider>
  );
}

