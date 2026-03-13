'use client';

import { ReactNode, Suspense, useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { CategoryProvider } from '@/contexts/CategoryContext';
import { ChatProvider } from '@/contexts/ChatContext';
import { WelcomeProvider } from '@/contexts/WelcomeContext';
import { BackgroundModeProvider, useBackgroundMode } from '@/contexts/BackgroundModeContext';
import PageContainer from '@/components/pageslayout/PagesContainer';
import PageHeader from '@/components/pageslayout/PagesHeader';
import PagesMenu from '@/components/pageslayout/PagesMenu';
import PageCategories from '@/components/pageslayout/PageCategories';
import PageContent from '@/components/pageslayout/PageContent';
import ProBotNevadaMountains from '@/components/probot/ProBotNevadaMountains';
import BotChatDrawer from '@/components/chat/BotChatDrawer';
import Footer from '@/components/layout/Footer';

function MainLayoutContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { mode } = useBackgroundMode();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isBusinessList = pathname?.includes('/businesslist') ?? false;
  const useDayCycleBg = mounted && isBusinessList;
  const isDynamic = mode === 'dynamic';
  const showSkyBg = useDayCycleBg && isDynamic;

  return (
    <>
      <div
        className={`relative min-h-screen w-full flex items-center justify-center p-2 md:p-0 ${
          showSkyBg ? 'probot-sky-bg main-layout-sky-mobile-only' : 'bg-white'
        }`}
      >
        {showSkyBg && (
          <div className="absolute inset-0 z-0" aria-hidden>
            <ProBotNevadaMountains />
          </div>
        )}
        <PageContainer transparentBg={showSkyBg}>
          <PageHeader />
          <PagesMenu />
          <PageCategories />
          <PageContent>{children}</PageContent>
          <Footer />
        </PageContainer>
        <Suspense fallback={null}>
          <BotChatDrawer />
        </Suspense>
      </div>
    </>
  );
}

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <CategoryProvider>
        <ChatProvider>
          <WelcomeProvider>
            <BackgroundModeProvider>
              <MainLayoutContent>{children}</MainLayoutContent>
            </BackgroundModeProvider>
          </WelcomeProvider>
        </ChatProvider>
      </CategoryProvider>
    </Suspense>
  );
}

