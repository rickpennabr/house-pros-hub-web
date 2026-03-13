'use client';

import { useState, useEffect, useRef, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import ProBotSidebar, { type ProBotContact, type ProBotRecentConversation } from '@/components/probot/ProBotSidebar';
import ProBotChatArea from '@/components/probot/ProBotChatArea';
import { useChat } from '@/contexts/ChatContext';
import { useAuth } from '@/contexts/AuthContext';
import { useProBotHeader } from '@/contexts/ProBotHeaderContext';
import LoadingFallback from '@/components/ui/LoadingFallback';
import { useProBotContacts } from '@/app/[locale]/probot/hooks/useProBotContacts';
import { useProBotPresence } from '@/app/[locale]/probot/hooks/useProBotPresence';
import { useProBotRealtime } from '@/app/[locale]/probot/hooks/useProBotRealtime';

const PROBOT_CONTACT: ProBotContact = {
  id: 'probot',
  name: 'ProBot',
  isProBot: true,
};

/** Find the contact that represents this conversation (for highlighting in Contacts and URL). */
function getContactForConversation(
  conv: ProBotRecentConversation,
  contacts: ProBotContact[]
): ProBotContact | undefined {
  if (conv.business_id) {
    return contacts.find((c) => c.businessId === conv.business_id);
  }
  const userId = (conv as { user_id?: string }).user_id;
  return contacts.find(
    (c) => c.conversationId === conv.id || (userId && c.id === `customer-${userId}`)
  );
}

/** Merge conversationId onto business contacts so each has the conversation id for selection/URL. */
function mergeConversationIdsIntoContacts(
  contacts: ProBotContact[],
  conversations: ProBotRecentConversation[]
): ProBotContact[] {
  return contacts.map((c) => {
    if (c.businessId) {
      const conv = conversations.find((r) => r.business_id === c.businessId);
      return conv ? { ...c, conversationId: conv.id } : c;
    }
    return c;
  });
}

function ProBotPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const contactParam = searchParams.get('contact');
  const { visitorId, conversationId, chatUnreadCount } = useChat();
  const pendingUserContactParamRef = useRef<string | null>(null);
  const { isAuthenticated, user } = useAuth();
  const [selectedContact, setSelectedContact] = useState<ProBotContact>(PROBOT_CONTACT);
  const [recentConversations, setRecentConversations] = useState<ProBotRecentConversation[] | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminViewingConversation, setAdminViewingConversation] = useState<ProBotRecentConversation | null>(null);
  const [unreadConversationIds, setUnreadConversationIds] = useState<Set<string>>(new Set());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [visitorProBotHasMessages, setVisitorProBotHasMessages] = useState(false);
  const [visitorProBotPreview, setVisitorProBotPreview] = useState<string | undefined>(undefined);
  const [visitorProBotLastMessageTime, setVisitorProBotLastMessageTime] = useState<string | undefined>(undefined);
  const [historyChatLoading, setHistoryChatLoading] = useState(false);
  const [contractorUnreadCount, setContractorUnreadCount] = useState(0);
  const [contractorConversations, setContractorConversations] = useState<ProBotRecentConversation[] | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  /** When true, ChatArea shows the welcome (role selection) view; set when user taps "back to welcome" on mobile. */
  const [forceWelcomeView, setForceWelcomeView] = useState(false);
  /** True when user is in a chat (header visible); used for mobile back chevron and hiding sidebar expand tab. */
  const [inChatView, setInChatView] = useState(false);
  const hasSetInitialAdminSelectionRef = useRef(false);
  /** True once we know user role (guest = customer; authenticated = after is-admin check). Prevents welcome flash for admins/contractors. */
  const [roleKnown, setRoleKnown] = useState(() => !isAuthenticated);

  const { setProBotHeader } = useProBotHeader();

  const isContractor = Boolean(user?.businessId);
  const visitorChatUnreadCount = !isAdmin && !isContractor ? chatUnreadCount : 0;

  const { contacts, setContacts, businessIds, customerUserIds, contactById } = useProBotContacts({
    isAuthenticated,
    userBusinessId: user?.businessId,
  });

  const { hubOnline, setHubOnline, fetchHubPresence, HUB_PRESENCE_POLL_MS, VISITOR_HEARTBEAT_MS } = useProBotPresence(
    businessIds,
    customerUserIds,
    isAdmin,
    isContractor,
    user?.businessId,
    setContacts
  );

  const onContractorNewMessage = useCallback(() => setContractorUnreadCount((prev) => prev + 1), []);
  useProBotRealtime({
    isAdmin,
    isContractor,
    soundEnabled,
    adminViewingConversationId: adminViewingConversation?.id ?? null,
    contractorBusinessId: user?.businessId,
    onAdminNewMessage: () => {},
    onContractorNewMessage,
    setRecentConversations,
    setUnreadConversationIds,
    setContractorConversations,
    setContacts,
  });

  const handleSelectContact = useCallback(
    (contact: ProBotContact) => {
      setForceWelcomeView(false);
      const contactParamValue = contact.slug ?? contact.id;
      setSelectedContact(contact);
      setSidebarOpen(false);
      // Mark that user chose this contact so the URL-sync effect doesn't revert to the previous ?contact= (e.g. History Chat's contact) when contacts/contactById update.
      pendingUserContactParamRef.current = contactParamValue;
      router.replace(`${pathname}?contact=${encodeURIComponent(contactParamValue)}`, { scroll: false });
      if (contact.conversationId && (isAdmin || isContractor)) {
        // Load this contact's conversation and set it. Do NOT clear adminViewingConversation first:
        // clearing would make the chat area fall back to the visitor's own ProBot thread (wrong conversation).
        fetch(`/api/chat/admin/conversations/${contact.conversationId}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data?.conversation) {
              setAdminViewingConversation(data.conversation as ProBotRecentConversation);
            } else {
              setAdminViewingConversation(null);
            }
          })
          .catch(() => setAdminViewingConversation(null));
      } else {
        // ProBot or contact with no conversation: clear so chat area shows visitor ProBot or empty.
        setAdminViewingConversation(null);
      }
    },
    [isAdmin, isContractor, router, pathname]
  );

  // Sync URL ?contact= to selectedContact. When user clicks a contact we update state + URL; do not override with the old URL until the URL has updated (pendingUserContactParamRef).
  // Use stub contact when ?contact= is set but contacts not yet loaded so we don't flash ProBot then switch to business.
  useEffect(() => {
    if (pendingUserContactParamRef.current !== null) {
      if (contactParam !== pendingUserContactParamRef.current) return; // URL not updated yet; don't override user's selection
      pendingUserContactParamRef.current = null;
    }
    if (!contactParam) return;
    const byId = contactById.get(contactParam);
    if (byId) {
      setSelectedContact(byId);
      return;
    }
    const bySlug = contacts.find(
      (c) =>
        !c.isProBot &&
        (c.slug === contactParam || c.id === contactParam || c.businessId === contactParam)
    );
    if (bySlug) {
      setSelectedContact(bySlug);
      return;
    }
    if (contactParam !== 'probot') {
      setSelectedContact({
        id: contactParam,
        slug: contactParam,
        name: contactParam,
        isProBot: false,
        businessId: contactParam,
      });
    }
  }, [contactParam, contacts, contactById]);

  // When ProBot is selected, poll hub presence (for ProBot online indicator)
  useEffect(() => {
    if (selectedContact?.id !== 'probot') return;
    fetchHubPresence();
    const interval = setInterval(fetchHubPresence, HUB_PRESENCE_POLL_MS);
    return () => clearInterval(interval);
  }, [selectedContact?.id, fetchHubPresence]);

  // Visitor heartbeat when on ProBot (for hub presence)
  useEffect(() => {
    if (selectedContact?.id !== 'probot' || !visitorId) return;
    const heartbeat = () => {
      fetch('/api/chat/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'visitor', visitorId }),
      }).catch(() => {});
    };
    heartbeat();
    const interval = setInterval(heartbeat, VISITOR_HEARTBEAT_MS);
    return () => clearInterval(interval);
  }, [selectedContact?.id, visitorId]);

  // When conversation is cleared (e.g. sign out), reset visitor ProBot state so sidebar is clean
  useEffect(() => {
    if (!conversationId && !isAdmin) {
      setVisitorProBotHasMessages(false);
      setVisitorProBotPreview(undefined);
      setVisitorProBotLastMessageTime(undefined);
    }
  }, [conversationId, isAdmin]);

  // When authenticated, load admin status and History Chat in parallel (best practice: avoid waterfall)
  useEffect(() => {
    if (!isAuthenticated) {
      setRecentConversations(null);
      setContractorConversations(null);
      setHistoryChatLoading(false);
      setRoleKnown(true);
      return;
    }
    setRoleKnown(false);
    let cancelled = false;
    setHistoryChatLoading(true);
    const conversationsPromise = fetch('/api/chat/admin/conversations').then((res) => (res.ok ? res.json() : null));
    const isAdminPromise = fetch('/api/auth/is-admin').then((res) => (res.ok ? res.json() : { isAdmin: false }));

    Promise.all([isAdminPromise, conversationsPromise])
      .then(([adminData, convData]) => {
        if (cancelled) return;
        setRoleKnown(true);
        const isAdminUser = adminData?.isAdmin === true;
        setIsAdmin(isAdminUser);
        if (!isAdminUser) {
          setRecentConversations(null);
          if (!user?.businessId) setHistoryChatLoading(false);
          return;
        }
        if (convData?.conversations?.length) {
          const list = (convData.conversations.slice(0, 20) ?? []) as ProBotRecentConversation[];
          setRecentConversations(list);
          setUnreadConversationIds(new Set(list.filter((c) => (c.unread_count ?? 0) > 0).map((c) => c.id)));
        } else {
          setRecentConversations([]);
          setUnreadConversationIds(new Set());
        }
        setHistoryChatLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setRoleKnown(true);
          setRecentConversations(null);
          setHistoryChatLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.businessId]);

  // Admin: merge conversationId onto business contacts; default to last chat (not ProBot) once.
  useEffect(() => {
    if (!isAdmin || !recentConversations?.length) return;
    const merged = mergeConversationIdsIntoContacts(contacts, recentConversations);
    const mergeChanged = merged.some(
      (c, i) => contacts[i]?.conversationId !== c.conversationId
    );
    if (mergeChanged) setContacts(merged);
    if (hasSetInitialAdminSelectionRef.current) return;
    hasSetInitialAdminSelectionRef.current = true;
    const first = recentConversations[0]!;
    const contact = getContactForConversation(first, merged);
    setAdminViewingConversation(first);
    setSelectedContact(contact ?? PROBOT_CONTACT);
    const param = (contact?.slug ?? contact?.id) ?? 'probot';
    pendingUserContactParamRef.current = param;
    router.replace(`${pathname}?contact=${encodeURIComponent(param)}`, { scroll: false });
  }, [isAdmin, recentConversations, contacts, pathname, router, setContacts]);

  // Reset initial-selection flag when admin logs out so next login gets default again.
  useEffect(() => {
    if (!isAuthenticated) hasSetInitialAdminSelectionRef.current = false;
  }, [isAuthenticated]);

  // When contractor, load their conversations for History Chat list
  useEffect(() => {
    if (!isContractor) return;
    let cancelled = false;
    setHistoryChatLoading(true);
    fetch('/api/chat/contractor/conversations')
      .then((res) => (res.ok ? res.json() : { conversations: [] }))
      .then((data) => {
        if (cancelled) return;
        const list = (data.conversations ?? []) as ProBotRecentConversation[];
        setContractorConversations(list.slice(0, 20));
        setUnreadConversationIds(new Set(list.filter((c) => (c.unread_count ?? 0) > 0).map((c) => c.id)));
      })
      .catch(() => {
        if (!cancelled) setContractorConversations([]);
      })
      .finally(() => {
        if (!cancelled) setHistoryChatLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isContractor]);

  // Sync contractor unread from context (single source); realtime still does optimistic +1 below
  useEffect(() => {
    if (isContractor) setContractorUnreadCount(chatUnreadCount);
  }, [isContractor, chatUnreadCount]);

  // Wire layout header: on mobile when in chat show back chevron that goes to ProBot welcome page.
  const onBackToWelcome = useCallback(() => {
    setSelectedContact(PROBOT_CONTACT);
    router.replace(pathname, { scroll: false });
    setSidebarOpen(false);
    setForceWelcomeView(true);
  }, [router, pathname]);

  useEffect(() => {
    setProBotHeader({ inChat: inChatView, onBackToWelcome });
  }, [inChatView, onBackToWelcome, setProBotHeader]);

  // When contractor opens a conversation, refetch unread count and History Chat list after messages load (and get marked read)
  useEffect(() => {
    if (!isContractor || !adminViewingConversation?.id) return;
    const t = setTimeout(() => {
      Promise.all([
        fetch('/api/chat/contractor/unread-count').then((res) => (res.ok ? res.json() : { count: 0 })),
        fetch('/api/chat/contractor/conversations').then((res) => (res.ok ? res.json() : { conversations: [] })),
      ])
        .then(([unreadData, convData]) => {
          setContractorUnreadCount(typeof unreadData.count === 'number' ? unreadData.count : 0);
          const list = (convData.conversations ?? []) as ProBotRecentConversation[];
          if (list.length > 0) {
            setContractorConversations(list.slice(0, 20));
            setUnreadConversationIds(new Set(list.filter((c) => (c.unread_count ?? 0) > 0).map((c) => c.id)));
          }
        })
        .catch(() => {});
    }, 2500);
    return () => clearTimeout(t);
  }, [isContractor, adminViewingConversation?.id]);

  return (
    <div className="flex flex-1 min-h-0 w-full overflow-hidden">
      <ProBotSidebar
        contacts={contacts}
        selectedContactId={selectedContact.id}
        onSelectContact={handleSelectContact}
        inChatView={inChatView}
        hubOnline={selectedContact?.id === 'probot' ? hubOnline : undefined}
        recentConversations={isAdmin ? recentConversations : contractorConversations ?? null}
        selectedConversationIdForAdmin={adminViewingConversation?.id ?? null}
        onSelectConversation={(id) => {
          const list = isAdmin ? recentConversations : contractorConversations;
          const conv = list?.find((c) => c.id === id) ?? null;
          setAdminViewingConversation(conv);
          if (conv && (isAdmin || isContractor)) {
            const contact = getContactForConversation(conv, contacts);
            if (contact) {
              setSelectedContact(contact);
              const param = contact.slug ?? contact.id;
              pendingUserContactParamRef.current = param;
              router.replace(`${pathname}?contact=${encodeURIComponent(param)}`, { scroll: false });
            }
          }
          setUnreadConversationIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          if (isAdmin && recentConversations?.length) {
            setRecentConversations(
              recentConversations.map((c) => (c.id === id ? { ...c, unread_count: 0 } : c))
            );
          }
          if (isContractor && contractorConversations?.length) {
            setContractorConversations(
              contractorConversations.map((c) => (c.id === id ? { ...c, unread_count: 0 } : c))
            );
          }
        }}
        unreadCount={isAdmin ? (recentConversations?.reduce((s, c) => s + (c.unread_count ?? 0), 0) ?? 0) : isContractor ? contractorUnreadCount : 0}
        unreadConversationIds={isAdmin ? unreadConversationIds : undefined}
        visitorProBotConversation={!isAdmin && (conversationId && (visitorProBotHasMessages || visitorChatUnreadCount > 0 || visitorProBotPreview)) ? { id: conversationId ?? '', preview: visitorProBotPreview, lastMessageTime: visitorProBotLastMessageTime, unread: visitorChatUnreadCount > 0, unreadCount: visitorChatUnreadCount } : null}
        visitorUnreadCount={!isAdmin ? visitorChatUnreadCount : 0}
        onSelectVisitorProBot={!isAdmin ? () => setSelectedContact(PROBOT_CONTACT) : undefined}
        historyChatLoading={historyChatLoading}
        sidebarOpen={sidebarOpen}
        onSidebarOpenChange={setSidebarOpen}
      />
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        <ProBotChatArea
          selectedContact={selectedContact}
          hubOnline={selectedContact?.id === 'probot' ? hubOnline : undefined}
          isAdmin={isAdmin}
          isContractor={isContractor}
          roleKnown={roleKnown}
          contractorBusinessId={user?.businessId ?? undefined}
          adminViewingConversation={adminViewingConversation}
          onExitAdminConversation={() => setAdminViewingConversation(null)}
          onVisitorProBotHasMessages={!isAdmin ? setVisitorProBotHasMessages : undefined}
          onVisitorProBotLastMessage={!isAdmin ? (preview, lastMessageTime) => { setVisitorProBotPreview(preview); setVisitorProBotLastMessageTime(lastMessageTime); } : undefined}
          onAdminReplySent={isAdmin ? () => {
            fetch('/api/chat/admin/conversations')
              .then((res) => (res.ok ? res.json() : { conversations: [] }))
              .then((data) => {
                if (data.conversations?.length) {
                  setRecentConversations(data.conversations.slice(0, 20));
                }
              })
              .catch(() => {});
          } : undefined}
          focusInputTrigger={contactParam ?? undefined}
          onOpenSidebar={!isAdmin ? () => setSidebarOpen(true) : undefined}
          forceWelcomeView={forceWelcomeView}
          onChatViewChange={setInChatView}
          onWelcomeChoiceMade={() => setForceWelcomeView(false)}
        />
      </div>
    </div>
  );
}

export default function ProBotPage() {
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <Suspense fallback={<LoadingFallback />}>
        <ProBotPageContent />
      </Suspense>
    </div>
  );
}
