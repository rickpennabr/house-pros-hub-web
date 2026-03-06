'use client';

import { ReactNode } from 'react';
import { ChatProvider } from '@/contexts/ChatContext';
import PageContainer from '@/components/pageslayout/PagesContainer';
import PageHeader from '@/components/pageslayout/PagesHeader';
import LegalTabs from '@/components/pageslayout/LegalTabs';
import Footer from '@/components/layout/Footer';

export default function LegalLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ChatProvider>
      <div className="min-h-screen w-full flex items-center justify-center p-2 md:p-0 bg-white">
        <PageContainer>
          <PageHeader />
          <LegalTabs />
          <div className="flex-1 overflow-y-hidden">
            {children}
          </div>
          <Footer />
        </PageContainer>
      </div>
    </ChatProvider>
  );
}

