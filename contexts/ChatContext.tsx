'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import '@/components/security/CsrfFetchPatch';
import { useAuth } from '@/contexts/AuthContext';
import { runWhileVisible } from '@/lib/utils/runWhileVisible';

const VISITOR_ID_KEY = 'probot_visitor_id';

export type ChatOpenChoice = 'account_estimate' | null;

const CHAT_UNREAD_POLL_MS = 30_000;

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
  /** Clear conversation and reset visitor id so chat shows fresh state (e.g. after sign out). */
  clearChat: () => void;
  /** ProBot unread count (single source, polled by provider). Admin/contractor/visitor depending on auth. */
  chatUnreadCount: number;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [initialChoiceForDrawer, setInitialChoiceForDrawer] = useState<ChatOpenChoice>(null);
  const [visitorId, setVisitorId] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);

  const { user, isAdmin } = useAuth();
  const isContractor = !isAdmin && !!user?.businessId;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/chat/visitor-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({}),
        });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && typeof data.visitorId === 'string' && data.visitorId) {
          try {
            localStorage.setItem(VISITOR_ID_KEY, data.visitorId);
          } catch {
            // localStorage can be unavailable
          }
          setVisitorId(data.visitorId);
          return;
        }
      } catch {
        // Leave visitor id empty until the session endpoint succeeds.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const url =
          isAdmin || isContractor
            ? '/api/notifications/unread-count'
            : visitorId
              ? `/api/notifications/unread-count?visitorId=${encodeURIComponent(visitorId)}`
              : null;
        if (!url) return;
        const res = await fetch(url, { cache: 'no-store', credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (typeof data.count === 'number') setChatUnreadCount(data.count);
        }
      } catch {
        // ignore
      }
    };
    return runWhileVisible(fetchUnread, CHAT_UNREAD_POLL_MS);
  }, [isAdmin, isContractor, visitorId]);

  // Sync app icon badge (e.g. iPhone home screen) with unread count. Supported in iOS 16.4+ PWA.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('setAppBadge' in navigator)) return;
    const nav = navigator as Navigator & { setAppBadge?: (count: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    if (chatUnreadCount > 0) {
      nav.setAppBadge?.(Math.min(chatUnreadCount, 99));
    } else {
      nav.clearAppBadge?.();
    }
  }, [chatUnreadCount]);

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

  const clearChat = useCallback(() => {
    setConversationId(null);
    void (async () => {
      try {
        const res = await fetch('/api/chat/visitor-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ rotate: true }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && typeof data.visitorId === 'string' && data.visitorId) {
          try {
            localStorage.setItem(VISITOR_ID_KEY, data.visitorId);
          } catch {
            // localStorage can be unavailable
          }
          setVisitorId(data.visitorId);
          return;
        }
      } catch {
        // Keep the previous id when the server cannot rotate the cookie.
      }
    })();
  }, [setConversationId]);

  const prevUserRef = useRef<unknown>(undefined);
  useEffect(() => {
    const hadUser = prevUserRef.current != null;
    prevUserRef.current = user;
    if (hadUser && user === null) clearChat();
  }, [user, clearChat]);

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
        clearChat,
        chatUnreadCount,
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

/** Admin signup notifications render outside ChatProvider and do not need chat state. */
export function useOptionalChat() {
  return useContext(ChatContext);
}
