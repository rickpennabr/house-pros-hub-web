'use client';

import { useEffect, useMemo } from 'react';
import ProBotMessageBubble from './ProBotMessageBubble';
import type { ChatMessage } from '@/lib/types/chat';
import type { ProBotContact, ProBotRecentConversation } from './ProBotSidebar';

/** Dedupe by id so React keys are unique (e.g. when merging conversations or after refetch). */
function dedupeMessagesById(messages: ChatMessage[]): ChatMessage[] {
  const seen = new Set<string>();
  return messages.filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}

interface ProBotMessageListProps {
  messages: ChatMessage[];
  /** When set, we scroll this container to the end instead of scrollIntoView (avoids page/window scroll on mobile). */
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
  isAdminView: boolean;
  adminViewingConversation: ProBotRecentConversation | null;
  selectedContact: ProBotContact | null;
  visitorAvatarUrl: string | null;
}

export default function ProBotMessageList({
  messages,
  scrollContainerRef,
  isAdminView,
  adminViewingConversation,
  selectedContact,
  visitorAvatarUrl,
}: ProBotMessageListProps) {
  const uniqueMessages = useMemo(() => dedupeMessagesById(messages), [messages]);

  // Scroll to end when messages change. Use scroll container ref so only the messages panel scrolls (no page scroll on mobile).
  useEffect(() => {
    const container = scrollContainerRef?.current;
    if (container && uniqueMessages.length > 0) {
      const scrollToEnd = () => {
        container.scrollTop = container.scrollHeight - container.clientHeight;
      };
      requestAnimationFrame(scrollToEnd);
    }
  }, [uniqueMessages, scrollContainerRef]);

  return (
    <div className="p-4 space-y-3 min-h-0">
      {uniqueMessages.map((msg) => (
        <ProBotMessageBubble
          key={msg.id}
          msg={msg}
          isAdminView={isAdminView}
          adminViewingConversation={adminViewingConversation}
          selectedContact={selectedContact}
          visitorAvatarUrl={visitorAvatarUrl}
        />
      ))}
    </div>
  );
}
