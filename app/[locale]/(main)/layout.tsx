'use client';

import { ReactNode, Suspense, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { CategoryProvider, useCategory } from '@/contexts/CategoryContext';
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
  const { isSearchOpen, setIsSearchOpen } = useCategory();

  useEffect(() => {
    setIsSearchOpen(false);
  }, [pathname, setIsSearchOpen]);

  const isBusinessList = pathname?.includes('/businesslist') ?? false;
  const isBlog = pathname?.includes('/blog') ?? false;
  const isBlogArticle = /\/blog\/[^/]+\/?$/.test(pathname ?? '');
  const isProJobs = pathname?.includes('/projobs') ?? false;
  const isQuickRepair = pathname?.includes('/quick-repair') ?? false;
  const keepsMenuVisible =
    isProJobs ||
    (pathname?.includes('/prosuppliers') ?? false) ||
    (pathname?.includes('/proresume') ?? false);
  const collapseMenuForSearch = isSearchOpen && !keepsMenuVisible;
  const useDayCycleBg = isBusinessList;
  const isDynamic = mode === 'dynamic';
  const showSkyBg = useDayCycleBg && isDynamic;

  return (
    <>
      <div
        className={`relative w-full flex justify-center p-2 md:p-0 max-md:min-h-dvh max-md:items-start md:min-h-screen md:items-center ${
          showSkyBg ? 'probot-sky-bg main-layout-sky-mobile-only' : 'bg-white'
        }`}
      >
        {showSkyBg && (
          <div className="absolute inset-0 z-0" aria-hidden>
            <ProBotNevadaMountains />
          </div>
        )}
        <PageContainer transparentBg={showSkyBg}>
          {isBlogArticle ? (
            <div className="flex min-h-full flex-col">
              {children}
              <Footer />
            </div>
          ) : (
            <>
              <div
                className={
                  collapseMenuForSearch
                    ? 'max-md:pointer-events-none max-md:invisible max-md:h-0 max-md:min-h-0 max-md:max-h-0 max-md:overflow-hidden max-md:opacity-0 md:visible md:opacity-100'
                    : 'visible opacity-100'
                }
              >
                <PageHeader />
                <PagesMenu />
              </div>
              <Suspense fallback={<div className="h-[60px] w-full shrink-0 border-b-2 border-black" />}>
                <PageCategories />
              </Suspense>
              <PageContent scroll={isBlog || isQuickRepair} flushTop={isProJobs}>{children}</PageContent>
              <Footer />
            </>
          )}
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
    <CategoryProvider>
      <ChatProvider>
        <WelcomeProvider>
          <BackgroundModeProvider>
            <MainLayoutContent>{children}</MainLayoutContent>
          </BackgroundModeProvider>
        </WelcomeProvider>
      </ChatProvider>
    </CategoryProvider>
  );
}

