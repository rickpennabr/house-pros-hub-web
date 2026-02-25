'use client';

import { ReactNode, Suspense } from 'react';
import { usePathname } from 'next/navigation';
import { CategoryProvider } from '@/contexts/CategoryContext';
import { ChatProvider } from '@/contexts/ChatContext';
import { WelcomeProvider } from '@/contexts/WelcomeContext';
import PageContainer from '@/components/pageslayout/PagesContainer';
import PageHeader from '@/components/pageslayout/PagesHeader';
import PagesMenu from '@/components/pageslayout/PagesMenu';
import PageCategories from '@/components/pageslayout/PageCategories';
import PageContent from '@/components/pageslayout/PageContent';
import BotFloatingButton from '@/components/pageslayout/BotFloatingButton';
import ProBotWelcomeOverlay from '@/components/pageslayout/ProBotWelcomeOverlay';
import BotChatDrawer from '@/components/chat/BotChatDrawer';
import Footer from '@/components/layout/Footer';

export default function MainLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isMapView = pathname?.includes('/mapview') ?? false;

  return (
    <Suspense fallback={null}>
      <CategoryProvider>
        <ChatProvider>
          <WelcomeProvider>
            <ProBotWelcomeOverlay />
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
                {!isMapView && <BotFloatingButton />}
                <Footer />
              </PageContainer>
              <Suspense fallback={null}>
                <BotChatDrawer />
              </Suspense>
            </div>
          </WelcomeProvider>
        </ChatProvider>
      </CategoryProvider>
    </Suspense>
  );
}

