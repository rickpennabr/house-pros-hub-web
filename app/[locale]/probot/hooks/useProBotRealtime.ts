'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { playNotificationSound } from '@/lib/utils/notificationSound';
import type { ProBotContact, ProBotRecentConversation } from '@/components/probot/ProBotSidebar';

interface UseProBotRealtimeArgs {
  isAdmin: boolean;
  isContractor: boolean;
  soundEnabled: boolean;
  adminViewingConversationId: string | null;
  contractorBusinessId: string | undefined;
  onAdminNewMessage: (conversationId: string) => void;
  onContractorNewMessage: () => void;
  setRecentConversations: React.Dispatch<React.SetStateAction<ProBotRecentConversation[] | null>>;
  setUnreadConversationIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setContractorConversations: React.Dispatch<React.SetStateAction<ProBotRecentConversation[] | null>>;
  setContacts: React.Dispatch<React.SetStateAction<ProBotContact[]>>;
}

export function useProBotRealtime({
  isAdmin,
  isContractor,
  soundEnabled,
  adminViewingConversationId,
  contractorBusinessId,
  onAdminNewMessage,
  onContractorNewMessage,
  setRecentConversations,
  setUnreadConversationIds,
  setContractorConversations,
  setContacts,
}: UseProBotRealtimeArgs) {
  const supabase = useRef(createClient()).current;
  const adminViewingIdRef = useRef<string | null>(null);
  adminViewingIdRef.current = adminViewingConversationId;
  const contractorBusinessIdRef = useRef<string | undefined>(contractorBusinessId);
  contractorBusinessIdRef.current = contractorBusinessId;

  useEffect(() => {
    if (!isAdmin) return;
    if (typeof window !== 'undefined' && !window.isSecureContext) return;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel('probot_messages_admin')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'probot_messages' },
          (payload) => {
            const row = payload.new as { sender?: string; conversation_id?: string };
            if (row.sender !== 'visitor' || !row.conversation_id) return;
            const viewingId = adminViewingIdRef.current;
            if (soundEnabled) playNotificationSound();
            setUnreadConversationIds((prev) => {
              const next = new Set(prev);
              if (viewingId !== row.conversation_id) next.add(row.conversation_id as string);
              return next;
            });
            fetch('/api/chat/admin/conversations')
              .then((res) => (res.ok ? res.json() : { conversations: [] }))
              .then((data) => {
                if (data.conversations?.length) {
                  const list = (data.conversations.slice(0, 20) ?? []) as ProBotRecentConversation[];
                  setRecentConversations(list);
                  setUnreadConversationIds(new Set(list.filter((c) => (c.unread_count ?? 0) > 0).map((c) => c.id)));
                }
              })
              .catch(() => {});
          }
        );
      channel.subscribe();
    } catch {
      // WebSocket not available
    }
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [isAdmin, soundEnabled, supabase, setRecentConversations, setUnreadConversationIds]);

  useEffect(() => {
    if (!isContractor || !contractorBusinessIdRef.current) return;
    if (typeof window !== 'undefined' && !window.isSecureContext) return;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel('probot_messages_contractor')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'probot_messages' },
          (payload) => {
            const row = payload.new as { sender?: string; business_id?: string | null; conversation_id?: string };
            if (row.sender !== 'visitor' || row.business_id !== contractorBusinessIdRef.current) return;
            if (soundEnabled) playNotificationSound();
            onContractorNewMessage();
            Promise.all([
              fetch('/api/chat/contacts').then((res) => (res.ok ? res.json() : { contacts: [] })),
              fetch('/api/chat/contractor/conversations').then((res) => (res.ok ? res.json() : { conversations: [] })),
            ])
              .then(([contactsData, convData]) => {
                const list = (contactsData.contacts ?? []) as ProBotContact[];
                if (list.length > 0) {
                  const bid = contractorBusinessIdRef.current;
                  setContacts(
                    bid ? list.map((c) => (c.businessId === bid ? { ...c, online: true } : c)) : list
                  );
                }
                const convList = (convData.conversations ?? []) as ProBotRecentConversation[];
                if (convList.length > 0) {
                  setContractorConversations(convList.slice(0, 20));
                  setUnreadConversationIds(new Set(convList.filter((c) => (c.unread_count ?? 0) > 0).map((c) => c.id)));
                }
              })
              .catch(() => {});
          }
        );
      channel.subscribe();
    } catch {
      // WebSocket not available
    }
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [
    isContractor,
    soundEnabled,
    supabase,
    onContractorNewMessage,
    setContacts,
    setContractorConversations,
    setUnreadConversationIds,
  ]);
}
