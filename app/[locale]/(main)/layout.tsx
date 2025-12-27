'use client';

import { ReactNode } from 'react';
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
  return (
    <CategoryProvider>
      <div className="min-h-screen w-full flex items-center justify-center p-2 md:p-0 bg-black md:bg-transparent">
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

