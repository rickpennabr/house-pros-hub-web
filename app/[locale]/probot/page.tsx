'use client';

import { useState, useEffect, useRef, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Building2, FolderOpen, Trash2, UserPlus } from 'lucide-react';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { deleteConversation, getVisitorDeleteToken } from '@/lib/api/chat';
import { createLocalePath } from '@/lib/redirect';
import type { Locale } from '@/i18n';
import ProBotSidebar, { type ProBotContact, type ProBotContactAction, type ProBotRecentConversation } from '@/components/probot/ProBotSidebar';
import ProBotChatArea from '@/components/probot/ProBotChatArea';
import { useChat } from '@/contexts/ChatContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAccountSwitch } from '@/contexts/AccountSwitchContext';
import { useProBotHeader } from '@/contexts/ProBotHeaderContext';
import LoadingFallback from '@/components/ui/LoadingFallback';
import { useProBotContacts } from '@/app/[locale]/probot/hooks/useProBotContacts';
import { useProBotPresence } from '@/app/[locale]/probot/hooks/useProBotPresence';
import { useProBotRealtime } from '@/app/[locale]/probot/hooks/useProBotRealtime';
import { adminConversationIdSchema } from '@/lib/schemas/chat';

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
  const conversationParam = searchParams.get('conversation');
  const sharePlaceParam = searchParams.get('sharePlace');
  // Back from the CRM editor: the saved document to attach in the chat (kept in state; the contact effects rewrite the URL).
  const sendEstimateParam = searchParams.get('sendEstimate');
  const sendInvoiceParam = searchParams.get('sendInvoice');
  const docKindParam = searchParams.get('docKind');
  const [pendingDocShare, setPendingDocShare] = useState<{ kind: 'estimate' | 'invoice' | 'payment'; id: string } | null>(() =>
    sendEstimateParam
      ? { kind: 'estimate', id: sendEstimateParam }
      : sendInvoiceParam
        ? { kind: docKindParam === 'payment' ? 'payment' : 'invoice', id: sendInvoiceParam }
        : null
  );
  const tPlaces = useTranslations('places');
  // Keep the place id with the text: the contact effects rewrite the URL (dropping sharePlace) before the chat is ready.
  const [pendingPlaceShare, setPendingPlaceShare] = useState<{ id: string; text: string } | null>(null);
  useEffect(() => {
    if (!sharePlaceParam) return;
    const placeId = sharePlaceParam;
    let cancelled = false;
    fetch(`/api/places/${sharePlaceParam}`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const place = data?.place;
        if (cancelled || !place) return;
        const address = [place.street, [place.city, place.state].filter(Boolean).join(', '), place.zipCode].filter(Boolean).join(' ');
        setPendingPlaceShare({ id: placeId, text: tPlaces('shareMessage', { name: place.name, address }) });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [sharePlaceParam, tPlaces]);
  const { visitorId, conversationId, chatUnreadCount } = useChat();
  const pendingUserContactParamRef = useRef<string | null>(null);
  const { isAuthenticated, user, isLoading: authLoading } = useAuth();
  const [selectedContact, setSelectedContact] = useState<ProBotContact>(PROBOT_CONTACT);
  const tChat = useTranslations('probot');
  const pageLocale = useLocale();
  const [pendingContactDelete, setPendingContactDelete] = useState<ProBotContact | null>(null);
  const [contactActionBusy, setContactActionBusy] = useState(false);
  const [contactActionError, setContactActionError] = useState<string | null>(null);
  const [contactNotice, setContactNotice] = useState<{ title: string; message: string } | null>(null);
  const [chatRefreshKey, setChatRefreshKey] = useState(0);
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
  /** Contractor: opened via /probot?conversation=… until we swap URL to ?contact= */
  const [deepLinkConversation, setDeepLinkConversation] = useState<ProBotRecentConversation | null>(null);
  /** When true, ChatArea shows the welcome (role selection) view; set when user taps "back to welcome" on mobile. */
  const [forceWelcomeView, setForceWelcomeView] = useState(false);
  /** True when user is in a chat (header visible); used for mobile back chevron and hiding sidebar expand tab. */
  const [inChatView, setInChatView] = useState(false);
  const hasSetInitialAdminSelectionRef = useRef(false);
  /** True once we know user role (guest = customer; authenticated = after is-admin check). Prevents welcome flash for admins/contractors. */
  const [roleKnown, setRoleKnown] = useState(() => !isAuthenticated);

  const { setProBotHeader } = useProBotHeader();

  const { activeAccount, setActiveAccountId, businessesLoading } = useAccountSwitch();
  const ownsBusiness = Boolean(user?.businessId) && !isAdmin;
  /** Pros chat with customers only as their business. With the personal profile active they are a customer. */
  const isContractor = ownsBusiness && activeAccount?.type === 'business';
  const asProfileParam = searchParams.get('as');

  // Open the profile the chat or notification belongs to: customer threads → business, pro/ProBot threads → personal.
  // With no target, open whichever profile has unread messages when the active one has none.
  useEffect(() => {
    if (!ownsBusiness || !user?.businessId || businessesLoading || !activeAccount) return;
    const target: 'business' | 'personal' | null =
      asProfileParam === 'business' || asProfileParam === 'personal'
        ? asProfileParam
        : contactParam?.startsWith('customer-') || contactParam?.startsWith('visitor-') || conversationParam
          ? 'business'
          : contactParam
            ? 'personal'
            : null;
    const switchTo = (next: 'business' | 'personal') => {
      if (next === 'business' && activeAccount.type !== 'business') setActiveAccountId(user.businessId!);
      if (next === 'personal' && activeAccount.type !== 'personal') setActiveAccountId(user.id);
    };
    if (target) {
      switchTo(target);
      return;
    }
    let cancelled = false;
    fetch('/api/chat/unread-by-contact', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { business?: number; personal?: number } | null) => {
        if (cancelled || !data) return;
        const mine = activeAccount.type === 'business' ? data.business ?? 0 : data.personal ?? 0;
        const other = activeAccount.type === 'business' ? data.personal ?? 0 : data.business ?? 0;
        if (mine === 0 && other > 0) switchTo(activeAccount.type === 'business' ? 'personal' : 'business');
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // Run once per landing target, not on every switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownsBusiness, businessesLoading, Boolean(activeAccount), asProfileParam, contactParam, conversationParam]);
  const visitorChatUnreadCount = !isAdmin && !isContractor ? chatUnreadCount : 0;

  const { contacts, setContacts, businessIds, customerUserIds, contactById, contactsLoaded } = useProBotContacts({
    isAuthenticated,
    userBusinessId: isContractor ? user?.businessId : undefined,
    asPersonal: ownsBusiness && !isContractor,
  });

  // WhatsApp-style: leaving /probot and coming back reopens the chat that was open, per account and profile.
  const lastContactKey = `hph_probot_last_contact:${user?.id ?? 'guest'}:${isContractor ? 'business' : 'personal'}`;
  const rememberContact = useCallback(
    (value: string | null) => {
      try {
        if (value) window.localStorage.setItem(lastContactKey, value);
        else window.localStorage.removeItem(lastContactKey);
      } catch {
        // storage blocked (private mode): just open ProBot next time
      }
    },
    [lastContactKey]
  );
  /** Account and profile are known, so the saved chat for this profile can be read (holds the welcome screen until then). */
  const lastContactReady = !authLoading && (!ownsBusiness || Boolean(activeAccount));
  const lastContactRestoreDoneRef = useRef(false);
  /** Contact reopened from storage; dropped if it is no longer in this profile's list. */
  const restoredContactRef = useRef<string | null>(null);

  useEffect(() => {
    if (lastContactRestoreDoneRef.current || !lastContactReady) return;
    lastContactRestoreDoneRef.current = true;
    // Links that already say where to go (contact, conversation, notification profile, place share) win.
    if (isAdmin || contactParam || conversationParam || sharePlaceParam || asProfileParam) return;
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(lastContactKey);
    } catch {
      stored = null;
    }
    if (!stored || stored === 'probot') return;
    restoredContactRef.current = stored;
    // A business chat implies the personal profile and a customer chat the business one; stay on the profile in use.
    const impliedProfile = stored.startsWith('customer-') || stored.startsWith('visitor-') ? 'business' : 'personal';
    const keepProfile =
      ownsBusiness && activeAccount && activeAccount.type !== impliedProfile ? `&as=${activeAccount.type}` : '';
    router.replace(`${pathname}?contact=${encodeURIComponent(stored)}${keepProfile}`, { scroll: false });
  }, [lastContactReady, ownsBusiness, activeAccount, isAdmin, contactParam, conversationParam, sharePlaceParam, asProfileParam, lastContactKey, pathname, router]);

  useEffect(() => {
    const restored = restoredContactRef.current;
    if (!restored || !contactsLoaded) return;
    restoredContactRef.current = null;
    if (contactById.has(restored)) return;
    // The saved chat is gone (deleted or no longer listed): forget it and open ProBot.
    rememberContact(null);
    if (contactParam === restored) {
      setSelectedContact(PROBOT_CONTACT);
      router.replace(pathname, { scroll: false });
    }
  }, [contactsLoaded, contactById, contactParam, pathname, router, rememberContact]);

  useEffect(() => {
    // Wait for this profile's own list: right after a profile switch the old list and selection are still showing.
    if (!lastContactRestoreDoneRef.current || isAdmin || !contactsLoaded) return;
    if (selectedContact.isProBot) {
      // The default ProBot on load is not a choice; only an explicit ?contact=probot is.
      if (contactParam === 'probot') rememberContact('probot');
      return;
    }
    // Only chats from this profile's list, so a link that is still switching profiles is not saved under the wrong one.
    if (!contacts.some((contact) => contact.id === selectedContact.id)) return;
    rememberContact(selectedContact.slug ?? selectedContact.id);
  }, [selectedContact, contacts, contactsLoaded, contactParam, isAdmin, rememberContact]);

  /** A message was just sent in the open chat: move it to the top like WhatsApp. */
  const bumpSelectedContactActivity = useCallback(() => {
    const id = selectedContact.id;
    const now = new Date().toISOString();
    setContacts((current) => current.map((contact) => (contact.id === id ? { ...contact, lastActivityAt: now } : contact)));
  }, [selectedContact.id, setContacts]);

  useEffect(() => {
    if (!conversationParam || !isContractor) return;
    const parsed = adminConversationIdSchema.safeParse(conversationParam);
    if (!parsed.success) return;

    let cancelled = false;
    fetch(`/api/chat/admin/conversations/${parsed.data}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.conversation) return;
        const conv = data.conversation as ProBotRecentConversation;
        setAdminViewingConversation(conv);
        setDeepLinkConversation(conv);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [conversationParam, isContractor]);

  useEffect(() => {
    if (!deepLinkConversation || !isContractor) return;

    const contact = getContactForConversation(deepLinkConversation, contacts);
    if (contact) {
      setSelectedContact(contact);
      const param = contact.slug ?? contact.id;
      pendingUserContactParamRef.current = param;
      router.replace(`${pathname}?contact=${encodeURIComponent(param)}`, { scroll: false });
      setDeepLinkConversation(null);
      return;
    }

    const stillOnFallbackContacts =
      isAuthenticated &&
      contacts.length === 2 &&
      contacts[1]?.id === 'santos-general-services';
    if (stillOnFallbackContacts) return;

    const conv = deepLinkConversation;
    const name =
      [conv.profile_first_name, conv.profile_last_name].filter(Boolean).join(' ') ||
      conv.visitor_display_name ||
      'Customer';
    const userId = (conv as { user_id?: string | null }).user_id;
    const synthetic: ProBotContact = {
      id: userId ? `customer-${userId}` : `conversation-${conv.id}`,
      slug: userId ? `customer-${userId}` : undefined,
      name,
      isProBot: false,
      conversationId: conv.id,
    };
    setSelectedContact(synthetic);
    pendingUserContactParamRef.current = synthetic.id;
    router.replace(`${pathname}?contact=${encodeURIComponent(synthetic.id)}`, { scroll: false });
    setDeepLinkConversation(null);
  }, [deepLinkConversation, isContractor, contacts, pathname, router, isAuthenticated]);

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
      // Conversation load for admin/contractor is handled by the effect on selectedContact.conversationId.
      if (!contact.conversationId) {
        setAdminViewingConversation(null);
      }
    },
    [router, pathname]
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
      const isCustomerContact =
        contactParam.startsWith('customer-') || contactParam.startsWith('visitor-');
      // Do not set businessId to a slug — messages are keyed by business UUID.
      // Wait for /api/chat/contacts to resolve the real contact.
      setSelectedContact({
        id: contactParam,
        slug: contactParam,
        name: contactParam,
        isProBot: false,
        ...(isCustomerContact
          ? {}
          : /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
                contactParam
              )
            ? { businessId: contactParam }
            : {}),
      });
    }
  }, [contactParam, contacts, contactById]);

  // Admin/contractor: when a contact with a conversation is selected (click or ?contact= URL),
  // load that thread. Without this, URL selection leaves adminViewingConversation null and the
  // chat shows the empty "Book a ProEstimate" customer view instead of the message history.
  useEffect(() => {
    if (!(isAdmin || isContractor)) return;
    const convId = selectedContact.conversationId;
    if (!convId) {
      setAdminViewingConversation(null);
      return;
    }
    if (adminViewingConversation?.id === convId) return;

    let cancelled = false;
    fetch(`/api/chat/admin/conversations/${convId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.conversation) {
          setAdminViewingConversation(data.conversation as ProBotRecentConversation);
        } else {
          setAdminViewingConversation(null);
        }
      })
      .catch(() => {
        if (!cancelled) setAdminViewingConversation(null);
      });
    return () => {
      cancelled = true;
    };
  }, [
    isAdmin,
    isContractor,
    selectedContact.id,
    selectedContact.conversationId,
    adminViewingConversation?.id,
  ]);

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

  // Confirm admin first. Only an admin loads the history list, so a normal account never hits that route.
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

    fetch('/api/auth/is-admin')
      .then((res) => (res.ok ? res.json() : { isAdmin: false }))
      .then(async (adminData: { isAdmin?: boolean }) => {
        if (cancelled) return;
        setRoleKnown(true);
        const isAdminUser = adminData?.isAdmin === true;
        setIsAdmin(isAdminUser);
        if (!isAdminUser) {
          setRecentConversations(null);
          if (!user?.businessId) setHistoryChatLoading(false);
          return;
        }
        const convRes = await fetch('/api/chat/admin/conversations');
        const convData = convRes.ok ? await convRes.json() : null;
        if (cancelled) return;
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
    rememberContact('probot');
    router.replace(pathname, { scroll: false });
    setSidebarOpen(false);
    setForceWelcomeView(true);
  }, [router, pathname, rememberContact]);

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

  const addContactToCrm = async (contact: ProBotContact) => {
    if (!contact.conversationId) return;
    try {
      const res = await fetch('/api/chat/place-share', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: contact.conversationId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : tChat('placeShareFailed'));
      setContactNotice({
        title: tChat('crmAddedOpen'),
        message: data.placeLinked ? tChat('contactCrmAddedPlace', { name: contact.name }) : tChat('contactCrmAdded', { name: contact.name }),
      });
      if (selectedContact.id === contact.id) setChatRefreshKey((key) => key + 1);
    } catch (err) {
      setContactNotice({ title: tChat('crmAddCustomer'), message: err instanceof Error ? err.message : tChat('placeShareFailed') });
    }
  };

  /** ⋮ menu on each contact. Pros act on customer threads; customers on pros and ProBot. */
  const getContactActions = (contact: ProBotContact): ProBotContactAction[] => {
    const actions: ProBotContactAction[] = [];
    const isCustomerThread = Boolean(contact.conversationId);
    if (isCustomerThread && isContractor) {
      actions.push({
        id: 'crm',
        label: tChat('crmAddCustomer'),
        icon: <UserPlus className="h-4 w-4" />,
        onSelect: () => void addContactToCrm(contact),
      });
      actions.push({
        id: 'crm-open',
        label: tChat('contactOpenCrm'),
        icon: <FolderOpen className="h-4 w-4" />,
        onSelect: () => router.push(createLocalePath(pageLocale as Locale, '/crm/customers')),
      });
    }
    if (!isCustomerThread && !contact.isProBot && (contact.slug || contact.businessId)) {
      actions.push({
        id: 'profile',
        label: tChat('contactViewProfile'),
        icon: <Building2 className="h-4 w-4" />,
        onSelect: () => router.push(createLocalePath(pageLocale as Locale, `/business/${contact.slug || contact.businessId}`)),
      });
    }
    const canDelete = isCustomerThread
      ? isContractor
      : Boolean(conversationId && visitorId && (contact.isProBot || contact.businessId));
    if (canDelete) {
      actions.push({
        id: 'delete',
        label: contact.isProBot ? tChat('contactClearProBot') : tChat('deleteChat'),
        icon: <Trash2 className="h-4 w-4" />,
        destructive: true,
        onSelect: () => {
          setContactActionError(null);
          setPendingContactDelete(contact);
        },
      });
    }
    return actions;
  };

  const performContactDelete = async () => {
    const contact = pendingContactDelete;
    if (!contact || contactActionBusy) return;
    setContactActionBusy(true);
    setContactActionError(null);
    try {
      if (contact.conversationId) {
        const res = await fetch(`/api/chat/contractor/conversations/delete?conversationId=${encodeURIComponent(contact.conversationId)}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : tChat('deleteChatFailed'));
      } else if (conversationId && visitorId) {
        const deleteToken = await getVisitorDeleteToken(visitorId);
        await deleteConversation(conversationId, visitorId, {
          deleteToken,
          ...(contact.isProBot ? { hubOnly: true } : { businessId: contact.businessId }),
        });
      }
      if (!contact.isProBot) {
        setContacts((current) => current.filter((item) => item.id !== contact.id));
        if (selectedContact.id === contact.id) {
          setAdminViewingConversation(null);
          setSelectedContact(PROBOT_CONTACT);
          rememberContact('probot');
          router.replace(pathname, { scroll: false });
        }
      }
      setChatRefreshKey((key) => key + 1);
      setPendingContactDelete(null);
    } catch (err) {
      setContactActionError(err instanceof Error ? err.message : tChat('deleteChatFailed'));
    } finally {
      setContactActionBusy(false);
    }
  };

  return (
    <div className="flex flex-1 min-h-0 w-full overflow-hidden">
      <ConfirmationModal
        isOpen={Boolean(pendingContactDelete)}
        onClose={() => setPendingContactDelete(null)}
        title={pendingContactDelete?.isProBot ? tChat('contactClearProBot') : tChat('deleteChat')}
        message={
          contactActionError ??
          (pendingContactDelete?.isProBot
            ? tChat('contactClearProBotConfirm')
            : tChat('contactDeleteConfirm', { name: pendingContactDelete?.name ?? '' }))
        }
        primaryButton={{
          label: contactActionBusy ? tChat('deleteChatDeleting') : pendingContactDelete?.isProBot ? tChat('contactClearProBot') : tChat('deleteChat'),
          onClick: () => void performContactDelete(),
        }}
        secondaryButton={{ label: tChat('deleteMessageCancel'), onClick: () => setPendingContactDelete(null) }}
      />
      <ConfirmationModal
        isOpen={Boolean(contactNotice)}
        onClose={() => setContactNotice(null)}
        title={contactNotice?.title ?? ''}
        message={contactNotice?.message ?? ''}
        primaryButton={{ label: tChat('contactNoticeOk'), onClick: () => setContactNotice(null) }}
      />
      <ProBotSidebar
        contacts={contacts}
        getContactActions={getContactActions}
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
        onSelectVisitorProBot={!isAdmin ? () => { setSelectedContact(PROBOT_CONTACT); rememberContact('probot'); } : undefined}
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
          roleKnown={roleKnown && lastContactReady}
          contractorBusinessId={isContractor ? user?.businessId ?? undefined : undefined}
          adminViewingConversation={adminViewingConversation}
          onExitAdminConversation={() => setAdminViewingConversation(null)}
          messagesRefreshKey={chatRefreshKey}
          onConversationDeleted={(deletedId) => {
            setContacts((current) => current.filter((contact) => contact.conversationId !== deletedId));
            setAdminViewingConversation(null);
            setSelectedContact(PROBOT_CONTACT);
            rememberContact('probot');
            router.replace(pathname, { scroll: false });
          }}
          onThreadActivity={bumpSelectedContactActivity}
          autoShareDoc={pendingDocShare}
          onAutoShareDone={() => {
            setPendingDocShare(null);
            const next = new URLSearchParams(window.location.search);
            if (next.has('sendEstimate') || next.has('sendInvoice') || next.has('docKind')) {
              next.delete('sendEstimate');
              next.delete('sendInvoice');
              next.delete('docKind');
              const query = next.toString();
              router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
            }
          }}
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
          autoSendMessage={pendingPlaceShare?.text ?? null}
          autoSendPlaceId={pendingPlaceShare?.id ?? null}
          onAutoSent={() => {
            setPendingPlaceShare(null);
            if (searchParams.get('sharePlace')) {
              const next = new URLSearchParams(searchParams.toString());
              next.delete('sharePlace');
              router.replace(`?${next.toString()}`);
            }
          }}
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
