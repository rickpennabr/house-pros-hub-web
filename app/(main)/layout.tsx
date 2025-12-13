import { ReactNode } from 'react';
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
  return (
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
  );
}

