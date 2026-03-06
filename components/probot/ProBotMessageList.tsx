'use client';

import { useRef, useEffect } from 'react';
import ProBotMessageBubble from './ProBotMessageBubble';
import type { ChatMessage } from '@/lib/types/chat';
import type { ProBotContact, ProBotRecentConversation } from './ProBotSidebar';

interface ProBotMessageListProps {
  messages: ChatMessage[];
  isAdminView: boolean;
  adminViewingConversation: ProBotRecentConversation | null;
  selectedContact: ProBotContact | null;
  visitorAvatarUrl: string | null;
}

export default function ProBotMessageList({
  messages,
  isAdminView,
  adminViewingConversation,
  selectedContact,
  visitorAvatarUrl,
}: ProBotMessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="p-4 space-y-3">
      {messages.map((msg) => (
        <ProBotMessageBubble
          key={msg.id}
          msg={msg}
          isAdminView={isAdminView}
          adminViewingConversation={adminViewingConversation}
          selectedContact={selectedContact}
          visitorAvatarUrl={visitorAvatarUrl}
        />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}
