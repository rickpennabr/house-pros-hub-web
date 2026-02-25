'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

const VISITOR_ID_KEY = 'probot_visitor_id';

/** Generate a UUID; uses crypto.randomUUID when available, else getRandomValues or a simple fallback for older mobile browsers. */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6]! & 0x0f) | 0x40;
    bytes[8] = (bytes[8]! & 0x3f) | 0x80;
    const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getOrCreateVisitorId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem(VISITOR_ID_KEY);
  if (!id) {
    id = generateUUID();
    localStorage.setItem(VISITOR_ID_KEY, id);
  }
  return id;
}

export type ChatOpenChoice = 'account_estimate' | null;

interface ChatContextType {
  isOpen: boolean;
  openChat: () => void;
  /** Open chat and go straight to the in-chat estimate/signup flow (no navigation to /estimate). */
  openChatWithEstimate: () => void;
  closeChat: () => void;
  visitorId: string;
  conversationId: string | null;
  setConversationId: (id: string | null) => void;
  /** Set by drawer when it consumes the initial choice; used so estimate flow stays in chat. */
  initialChoiceForDrawer: ChatOpenChoice;
  clearInitialChoiceForDrawer: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [initialChoiceForDrawer, setInitialChoiceForDrawer] = useState<ChatOpenChoice>(null);
  const [visitorId, setVisitorId] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);

  useEffect(() => {
    setVisitorId(getOrCreateVisitorId());
  }, []);

  const openChat = useCallback(() => {
    setInitialChoiceForDrawer(null);
    setIsOpen(true);
  }, []);
  const openChatWithEstimate = useCallback(() => {
    setInitialChoiceForDrawer('account_estimate');
    setIsOpen(true);
  }, []);
  const closeChat = useCallback(() => setIsOpen(false), []);
  const clearInitialChoiceForDrawer = useCallback(() => setInitialChoiceForDrawer(null), []);

  return (
    <ChatContext.Provider
      value={{
        isOpen,
        openChat,
        openChatWithEstimate,
        closeChat,
        visitorId,
        conversationId,
        setConversationId,
        initialChoiceForDrawer,
        clearInitialChoiceForDrawer,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}
