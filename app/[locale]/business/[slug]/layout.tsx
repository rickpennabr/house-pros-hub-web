'use client';

import { ReactNode, Suspense } from 'react';
import { ChatProvider } from '@/contexts/ChatContext';
import { WelcomeProvider } from '@/contexts/WelcomeContext';
import BotFloatingButton from '@/components/pageslayout/BotFloatingButton';
import BotChatDrawer from '@/components/chat/BotChatDrawer';

export default function BusinessDetailsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ChatProvider>
      <WelcomeProvider initialVisible={false}>
        <div className="min-h-screen w-full flex items-center justify-center p-2 md:p-0 bg-white">
          <div className="w-full max-w-[960px] min-h-screen mx-auto border-2 border-black bg-white md:my-2 md:rounded-lg md:h-[calc(100vh-1rem)] overflow-y-auto overflow-x-hidden flex flex-col min-h-0">
            {children}
          </div>
        </div>
        <BotFloatingButton />
        <Suspense fallback={null}>
          <BotChatDrawer />
        </Suspense>
      </WelcomeProvider>
    </ChatProvider>
  );
}
