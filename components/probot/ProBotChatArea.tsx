'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import Image from 'next/image';
import { Building2, CreditCard, FileText, FolderOpen, Receipt, Trash2, ArrowLeft, User, CalendarDays, Check, UserPlus, Home as HomeIcon, Loader2 } from 'lucide-react';
import { useChat } from '@/contexts/ChatContext';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import Modal from '@/components/ui/Modal';
import { useAuth } from '@/contexts/AuthContext';
import ChatSignupForm from '@/components/chat/ChatSignupForm';
import ChatEstimateForm from '@/components/chat/ChatEstimateForm';
import ChatInputBar from '@/components/chat/ChatInputBar';
import ChatCrmDocPicker, { type ChatCrmDocKind } from '@/components/chat/ChatCrmDocPicker';
import ChatQuickDocComposer, { type QuickDocKind } from '@/components/chat/ChatQuickDocComposer';
import { createEstimateShare, createInvoiceShare, type SharedCrmDoc } from '@/lib/chat/crm-doc-share';
import { ChatCamFrame } from '@/components/chat/ChatCamFrame';
import AddCustomerForm from '@/components/chat/AddCustomerForm';
import ProEstimateBookingFlow from '@/components/probot/ProEstimateBookingFlow';
import { PROBOT_ASSETS, PROBOT_CHAT_BG } from '@/lib/constants/probot';
import ProBotMessageList from './ProBotMessageList';
import { ProBotCrmViews, type ProBotCrmViewType } from './ProBotCrmViews';
import type { ProBotContact, ProBotRecentConversation } from './ProBotSidebar';
import type { ChatMessage, ChatAttachment } from '@/lib/types/chat';
import { chatReplyFromMessage } from '@/lib/types/chat';
import { ChatPendingAttachments, type JobProjectOption } from './ChatPendingAttachments';
import { uploadProDriveFile } from '@/lib/drive/upload-client';
import { requestCurrentLocation } from '@/lib/media/capture-location';
import {
  createConversation,
  deleteConversation,
  getMessages,
  getVisitorDeleteToken,
  sendAdminMessage,
  sendMessage as sendMessageApi,
} from '@/lib/api/chat';
import { useChatThreadRefresh } from '@/hooks/useChatThreadRefresh';

export type { ChatMessage, ChatAttachment };

type UserChoice = null | 'create_account' | 'free_estimate' | 'add_customer' | 'book_proestimate';

interface ProBotChatAreaProps {
  selectedContact: ProBotContact | null;
  /** When true/false, show ProBot online/offline in header; undefined = hide */
  hubOnline?: boolean | null;
  /** When admin: viewing/replying to this conversation in the chat area */
  isAdmin?: boolean;
  /** When contractor viewing a customer conversation: send replies as this business */
  isContractor?: boolean;
  /** False until role is known (avoids welcome flash for admins/contractors while is-admin check runs). Omit/true = show welcome when customer. */
  roleKnown?: boolean;
  contractorBusinessId?: string;
  adminViewingConversation?: ProBotRecentConversation | null;
  onExitAdminConversation?: () => void;
  /** When visitor viewing ProBot: called when messages are loaded so parent can show History only if there are messages */
  onVisitorProBotHasMessages?: (hasMessages: boolean) => void;
  /** When visitor viewing ProBot: called with last message preview and time for History Chat sidebar */
  onVisitorProBotLastMessage?: (preview: string | undefined, lastMessageTime: string | undefined) => void;
  /** When admin sends a reply: called so parent can refetch conversation list (sidebar shows last message + time) */
  onAdminReplySent?: () => void;
  /** When set (e.g. contact slug from URL), focus the message input once the chat view is ready */
  focusInputTrigger?: string | null;
  /** When provided (e.g. for guests), call to open the contacts sidebar from the welcome CTA */
  onOpenSidebar?: () => void;
  /** When true, force the welcome (role selection) view to show (e.g. after "back to welcome" on mobile) */
  forceWelcomeView?: boolean;
  /** Called when the user is in chat view (header visible) vs welcome view, so layout can show back chevron on mobile */
  onChatViewChange?: (inChat: boolean) => void;
  /** Called when user makes a choice on the welcome screen (e.g. Create account, Get estimate) so parent can clear forceWelcomeView */
  onWelcomeChoiceMade?: () => void;
  /** Sent once as the customer when a pro chat is ready (e.g. sharing a place from My Places). */
  autoSendMessage?: string | null;
  /** Attach this My Places property as a share card on the auto-sent message. */
  autoSendPlaceId?: string | null;
  onAutoSent?: () => void;
  /** Pro deleted this customer/visitor chat from their inbox. */
  onConversationDeleted?: (conversationId: string) => void;
  /** Bump to reload the open thread (e.g. after a contact menu delete). */
  messagesRefreshKey?: number;
  /** A message was sent in the open chat, so the page can move it to the top of the contact list. */
  onThreadActivity?: () => void;
  /** Back from the CRM editor with a saved document: post it in this chat as a card. */
  autoShareDoc?: { kind: QuickDocKind; id: string } | null;
  onAutoShareDone?: () => void;
}

const TYPING_MS = 60;
const WHERE_START_TYPING_MS = 45;

/** Persisted so welcome (hi, how do you want to start) shows only once per device. Bump version to re-show. */
const PROBOT_WELCOME_SEEN_KEY = 'probot_has_seen_welcome';
const PROBOT_WELCOME_SEEN_VERSION = '1';

function markProBotWelcomeSeen(): void {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(PROBOT_WELCOME_SEEN_KEY, PROBOT_WELCOME_SEEN_VERSION);
  } catch {
    // ignore
  }
}

/** Dedupe by id so React keys are unique (e.g. merged conversations or refetch races). */
function dedupeMessagesById(messages: ChatMessage[]): ChatMessage[] {
  const seen = new Set<string>();
  return messages.filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}

/**
 * Customer view: ProBot hub = untagged messages; a business contact = that business's thread.
 * Pro replies saved without business_id (older rows, or a failed insert retry) belong to the business
 * the customer last wrote to. File them there only, never in ProBot too, and show them as that business.
 */
function filterMessagesForContact(
  messages: ChatMessage[],
  contact: ProBotContact
): ChatMessage[] {
  let activeBusiness: string | undefined;
  const threadOf = new Map<string, string | undefined>();
  for (const m of messages) {
    const bid = m.business_id ?? undefined;
    if (m.sender === 'visitor') activeBusiness = bid;
    const explicitHub = m.admin_sent_as === 'probot' || m.admin_sent_as === 'hub_agent';
    threadOf.set(m.id, bid ?? (m.sender === 'admin' && !explicitHub ? activeBusiness : undefined));
  }
  if (contact.isProBot) {
    return messages.filter((m) => !threadOf.get(m.id));
  }
  const businessId = contact.businessId;
  if (!businessId) return messages;
  return messages
    .filter((m) => threadOf.get(m.id) === businessId)
    .map((m) => (m.business_id ? m : { ...m, business_id: businessId }));
}

export default function ProBotChatArea({
  selectedContact,
  hubOnline,
  isAdmin,
  isContractor,
  roleKnown = true,
  contractorBusinessId,
  adminViewingConversation,
  onExitAdminConversation,
  onVisitorProBotHasMessages,
  onVisitorProBotLastMessage,
  onAdminReplySent,
  focusInputTrigger,
  autoSendMessage,
  autoSendPlaceId,
  onAutoSent,
  onConversationDeleted,
  messagesRefreshKey = 0,
  onThreadActivity,
  autoShareDoc = null,
  onAutoShareDone,
  onOpenSidebar,
  forceWelcomeView = false,
  onChatViewChange,
  onWelcomeChoiceMade,
}: ProBotChatAreaProps) {
  const t = useTranslations('probot');
  const tPlaces = useTranslations('places');
  const tBot = useTranslations('bot');
  const tSuccess = useTranslations('estimate.success');
  const locale = useLocale();
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { visitorId, conversationId, setConversationId } = useChat();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pendingDelete, setPendingDelete] = useState<ChatMessage | null>(null);
  const [confirmDeleteChat, setConfirmDeleteChat] = useState(false);
  const [deletingChat, setDeletingChat] = useState(false);
  const [crmAdd, setCrmAdd] = useState<{ status: 'idle' | 'adding' | 'done' | 'error'; error?: string; conversationId?: string }>({ status: 'idle' });
  type SharePlaceOption = { id: string; name: string; street: string | null; city: string | null; state: string | null; zipCode: string | null; photoUrl: string | null };
  const [placePickerOpen, setPlacePickerOpen] = useState(false);
  const [myPlaces, setMyPlaces] = useState<SharePlaceOption[] | null>(null);
  const [myPlacesError, setMyPlacesError] = useState<string | null>(null);
  const [bookingInvite, setBookingInvite] = useState<import('@/lib/types/chat').ChatBookingInvite | null>(null);
  const [hubAgent, setHubAgent] = useState<{ displayName: string; avatarUrl: string | null } | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
  const [jobProjects, setJobProjects] = useState<JobProjectOption[]>([]);
  const [savedToProject, setSavedToProject] = useState<Record<string, string>>({});
  const [savingProjectUrl, setSavingProjectUrl] = useState<string | null>(null);
  const fileByUrl = useRef<Map<string, File>>(new Map());
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [crmPickerKind, setCrmPickerKind] = useState<ChatCrmDocKind | null>(null);
  const [crmCustomerId, setCrmCustomerId] = useState<string | null>(null);
  /** In-chat quick estimate / invoice / payment request form. */
  const [composerKind, setComposerKind] = useState<QuickDocKind | null>(null);
  const [uploadingAttach, setUploadingAttach] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  /** The scrolling messages panel; the message list keeps it pinned to the newest message. */
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const [confirmingStepId, setConfirmingStepId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [agentStatus, setAgentStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hiTypedLength, setHiTypedLength] = useState(0);
  const [whereStartTypedLength, setWhereStartTypedLength] = useState(0);
  const [messagesLoadedOnce, setMessagesLoadedOnce] = useState(false);
  const [hasChosenThisVisit, setHasChosenThisVisit] = useState(false);
  const [hasSeenWelcomePersisted] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem(PROBOT_WELCOME_SEEN_KEY) === PROBOT_WELCOME_SEEN_VERSION;
    } catch {
      return false;
    }
  });
  const [userChoice, setUserChoice] = useState<UserChoice>(null);
  const [estimateSubmitted, setEstimateSubmitted] = useState(false);
  const [showProjectInfoForm, setShowProjectInfoForm] = useState(false);
  const [projectEstimateSubmitted, setProjectEstimateSubmitted] = useState(false);
  const [estimateFormKey, setEstimateFormKey] = useState(0);
  const [signupStepIndex, setSignupStepIndex] = useState(0);
  const [addCustomerSubmitted, setAddCustomerSubmitted] = useState(false);
  /** Guest contact info for free_estimate flow (no account); then show estimate form */
  const [guestContact, setGuestContact] = useState<{
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    streetAddress: string;
    city: string;
    state: string;
    zipCode: string;
    apartment?: string;
  } | null>(null);
  /** Guest contact for Book a ProEstimate when not signed in (separate from free_estimate) */
  const [bookingGuestContact, setBookingGuestContact] = useState<{
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    streetAddress: string;
    city: string;
    state: string;
    zipCode: string;
    apartment?: string;
  } | null>(null);
  const [clearingMessages, setClearingMessages] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  /** 0–3: segment of welcome animation (0,2 = first GIF; 1,3 = second GIF). After 2 cycles show static. */
  const [welcomeGifStep, setWelcomeGifStep] = useState(0);
  const [welcomeShowStaticImage, setWelcomeShowStaticImage] = useState(false);
  /** When set, show this CRM flow inline in ProBot (contractor only). */
  const [probotCrmView, setProbotCrmView] = useState<ProBotCrmViewType | null>(null);

  /** Duration each welcome GIF shows before switching. Animation runs 2 full cycles then shows static image. */
  const WELCOME_GIF_0_MS = 5000;
  const WELCOME_GIF_1_MS = 5000;

  const showSignupForm = userChoice === 'create_account' && !estimateSubmitted && !showProjectInfoForm;
  const showEstimateSuccess = userChoice === 'create_account' && estimateSubmitted && !showProjectInfoForm && !projectEstimateSubmitted;
  const showProjectInfoFormView =
    (userChoice === 'create_account' && showProjectInfoForm && !projectEstimateSubmitted) ||
    (userChoice === 'free_estimate' && (guestContact !== null || isAuthenticated) && !projectEstimateSubmitted);
  const showProjectEstimateSuccess =
    (userChoice === 'create_account' && showProjectInfoForm && projectEstimateSubmitted) ||
    (userChoice === 'free_estimate' && projectEstimateSubmitted);
  const showGuestContactForm = userChoice === 'free_estimate' && guestContact === null && !isAuthenticated;
  const showAccountEstimateFlow =
    selectedContact?.isProBot &&
    (showSignupForm ||
      showGuestContactForm ||
      showEstimateSuccess ||
      showProjectInfoFormView ||
      showProjectEstimateSuccess);
  const showAddCustomerFlow = selectedContact?.isProBot && userChoice === 'add_customer' && !addCustomerSubmitted;
  const showAddCustomerSuccess = selectedContact?.isProBot && userChoice === 'add_customer' && addCustomerSubmitted;
  /** Book a ProEstimate: when chatting with a business, show calendar → time → confirm (or guest form first if not signed in) */
  const showBookingGuestForm =
    !selectedContact?.isProBot &&
    selectedContact?.businessId &&
    userChoice === 'book_proestimate' &&
    !isAuthenticated &&
    bookingGuestContact === null;
  const showBookingFlow =
    !selectedContact?.isProBot &&
    selectedContact?.businessId &&
    userChoice === 'book_proestimate' &&
    (isAuthenticated || bookingGuestContact !== null);
  const showProBotWizardFlow =
    showAccountEstimateFlow || showAddCustomerFlow || showAddCustomerSuccess || showBookingGuestForm || showBookingFlow;

  const displayName = user?.firstName ?? t('guestName');
  const hiText = t('hiUser', { name: displayName });
  const howDoYouWantToStartText = t('howDoYouWantToStart');
  const businessId = selectedContact?.isProBot ? undefined : selectedContact?.businessId;

  const loadConversation = useCallback(async () => {
    if (!visitorId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { conversationId: cid } = await createConversation(visitorId);
      setConversationId(cid);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [visitorId, setConversationId]);

  useEffect(() => {
    if (!visitorId) setLoading(false);
  }, [visitorId]);

  useEffect(() => {
    if (adminViewingConversation) return;
    loadConversation();
  }, [loadConversation, adminViewingConversation]);

  // After sign-in, re-resolve so the account thread (and its history) is used instead of a guest cookie thread.
  useEffect(() => {
    if (adminViewingConversation || !isAuthenticated || !user?.id || !visitorId) return;
    let cancelled = false;
    void (async () => {
      try {
        const { conversationId: cid } = await createConversation(visitorId);
        if (!cancelled) setConversationId(cid);
      } catch {
        // Keep the current conversation if resolve fails.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adminViewingConversation, isAuthenticated, user?.id, visitorId, setConversationId]);

  const loadMessages = useCallback(async () => {
    if (!conversationId || !visitorId) return;
    try {
      const data = await getMessages(conversationId, {
        visitorId,
        credentials: 'include',
        ...((locale === 'en' || locale === 'pt' || locale === 'es') ? { locale } : {}),
      });
      const msgs = (data.messages ?? []) as ChatMessage[];
      const estimateBody = t('replyAccountEstimate');
      const withLink = msgs.map((m) =>
        m.sender === 'admin' && m.body === estimateBody
          ? {
              ...m,
              replyLinkUrl: `/${locale}/estimate`,
              replyLinkLabel: t('replyAccountEstimateLink'),
            }
          : m
      );
      setMessages(dedupeMessagesById(withLink));
      setHubAgent(data.hubAgent ?? null);
      setMessagesLoadedOnce(true);
      setError(null);
    } catch (e) {
      setMessages([]);
      setHubAgent(null);
      setMessagesLoadedOnce(true);
      setError(e instanceof Error ? e.message : t('sendUnavailable'));
    }
  }, [conversationId, visitorId, t, locale]);

  const confirmEstimate = useCallback(async (stepId: string) => {
    if (!visitorId || !conversationId || confirmingStepId) return;
    setConfirmingStepId(stepId);
    setError(null);
    try {
      const res = await fetch('/api/chat/agent/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          visitorId,
          stepId,
          ...((locale === 'en' || locale === 'pt' || locale === 'es') ? { locale } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : t('confirmEstimateFailed'));
        return;
      }
      await loadMessages();
    } catch {
      setError(t('confirmEstimateFailed'));
    } finally {
      setConfirmingStepId(null);
    }
  }, [visitorId, conversationId, confirmingStepId, locale, loadMessages, t]);

  const loadAdminViewMessages = useCallback(async () => {
    if (!adminViewingConversation?.id) return;
    try {
      const data = await getMessages(adminViewingConversation.id, { credentials: 'include' });
      const msgs = (data.messages ?? []) as ChatMessage[];
      setMessages(dedupeMessagesById(msgs));
      setHubAgent(null);
      setMessagesLoadedOnce(true);
    } catch {
      setMessages([]);
      setHubAgent(null);
      setMessagesLoadedOnce(true);
    }
  }, [adminViewingConversation?.id]);

  useEffect(() => {
    if (adminViewingConversation) {
      setMessages([]);
      setLoading(false);
    }
  }, [adminViewingConversation?.id]);

  useEffect(() => {
    if (adminViewingConversation) {
      loadAdminViewMessages();
    } else {
      loadMessages();
    }
  }, [adminViewingConversation, loadMessages, loadAdminViewMessages, messagesRefreshKey]);

  const refreshOpenThread = useCallback(() => {
    if (adminViewingConversation?.id) {
      void loadAdminViewMessages();
    } else {
      void loadMessages();
    }
  }, [adminViewingConversation?.id, loadAdminViewMessages, loadMessages]);

  useChatThreadRefresh(
    adminViewingConversation?.id ?? conversationId,
    Boolean(adminViewingConversation?.id || (conversationId && visitorId)),
    refreshOpenThread
  );

  // When conversation is cleared (e.g. sign out), reset message state so UI shows welcome
  useEffect(() => {
    if (!adminViewingConversation && !conversationId) {
      setMessages([]);
      setMessagesLoadedOnce(false);
    }
  }, [conversationId, adminViewingConversation]);

  const isAdminView = Boolean((isAdmin || isContractor) && adminViewingConversation);
  /** A pro (not the hub admin) replying in a customer thread. */
  const isProReplying = isAdminView && !isAdmin;

  useEffect(() => {
    if (!isAdminView || !isContractor) {
      setCrmCustomerId(null);
      return;
    }
    const portalUserId =
      (selectedContact?.id.startsWith('customer-')
        ? selectedContact.id.slice('customer-'.length)
        : null) ||
      adminViewingConversation?.user_id ||
      null;
    if (!portalUserId) {
      setCrmCustomerId(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/crm/customers/by-portal-user?userId=${encodeURIComponent(portalUserId)}`, {
      credentials: 'include',
    })
      .then((res) => res.json())
      .then((data: { customer?: { id: string } | null }) => {
        if (!cancelled) setCrmCustomerId(data.customer?.id ?? null);
      })
      .catch(() => {
        if (!cancelled) setCrmCustomerId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdminView, isContractor, selectedContact?.id, adminViewingConversation?.user_id]);

  const filteredMessages = isAdminView
    ? messages
    : selectedContact
      ? filterMessagesForContact(messages, selectedContact)
      : [];

  // Notify parent so History Chat only shows ProBot when this conversation has at least one message
  useEffect(() => {
    if (!onVisitorProBotHasMessages || isAdminView || !selectedContact?.isProBot || !messagesLoadedOnce) return;
    onVisitorProBotHasMessages(filteredMessages.length > 0);
  }, [onVisitorProBotHasMessages, isAdminView, selectedContact?.isProBot, messagesLoadedOnce, filteredMessages.length]);

  // Persist "welcome seen" when user already has messages (returning user) so welcome doesn't show again
  useEffect(() => {
    if (selectedContact?.isProBot && messagesLoadedOnce && filteredMessages.length > 0) markProBotWelcomeSeen();
  }, [selectedContact?.isProBot, messagesLoadedOnce, filteredMessages.length]);

  // Notify parent of last message (preview + time) for visitor's History Chat sidebar under "ProBot"
  useEffect(() => {
    if (!onVisitorProBotLastMessage || isAdminView || !selectedContact?.isProBot) return;
    const last = filteredMessages.length > 0
      ? filteredMessages.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
      : null;
    onVisitorProBotLastMessage(last?.body?.trim() ?? undefined, last?.created_at ?? undefined);
  }, [onVisitorProBotLastMessage, isAdminView, selectedContact?.isProBot, filteredMessages]);

  // When ProBot is selected, show conversation if we have messages; otherwise show welcome steps.
  // Show welcome for visitors, customers, and contractors when role is known (not admin view), and when there are no messages.
  // For guests: always show welcome when they open ProBot. For signed-in customers: once per device (localStorage).
  // For contractors: always show welcome when no messages so they always see "Hi {name}", "How do you want to start?" and CRM buttons.
  const isCustomer = !isAdmin && !isContractor;
  const showWelcome =
    (roleKnown &&
      !isAdminView &&
      selectedContact?.isProBot &&
      !error &&
      !hasChosenThisVisit &&
      filteredMessages.length === 0 &&
      userChoice !== 'add_customer' &&
      (isContractor || !hasSeenWelcomePersisted || !isAuthenticated)) ||
    forceWelcomeView;

  // Admin initial screen: ProBot selected, no conversation open, no messages yet. Show simplified welcome (no "How do you want to start?", no CTA buttons, different tagline/placeholder).
  const showAdminInitialWelcome =
    isAdmin &&
    selectedContact?.isProBot &&
    !adminViewingConversation &&
    filteredMessages.length === 0 &&
    messagesLoadedOnce;

  // When a business contact is selected with no messages yet (e.g. from card Message button), show centered chat like ProBot welcome.
  const showBusinessEmptyChat =
    !isAdminView &&
    selectedContact != null &&
    !selectedContact.isProBot &&
    !loading &&
    !error &&
    filteredMessages.length === 0 &&
    messagesLoadedOnce;

  // Notify parent when user is in chat view (chat header visible) vs welcome, for mobile header back chevron.
  const inChatView = ((!showWelcome && !showAdminInitialWelcome) || isAdminView) && !!selectedContact;
  useEffect(() => {
    onChatViewChange?.(inChatView);
  }, [inChatView, onChatViewChange]);

  useEffect(() => {
    setHiTypedLength(0);
    setWhereStartTypedLength(0);
  }, [selectedContact?.id]);

  // When switching away from ProBot, clear inline CRM view so returning shows welcome.
  useEffect(() => {
    if (selectedContact?.id !== 'probot') setProbotCrmView(null);
  }, [selectedContact?.id]);

  // When opened with ?contact= (e.g. from business card Message), focus the message input once the chat view is ready.
  // Focus in welcome (ProBot), business empty (centered), or normal messages view so user can type immediately.
  useEffect(() => {
    if (!focusInputTrigger || showSignupForm || showGuestContactForm || showProjectInfoFormView) return;
    const t = setTimeout(() => {
      messageInputRef.current?.focus();
    }, 200);
    return () => clearTimeout(t);
  }, [focusInputTrigger, showSignupForm, showGuestContactForm, showProjectInfoFormView, showWelcome, showBusinessEmptyChat]);

  useEffect(() => {
    if (!showWelcome) {
      setWelcomeGifStep(0);
      setWelcomeShowStaticImage(false);
      return;
    }
    setWelcomeGifStep(0);
    setWelcomeShowStaticImage(false);
  }, [showWelcome]);

  useEffect(() => {
    if (!showWelcome || welcomeShowStaticImage) return;
    const duration = welcomeGifStep === 0 || welcomeGifStep === 2 ? WELCOME_GIF_0_MS : WELCOME_GIF_1_MS;
    const id = setTimeout(() => {
      if (welcomeGifStep < 3) {
        setWelcomeGifStep((s) => s + 1);
      } else {
        setWelcomeShowStaticImage(true);
      }
    }, duration);
    return () => clearTimeout(id);
  }, [showWelcome, welcomeGifStep, welcomeShowStaticImage]);

  useEffect(() => {
    if (!showWelcome) return;
    if (hiTypedLength >= hiText.length) return;
    const id = setTimeout(() => setHiTypedLength((n) => n + 1), TYPING_MS);
    return () => clearTimeout(id);
  }, [showWelcome, hiTypedLength, hiText.length]);

  useEffect(() => {
    if (!showWelcome || hiTypedLength < hiText.length) return;
    if (whereStartTypedLength >= howDoYouWantToStartText.length) return;
    const id = setTimeout(
      () => setWhereStartTypedLength((n) => n + 1),
      WHERE_START_TYPING_MS
    );
    return () => clearTimeout(id);
  }, [showWelcome, hiTypedLength, hiText.length, whereStartTypedLength, howDoYouWantToStartText.length]);

  const sendMessage = useCallback(
    async (body: string, extra?: { placeShareId?: string }) => {
      if (!visitorId || sending) return;
      setSending(true);
      setError(null);
      setAgentStatus(null);
      const useHubStream = Boolean(selectedContact?.isProBot && !businessId);
      const draftBotId = useHubStream ? `stream-${Date.now()}` : null;
      try {
        const displayName =
          isAuthenticated && user
            ? [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
            : undefined;
        const data = await sendMessageApi(
          {
            conversationId: conversationId ?? undefined,
            visitorId,
            body,
            ...(businessId ? { businessId } : {}),
            ...(extra?.placeShareId ? { placeShareId: extra.placeShareId } : {}),
            ...(displayName ? { displayName } : {}),
            ...(isAuthenticated && user?.id ? { userId: user.id } : {}),
            ...(pendingAttachments.length > 0 ? { attachments: pendingAttachments } : {}),
            ...(replyTarget ? { replyToId: replyTarget.id } : {}),
            ...((locale === 'en' || locale === 'pt' || locale === 'es') ? { locale } : {}),
            ...(useHubStream ? { stream: true } : {}),
          },
          useHubStream
            ? {
                onMessage: (raw) => {
                  const msg = raw as {
                    id: string;
                    conversationId?: string;
                    sender: string;
                    body: string;
                    created_at: string;
                    attachments?: ChatAttachment[];
                  };
                  const newMsg: ChatMessage = {
                    ...msg,
                    sender: msg.sender as 'visitor' | 'admin',
                    attachments: msg.attachments ?? [],
                  };
                  setMessages((prev) => [...prev, newMsg]);
                  if (!conversationId && msg.conversationId) setConversationId(msg.conversationId);
                  if (draftBotId) {
                    setMessages((prev) => [
                      ...prev,
                      {
                        id: draftBotId,
                        sender: 'admin',
                        body: '',
                        created_at: new Date().toISOString(),
                        admin_sent_as: 'probot',
                      },
                    ]);
                  }
                },
                onStatus: (label) => {
                  setAgentStatus(label);
                  if (!draftBotId) return;
                  // Tool rounds may stream partial content before tool_calls; reset the draft.
                  if (label !== 'writing' && label !== 'thinking') {
                    setMessages((prev) =>
                      prev.map((row) => (row.id === draftBotId ? { ...row, body: '' } : row))
                    );
                  }
                },
                onToken: (text) => {
                  if (!draftBotId) return;
                  setMessages((prev) =>
                    prev.map((row) =>
                      row.id === draftBotId ? { ...row, body: `${row.body}${text}` } : row
                    )
                  );
                },
                onBot: (bot) => {
                  setAgentStatus(null);
                  const isEstimateReply = bot.body === t('replyAccountEstimate');
                  setMessages((prev) => {
                    const withoutDraft = draftBotId
                      ? prev.filter((row) => row.id !== draftBotId)
                      : prev;
                    return [
                      ...withoutDraft,
                      {
                        id: bot.id,
                        sender: 'admin' as const,
                        body: bot.body,
                        created_at: bot.created_at,
                        admin_sent_as: 'probot' as const,
                        ...(bot.payload ? { payload: bot.payload } : {}),
                        ...(isEstimateReply
                          ? {
                              replyLinkUrl: `/${locale}/estimate`,
                              replyLinkLabel: t('replyAccountEstimateLink'),
                            }
                          : {}),
                      },
                    ];
                  });
                },
              }
            : undefined
        );
        if (data.message) {
          const msg = data.message as {
            id: string;
            conversationId?: string;
            sender: string;
            body: string;
            created_at: string;
            attachments?: ChatAttachment[];
            payload?: ChatMessage['payload'];
          };
          const bot = data.botMessage;
          setMessages((prev) => {
            const already = prev.some((row) => row.id === msg.id);
            let next = already
              ? prev
              : [
                  ...prev,
                  {
                    ...msg,
                    sender: msg.sender as 'visitor' | 'admin',
                    attachments: msg.attachments ?? [],
                  } satisfies ChatMessage,
                ];
            if (bot && selectedContact?.isProBot && !businessId && !next.some((row) => row.id === bot.id)) {
              const isEstimateReply = bot.body === t('replyAccountEstimate');
              const botPayload = bot.payload;
              next = next.filter((row) => row.id !== draftBotId);
              next = [
                ...next,
                {
                  id: bot.id,
                  sender: 'admin',
                  body: bot.body,
                  created_at: bot.created_at,
                  admin_sent_as: 'probot',
                  ...(botPayload ? { payload: botPayload } : {}),
                  ...(isEstimateReply
                    ? {
                        replyLinkUrl: `/${locale}/estimate`,
                        replyLinkLabel: t('replyAccountEstimateLink'),
                      }
                    : {}),
                },
              ];
            }
            return next;
          });
          if (!conversationId && msg.conversationId) setConversationId(msg.conversationId);
          if (!conversationId && (data as { conversationId?: string }).conversationId) {
            setConversationId((data as { conversationId?: string }).conversationId ?? null);
          }
        }
        if (pendingAttachments.length > 0) setPendingAttachments([]);
        setReplyTarget(null);
        loadMessages();
        onThreadActivity?.();
        if (selectedContact?.isProBot && !businessId) {
          setHasChosenThisVisit(true);
          markProBotWelcomeSeen();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to send');
        if (draftBotId) {
          setMessages((prev) => prev.filter((row) => row.id !== draftBotId));
        }
      } finally {
        setSending(false);
        setAgentStatus(null);
      }
    },
    [
      visitorId,
      conversationId,
      businessId,
      setConversationId,
      sending,
      selectedContact?.isProBot,
      t,
      locale,
      isAuthenticated,
      user,
      pendingAttachments,
      replyTarget,
      loadMessages,
      onThreadActivity,
    ]
  );
  const autoSentRef = useRef<string | null>(null);
  useEffect(() => {
    if (!autoSendMessage || !visitorId || !businessId || sending) return;
    if (autoSentRef.current === autoSendMessage) return;
    autoSentRef.current = autoSendMessage;
    void sendMessage(autoSendMessage, autoSendPlaceId ? { placeShareId: autoSendPlaceId } : undefined).finally(() => onAutoSent?.());
  }, [autoSendMessage, autoSendPlaceId, visitorId, businessId, sending, sendMessage, onAutoSent]);

  const canDeleteMessage = useCallback(
    (msg: ChatMessage) => {
      if (msg.id.startsWith('stream-') || msg.id.startsWith('temp-')) return false;
      if (isAdminView) return Boolean(isContractor && msg.sender === 'admin' && msg.business_id && msg.business_id === contractorBusinessId);
      return msg.sender === 'visitor';
    },
    [isAdminView, isContractor, contractorBusinessId]
  );

  const deleteMessage = useCallback(
    async (msg: ChatMessage) => {
      const params = new URLSearchParams({ id: msg.id });
      if (msg.sender === 'visitor' && visitorId) params.set('visitorId', visitorId);
      const res = await fetch(`/api/chat/messages?${params.toString()}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === 'string' ? data.error : t('deleteMessageFailed'));
        return;
      }
      setMessages((current) => current.filter((item) => item.id !== msg.id));
    },
    [visitorId, t]
  );

  const deleteConversationForPro = useCallback(async () => {
    const conversationIdToDelete = adminViewingConversation?.id;
    if (!conversationIdToDelete) return;
    setDeletingChat(true);
    try {
      const res = await fetch(`/api/chat/contractor/conversations/delete?conversationId=${encodeURIComponent(conversationIdToDelete)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : t('deleteChatFailed'));
      setMessages([]);
      onConversationDeleted?.(conversationIdToDelete);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('deleteChatFailed'));
    } finally {
      setDeletingChat(false);
      setConfirmDeleteChat(false);
    }
  }, [adminViewingConversation?.id, onConversationDeleted, t]);

  const addConversationToCrm = useCallback(async () => {
    const conversationIdToAdd = adminViewingConversation?.id;
    if (!conversationIdToAdd) return;
    setCrmAdd({ status: 'adding', conversationId: conversationIdToAdd });
    try {
      const res = await fetch('/api/chat/place-share', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: conversationIdToAdd }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data.customerId !== 'string') throw new Error(typeof data.error === 'string' ? data.error : t('placeShareFailed'));
      setCrmAdd({ status: 'done', conversationId: conversationIdToAdd });
      setCrmCustomerId(data.customerId);
      void refreshOpenThread();
      if (typeof data.messageId === 'string') {
        setMessages((current) =>
          current.map((item) =>
            item.id === data.messageId && item.payload?.placeShare
              ? { ...item, payload: { ...item.payload, placeShare: { ...item.payload.placeShare, crmCustomerId: data.customerId } } }
              : item
          )
        );
      }
    } catch (err) {
      setCrmAdd({ status: 'error', conversationId: conversationIdToAdd, error: err instanceof Error ? err.message : t('placeShareFailed') });
    }
  }, [adminViewingConversation?.id, t, refreshOpenThread]);

  const addPlaceToCrm = useCallback(async (msg: ChatMessage) => {
    const res = await fetch('/api/chat/place-share', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId: msg.id }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || typeof data.customerId !== 'string') throw new Error(typeof data.error === 'string' ? data.error : t('placeShareFailed'));
    setMessages((current) =>
      current.map((item) =>
        item.id === msg.id && item.payload?.placeShare
          ? { ...item, payload: { ...item.payload, placeShare: { ...item.payload.placeShare, crmCustomerId: data.customerId } } }
          : item
      )
    );
    setCrmCustomerId(data.customerId);
    void refreshOpenThread();
  }, [t, refreshOpenThread]);

  const sendAdminReply = useCallback(
    async (
      body: string,
      attachments?: ChatAttachment[],
      payload?: {
        crmEstimate?: import('@/lib/types/chat').ChatCrmEstimateShare;
        crmInvoice?: import('@/lib/types/chat').ChatCrmInvoiceShare;
        bookingInvite?: import('@/lib/types/chat').ChatBookingInvite;
      }
    ): Promise<boolean> => {
      if (!adminViewingConversation?.id || sending) return false;
      const replyBusinessId =
        contractorBusinessId ||
        adminViewingConversation.business_id ||
        selectedContact?.businessId ||
        undefined;
      // Customer→pro inbox: always reply as the business, never as ProBot.
      const sentAs =
        replyBusinessId
          ? { businessId: replyBusinessId }
          : isAdminView
            ? 'probot'
            : selectedContact?.isProBot
              ? 'probot'
              : 'probot';
      setSending(true);
      setError(null);
      try {
        const data = await sendAdminMessage({
          conversationId: adminViewingConversation.id,
          body,
          sentAs,
          ...(attachments?.length ? { attachments } : {}),
          ...(replyTarget ? { replyToId: replyTarget.id } : {}),
          ...(payload ? { payload } : {}),
        });
        if (data.message) {
          const msg = data.message as {
            id: string; sender: string; body: string; created_at: string;
            attachments?: ChatAttachment[]; admin_sent_as?: string; business_id?: string;
            admin_user_id?: string; admin_avatar_url?: string | null; admin_display_name?: string | null;
            payload?: ChatMessage['payload'];
          };
          const businessName =
            adminViewingConversation.business_name ||
            user?.companyName ||
            (selectedContact?.businessId ? selectedContact.name : undefined);
          setMessages((prev) => [
            ...prev,
            {
              id: msg.id,
              sender: 'admin' as const,
              body: msg.body,
              created_at: msg.created_at,
              attachments: msg.attachments ?? [],
              replyTo: replyTarget ? chatReplyFromMessage(replyTarget) : (msg as { replyTo?: ChatMessage['replyTo'] }).replyTo,
              admin_sent_as: (msg.admin_sent_as as 'probot' | 'business' | 'hub_agent') ?? 'probot',
              business_id: msg.business_id,
              business_name: businessName,
              admin_user_id: msg.admin_user_id,
              admin_avatar_url: msg.admin_avatar_url ?? undefined,
              admin_display_name: msg.admin_display_name ?? undefined,
              payload: msg.payload ?? payload ?? null,
            },
          ]);
        }
        if (attachments?.length) setPendingAttachments([]);
        setReplyTarget(null);
        onAdminReplySent?.();
        onThreadActivity?.();
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to send');
        return false;
      } finally {
        setSending(false);
      }
    },
    [adminViewingConversation, contractorBusinessId, selectedContact, sending, onAdminReplySent, onThreadActivity, replyTarget, user?.companyName, isAdminView]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    const hasContent = trimmed || pendingAttachments.length > 0;
    if (!hasContent || sending) return;
    if (isAdminView) {
      setInputValue('');
      await sendAdminReply(trimmed || ' ', pendingAttachments.length > 0 ? pendingAttachments : undefined);
    } else {
      if (!visitorId) {
        setError(t('sendUnavailable'));
        return;
      }
      setInputValue('');
      await sendMessage(trimmed || ' ');
    }
  };

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files?.length) return;
      if (!visitorId) {
        setError(t('sendUnavailable'));
        e.target.value = '';
        return;
      }
      const total = pendingAttachments.length + files.length;
      if (total > 10) {
        setError(t('attachMax10'));
        e.target.value = '';
        return;
      }
      setUploadingAttach(true);
      setError(null);
      try {
        let cid = conversationId;
        if (!cid) {
          const { conversationId: newCid } = await createConversation(visitorId);
          setConversationId(newCid);
          cid = newCid;
        }
        const formData = new FormData();
        formData.set('conversationId', cid);
        formData.set('visitorId', visitorId);
        for (let i = 0; i < files.length; i++) formData.append('file', files[i]);
        const res = await fetch('/api/storage/upload-chat-attachment', { method: 'POST', body: formData });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const errMsg = typeof data.error === 'string' ? data.error : 'Upload failed';
          setError(errMsg);
          return;
        }
        const list = (data.attachments ?? []) as ChatAttachment[];
        const chosen = Array.from(files);
        list.forEach((att, index) => {
          const file = chosen[index];
          if (file) fileByUrl.current.set(att.url, file);
        });
        setPendingAttachments((prev) => [...prev, ...list].slice(0, 10));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Upload failed');
      } finally {
        setUploadingAttach(false);
        e.target.value = '';
      }
    },
    [conversationId, visitorId, pendingAttachments.length, t, setConversationId]
  );

  const removePendingAttachment = useCallback((index: number) => {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  useEffect(() => {
    if (!isContractor) return;
    let cancelled = false;
    fetch('/api/crm/projects?pageSize=100', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { projects?: { id: string; name: string; status?: string }[] } | null) => {
        if (cancelled || !data?.projects) return;
        setJobProjects(
          data.projects
            .filter((project) => project.status === 'planned' || project.status === 'in_progress')
            .map((project) => ({ id: project.id, name: project.name }))
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isContractor]);

  useEffect(() => {
    setReplyTarget(null);
  }, [conversationId, adminViewingConversation?.id]);

  const replyPreview = replyTarget
    ? (() => {
        const quote = chatReplyFromMessage(replyTarget);
        if (quote.kind === 'photo') return t('photoPlaceholder');
        if (quote.kind === 'video') return t('videoLabel');
        if (quote.kind === 'voice') return t('voiceNote');
        if (quote.kind === 'file') return quote.body || t('fileLabel');
        return quote.body;
      })()
    : null;

  const saveAttachmentToProject = useCallback(async (att: ChatAttachment, projectId: string) => {
    const file = fileByUrl.current.get(att.url);
    const project = jobProjects.find((item) => item.id === projectId);
    if (!file || !project) return;
    setSavingProjectUrl(att.url);
    setError(null);
    try {
      const infoResponse = await fetch(`/api/crm/projects/${projectId}/photos`, { credentials: 'include' });
      const info = (await infoResponse.json()) as { businessId?: string | null; project?: { displayId?: string }; error?: string };
      if (!infoResponse.ok || !info.businessId || !info.project?.displayId) {
        throw new Error(info.error || t('saveToProjectFailed'));
      }
      const location = await requestCurrentLocation();
      const saved = await uploadProDriveFile({
        file,
        ownerType: 'business',
        ownerId: info.businessId,
        ensureFolderNames: ['Jobsites', info.project.displayId],
      });
      const response = await fetch(`/api/crm/projects/${projectId}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          driveFileId: saved.id,
          takenAt: new Date().toISOString(),
          latitude: location?.latitude ?? null,
          longitude: location?.longitude ?? null,
          accuracyM: location?.accuracyM ?? null,
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || t('saveToProjectFailed'));
      }
      setSavedToProject((prev) => ({ ...prev, [att.url]: project.name }));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('saveToProjectFailed'));
    } finally {
      setSavingProjectUrl(null);
    }
  }, [jobProjects, t]);

  const performClearMessages = useCallback(async () => {
    if (!conversationId || !visitorId || clearingMessages) return;
    setShowClearModal(false);
    setClearingMessages(true);
    setError(null);
    try {
      const token = await getVisitorDeleteToken(visitorId);
      await deleteConversation(conversationId, visitorId, { deleteToken: token });
      setConversationId(null);
      setMessages([]);
      setHasChosenThisVisit(false);
      setUserChoice(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to clear messages');
    } finally {
      setClearingMessages(false);
    }
  }, [conversationId, visitorId, clearingMessages, setConversationId]);

  const handleClearMessagesClick = useCallback(() => {
    if (!conversationId || !visitorId || clearingMessages) return;
    setShowClearModal(true);
  }, [conversationId, visitorId, clearingMessages]);

  const chatInputLabels = {
    attachFiles: t('attachFiles'),
    uploadFiles: t('uploadFiles'),
    addFromGoogleDrive: t('addFromGoogleDrive'),
    photos: t('photos'),
    camera: t('camera'),
    voiceNote: t('voiceNote'),
    stopVoice: t('stopVoice'),
    voiceDenied: t('voiceDenied'),
    replyingTo: t('replyingTo'),
    cancelReply: t('cancelReply'),
    send: t('send'),
  };

  const openPlacePicker = () => {
    setPlacePickerOpen(true);
    setMyPlacesError(null);
    fetch('/api/places', { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : t('sharePlaceLoadFailed'));
        setMyPlaces(Array.isArray(data.places) ? data.places : []);
      })
      .catch((err) => setMyPlacesError(err instanceof Error ? err.message : t('sharePlaceLoadFailed')));
  };

  const placeAddress = (place: SharePlaceOption) =>
    [place.street, [place.city, place.state].filter(Boolean).join(', '), place.zipCode].filter(Boolean).join(' ');

  const shareMyPlace = (place: SharePlaceOption) => {
    setPlacePickerOpen(false);
    void sendMessage(tPlaces('shareMessage', { name: place.name, address: placeAddress(place) }), { placeShareId: place.id });
  };

  /** Customers chatting with a pro can send one of their My Places. */
  const canSharePlace = !isAdminView && isAuthenticated && Boolean(businessId) && !selectedContact?.isProBot;

  const crmActions =
    isAdminView && isContractor
      ? [
          {
            id: 'new-estimate',
            label: t('crmNewEstimate'),
            icon: <FileText className="h-4 w-4" />,
            onSelect: () => setComposerKind('estimate'),
          },
          {
            id: 'new-invoice',
            label: t('crmNewInvoice'),
            icon: <Receipt className="h-4 w-4" />,
            onSelect: () => setComposerKind('invoice'),
          },
          {
            id: 'request-payment',
            label: t('crmRequestPayment'),
            icon: <CreditCard className="h-4 w-4" />,
            onSelect: () => setComposerKind('payment'),
          },
          {
            id: 'send-saved',
            label: t('crmSendSaved'),
            icon: <FolderOpen className="h-4 w-4" />,
            onSelect: () => setCrmPickerKind('estimate'),
          },
          {
            id: 'calendar',
            label: t('bookingInviteShare'),
            icon: <CalendarDays className="h-4 w-4" />,
            onSelect: () => {
              const businessName = user?.companyName?.trim() || '';
              void sendAdminReply(t('bookingInviteBody'), undefined, {
                bookingInvite: { businessId: contractorBusinessId ?? '', businessName },
              });
            },
          },
        ]
      : canSharePlace
        ? [
            {
              id: 'place',
              label: t('sharePlace'),
              icon: <HomeIcon className="h-4 w-4" />,
              onSelect: openPlacePicker,
            },
          ]
        : undefined;

  const handleCrmEstimateApproved = useCallback(
    (messageId: string, next: import('@/lib/types/chat').ChatCrmEstimateShare) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== messageId) return msg;
          return {
            ...msg,
            payload: {
              ...(msg.payload ?? {}),
              crmEstimate: next,
            },
          };
        })
      );
    },
    []
  );

  /** Post a CRM document as a card: estimates get Approve, invoices and payment requests get Pay. */
  const sendCrmDocLink = useCallback(
    async (kind: ChatCrmDocKind, doc: SharedCrmDoc) => {
      const amount = new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'USD',
      }).format(doc.amountCents / 100);
      let sent: boolean;
      if (kind === 'estimate' && doc.estimateShare) {
        sent = await sendAdminReply(t('crmEstimateCardIntro', { label: doc.label, amount }), undefined, {
          crmEstimate: doc.estimateShare,
        });
      } else if (doc.invoiceShare) {
        sent = await sendAdminReply(
          t(kind === 'payment' ? 'crmPaymentCardIntro' : 'crmInvoiceCardIntro', { label: doc.label, amount }),
          undefined,
          { crmInvoice: doc.invoiceShare }
        );
      } else {
        const body =
          kind === 'payment'
            ? t('crmPaymentMessage', { label: doc.label, amount, url: doc.url })
            : t('crmInvoiceMessage', { label: doc.label, amount, url: doc.url });
        sent = await sendAdminReply(body);
      }
      if (!sent) throw new Error(t('crmDocShareFailed'));
    },
    [sendAdminReply, t]
  );

  /** The open chat's CRM customer. Documents need one, so the customer is added to the CRM first when missing. */
  const ensureCrmCustomerId = useCallback(async (): Promise<string> => {
    if (crmCustomerId) {
      const res = await fetch(`/api/crm/customers/${encodeURIComponent(crmCustomerId)}/billable`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data.error === 'string' ? data.error : t('crmComposerFailed'));
      }
      return crmCustomerId;
    }
    const conversationIdToAdd = adminViewingConversation?.id;
    if (!conversationIdToAdd) throw new Error(t('crmDocShareFailed'));
    const res = await fetch('/api/chat/place-share', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: conversationIdToAdd }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || typeof data.customerId !== 'string') {
      throw new Error(typeof data.error === 'string' ? data.error : t('placeShareFailed'));
    }
    setCrmCustomerId(data.customerId);
    setCrmAdd({ status: 'done', conversationId: conversationIdToAdd });
    void refreshOpenThread();
    return data.customerId;
  }, [crmCustomerId, adminViewingConversation?.id, t, refreshOpenThread]);

  const shareCrmDocById = useCallback(
    async (kind: QuickDocKind, id: string) => {
      const shared =
        kind === 'estimate'
          ? await createEstimateShare(id)
          : await createInvoiceShare(id, kind === 'payment' ? 'payment' : 'invoice');
      await sendCrmDocLink(kind, shared);
    },
    [sendCrmDocLink]
  );

  /** Full CRM editor; it brings the pro back to this chat, which then posts the saved document. */
  const openCrmEditor = useCallback(
    async (kind: QuickDocKind) => {
      const customerId = await ensureCrmCustomerId();
      const contactKey = selectedContact?.slug ?? selectedContact?.id ?? '';
      const returnTo = `/${locale}/probot?contact=${encodeURIComponent(contactKey)}${kind === 'payment' ? '&docKind=payment' : ''}`;
      router.push(
        kind === 'estimate'
          ? `/${locale}/crm/estimates?new=1&customerId=${encodeURIComponent(customerId)}&returnTo=${encodeURIComponent(returnTo)}`
          : `/${locale}/crm/invoices/new?customerId=${encodeURIComponent(customerId)}&returnTo=${encodeURIComponent(returnTo)}`
      );
    },
    [ensureCrmCustomerId, selectedContact?.slug, selectedContact?.id, locale, router]
  );

  // Back from the CRM editor: post the document that was just saved, once, as a card.
  const autoSharedDocRef = useRef<string | null>(null);
  useEffect(() => {
    if (!autoShareDoc || !isProReplying || !isContractor || !adminViewingConversation?.id || sending) return;
    const key = `${autoShareDoc.kind}:${autoShareDoc.id}`;
    if (autoSharedDocRef.current === key) return;
    autoSharedDocRef.current = key;
    shareCrmDocById(autoShareDoc.kind, autoShareDoc.id)
      .catch((err) => setError(err instanceof Error ? err.message : t('crmDocShareFailed')))
      .finally(() => onAutoShareDone?.());
  }, [autoShareDoc, isProReplying, isContractor, adminViewingConversation?.id, sending, shareCrmDocById, onAutoShareDone, t]);

  if (!selectedContact) {
    return (
      <div className="probot-chat-empty flex-1 flex items-center justify-center bg-gray-50 md:bg-transparent p-4">
        <p className="text-sm text-gray-500">{t('selectContact')}</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col min-h-0 overflow-hidden h-full ${PROBOT_CHAT_BG} probot-chat-area-pc-transparent`}>
      {((!showWelcome && !showAdminInitialWelcome) || isAdminView) && (
        <div className="probot-chat-header sticky top-0 z-10 border-b border-gray-200 px-4 py-2 shrink-0 bg-white md:bg-transparent flex items-center justify-between gap-2">
          {isAdminView && adminViewingConversation && onExitAdminConversation ? (
            <>
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <button
                  type="button"
                  onClick={onExitAdminConversation}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors shrink-0 cursor-pointer"
                  aria-label={t('backToMyChat')}
                  title={t('backToMyChat')}
                >
                  <ArrowLeft className="w-5 h-5 text-gray-600" />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {adminViewingConversation.display_as_probot
                      ? 'ProBot'
                      : adminViewingConversation.participant_type === 'contractor' && adminViewingConversation.business_name
                        ? adminViewingConversation.business_name
                        : (() => {
                            const profileName =
                              (adminViewingConversation.profile_first_name || adminViewingConversation.profile_last_name)
                                ? [adminViewingConversation.profile_first_name, adminViewingConversation.profile_last_name].filter(Boolean).join(' ').trim()
                                : undefined;
                            const name = profileName || adminViewingConversation.visitor_display_name?.trim();
                            return name || t('customer');
                          })()}
                  </p>
                  {adminViewingConversation.display_as_probot && user && (
                    <p className="text-xs text-gray-500 truncate flex items-center gap-1.5 mt-0.5">
                      {user.userPicture ? (
                        <img src={user.userPicture} alt="" className="w-4 h-4 rounded-full object-cover shrink-0" />
                      ) : null}
                      <span>
                        {[user.firstName, user.lastName].filter(Boolean).join(' ').trim() || t('customer')} · {t('replyAsHubAgent')}
                      </span>
                    </p>
                  )}
                  {crmAdd.status === 'error' && crmAdd.conversationId === adminViewingConversation.id ? (
                    <p className="mt-0.5 truncate text-xs text-red-600">{crmAdd.error}</p>
                  ) : null}
                </div>
              </div>
              {isProReplying ? (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteChat(true)}
                  disabled={deletingChat}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-60"
                  aria-label={t('deleteChat')}
                  title={t('deleteChat')}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
              {isProReplying && adminViewingConversation.participant_type !== 'contractor' ? (
                crmCustomerId || (crmAdd.status === 'done' && crmAdd.conversationId === adminViewingConversation.id) ? (
                  <a
                    href={`/${locale}/crm/customers`}
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border-2 border-black px-3 text-sm font-medium hover:bg-gray-50"
                  >
                    <Check className="h-4 w-4 text-green-600" />
                    {t('crmAddedOpen')}
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => void addConversationToCrm()}
                    disabled={crmAdd.status === 'adding' && crmAdd.conversationId === adminViewingConversation.id}
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-black px-3 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
                  >
                    <UserPlus className="h-4 w-4 text-red-500" />
                    {crmAdd.status === 'adding' && crmAdd.conversationId === adminViewingConversation.id
                      ? t('placeShareAdding')
                      : t('crmAddCustomer')}
                  </button>
                )
              ) : null}
            </>
          ) : (
          <>
          <div className="flex items-center gap-2 min-w-0 flex-1 min-w-0">
            {!selectedContact?.isProBot && onOpenSidebar && (
              <button
                type="button"
                onClick={onOpenSidebar}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors shrink-0 cursor-pointer -ml-1"
                aria-label={t('backToContacts')}
                title={t('backToContacts')}
              >
                <ArrowLeft className="w-5 h-5 text-gray-700" />
              </button>
            )}
            {(() => {
              const logoSrc = selectedContact?.isProBot
                ? PROBOT_ASSETS.avatar
                : selectedContact?.logo;
              return (
                <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center shrink-0 overflow-hidden relative">
                  {logoSrc ? (
                    selectedContact?.isProBot ? (
                      <Image
                        src={logoSrc}
                        alt=""
                        width={32}
                        height={32}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <img
                        src={logoSrc}
                        alt=""
                        width={32}
                        height={32}
                        className="w-full h-full object-cover"
                      />
                    )
                  ) : (
                    <Building2 className="w-4 h-4 text-gray-600" />
                  )}
                </div>
              );
            })()}
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-gray-800 truncate">
                {selectedContact?.isProBot ? selectedContact.name : selectedContact?.name ?? ''}
              </h2>
              {isAdmin && selectedContact?.isProBot && user && (
                <p className="text-xs text-gray-500 truncate flex items-center gap-1.5 mt-0.5">
                  {user.userPicture ? (
                    <img src={user.userPicture} alt="" className="w-4 h-4 rounded-full object-cover shrink-0" />
                  ) : null}
                  <span>
                    {[user.firstName, user.lastName].filter(Boolean).join(' ').trim() || t('customer')} · {t('replyAsHubAgent')}
                  </span>
                </p>
              )}
              {!isAdminView && selectedContact?.isProBot && hubAgent && (
                <p className="text-xs text-gray-500 truncate flex items-center gap-1.5 mt-0.5">
                  {hubAgent.avatarUrl ? (
                    <img src={hubAgent.avatarUrl} alt="" className="w-4 h-4 rounded-full object-cover shrink-0" />
                  ) : (
                    <User className="w-4 h-4 shrink-0 text-gray-400" aria-hidden />
                  )}
                  <span>{hubAgent.displayName}</span>
                </p>
              )}
            </div>
            {selectedContact?.isProBot && (
              <>
                <span
                  className="w-2 h-2 rounded-full shrink-0 bg-green-500"
                  title={t('online')}
                  aria-hidden
                />
                <span className="text-xs text-gray-500">{t('online')}</span>
              </>
            )}
            {!selectedContact?.isProBot && (
              <>
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${selectedContact.online ? 'bg-green-500' : 'bg-gray-400'}`}
                  title={selectedContact.online ? t('online') : t('offline')}
                  aria-hidden
                />
                <span className="text-xs text-gray-500">
                  {selectedContact.online ? t('online') : t('offline')}
                </span>
              </>
            )}
          </div>
          {!isAdminView && conversationId && (
            <button
              type="button"
              onClick={handleClearMessagesClick}
              disabled={clearingMessages}
              className="shrink-0 p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-red-600 transition-colors disabled:opacity-50 cursor-pointer"
              title={t('clearMessages')}
              aria-label={t('clearMessages')}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          </>
          )}
        </div>
      )}

      {loading && !showWelcome && !showAdminInitialWelcome && !showProBotWizardFlow ? (
        <div className="probot-chat-loading flex-1 flex items-center justify-center p-4 min-h-0 bg-transparent">
          <p className="text-sm text-gray-500">{t('loading')}</p>
        </div>
      ) : (
        <>
          {/* Scrollable messages area: flex-1 min-h-0 so it gets a bounded height and scrolls on mobile. Transparent on PC so mountains show through. */}
          <div
            ref={messagesScrollRef}
            className={`h-full min-h-0 flex flex-col ${!showProBotWizardFlow && !showWelcome ? 'bg-[#efeae2] bg-[radial-gradient(rgba(11,20,26,0.06)_1px,transparent_1px)] bg-[length:16px_16px]' : 'md:bg-transparent'} ${!showProBotWizardFlow ? 'overflow-y-auto overflow-x-hidden overscroll-contain' : 'overflow-hidden'}`}
            style={{ WebkitOverflowScrolling: 'touch', minHeight: 0 } as React.CSSProperties}
          >
            {(showWelcome || showAdminInitialWelcome) ? (
              <div className="probot-welcome flex-1 flex flex-col items-center px-2 pt-6 pb-4 min-h-0 md:px-4">
                {isContractor && probotCrmView ? (
                  <>
                    <div className="flex flex-col flex-1 min-h-0 w-full max-w-[90%]">
                      <ProBotCrmViews
                        view={probotCrmView}
                        onBack={() => setProbotCrmView(null)}
                        onOpenAddCustomer={() => {
                          setUserChoice('add_customer');
                          setProbotCrmView(null);
                          setHasChosenThisVisit(true);
                          markProBotWelcomeSeen();
                          onWelcomeChoiceMade?.();
                        }}
                        onAddTaskSuccess={() => {}}
                      />
                    </div>
                    {!showProBotWizardFlow && !showAdminInitialWelcome && (
                      <div className="w-full shrink-0 mt-4">
                        <ChatPendingAttachments
                          attachments={pendingAttachments}
                          onRemove={removePendingAttachment}
                          projects={isContractor ? jobProjects : []}
                          savedToProject={savedToProject}
                          savingUrl={savingProjectUrl}
                          onSaveToProject={isContractor ? saveAttachmentToProject : undefined}
                          saveLabel={t('saveToProject')}
                          savedLabel={(name) => t('savedToProject', { name })}
                        />
                        <ChatCamFrame>
                        <form
                          onSubmit={handleSubmit}
                          className="w-full rounded-2xl border-2 border-black bg-gray-50/80 hover:bg-gray-50 focus-within:bg-white focus-within:ring-2 focus-within:ring-black/10 transition-all py-1.5 pl-1.5 pr-1.5"
                        >
                          <ChatInputBar
                            wrapperClassName="flex items-center gap-0 w-full"
                            replyPreview={replyPreview}
                            onCancelReply={() => setReplyTarget(null)}
                            onRecorderError={setError}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder={isAdminView ? t('replyToCustomer') : t('messagePlaceholder')}
                            disabled={sending}
                            maxLength={2000}
                            inputRef={messageInputRef}
                            fileInputRef={fileInputRef}
                            onFileSelect={handleFileSelect}
                            attachMenuOpen={attachMenuOpen}
                            setAttachMenuOpen={setAttachMenuOpen}
                            attachDisabled={uploadingAttach || pendingAttachments.length >= 10}
                            sendDisabled={(!inputValue.trim() && pendingAttachments.length === 0) || sending}
                            hasText={!!(inputValue.trim() || pendingAttachments.length > 0)}
                            labels={chatInputLabels}
                            crmActions={crmActions}
                          />
                        </form>
                        </ChatCamFrame>
                      </div>
                    )}
                  </>
                ) : (
                <div className={`flex flex-col items-center text-center w-full md:w-[90%] ${isContractor ? 'flex-1 min-h-0' : ''}`}>
                  {!isContractor && (
                    <div className="flex items-center justify-center w-24 h-24 rounded-lg bg-white shadow-sm overflow-hidden shrink-0 mb-4">
                      {welcomeShowStaticImage || showAdminInitialWelcome ? (
                        <img
                          src="/pro-bot-solo.png"
                          alt="ProBot"
                          width={96}
                          height={96}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <img
                          src={welcomeGifStep % 2 === 0 ? PROBOT_ASSETS.avatarWelcome : PROBOT_ASSETS.avatarWelcomeSecond}
                          alt="ProBot"
                          width={96}
                          height={96}
                          className="w-full h-full object-contain"
                        />
                      )}
                    </div>
                  )}
                  <p className="text-lg text-gray-800 font-medium min-h-[1.75rem] shrink-0">
                    {showAdminInitialWelcome ? hiText : hiText.slice(0, hiTypedLength)}
                    {!showAdminInitialWelcome && hiTypedLength < hiText.length && (
                      <span className="animate-pulse">|</span>
                    )}
                  </p>
                  {!isContractor && (
                    <>
                      <p className="text-[1.95rem] md:text-[2.7rem] text-gray-700 mt-1 whitespace-nowrap">{t('welcomeToMyPage')}</p>
                      {showAdminInitialWelcome ? (
                        <>
                          <p className="text-[1.95rem] md:text-[2.7rem] font-medium text-gray-800 mt-0.5">{t('letsConnect')}</p>
                          <p className="text-[1.95rem] md:text-[2.7rem] font-medium text-gray-800 mt-0.5">{t('customerWithPros')}</p>
                        </>
                      ) : (
                        <p className="text-[1.95rem] md:text-[2.7rem] font-medium text-gray-800 mt-0.5">{t('letsGetItDone')}</p>
                      )}
                    </>
                  )}
                  {!showAdminInitialWelcome && (
                  <div className="flex justify-center w-full mt-4 mb-4 min-h-[1.5em] shrink-0">
                    <div className="flex items-center justify-center gap-2">
                      <div className="shrink-0 w-12 h-12 rounded-lg bg-white shadow-sm flex items-center justify-center overflow-hidden" aria-hidden>
                        <img
                          src={whereStartTypedLength < howDoYouWantToStartText.length ? PROBOT_ASSETS.avatarAnimated : PROBOT_ASSETS.avatar}
                          alt=""
                          width={48}
                          height={48}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <p className="text-xl md:text-2xl font-bold text-gray-900 text-center whitespace-nowrap">
                        {howDoYouWantToStartText.slice(0, whereStartTypedLength)}
                        {whereStartTypedLength < howDoYouWantToStartText.length && (
                          <span className="animate-pulse">|</span>
                        )}
                      </p>
                    </div>
                  </div>
                  )}
                  {!showAdminInitialWelcome && (
                  <div className={isContractor ? 'flex-1 min-h-0 overflow-y-auto overflow-x-hidden w-full flex flex-col items-center' : 'flex flex-wrap justify-center gap-2 mb-4'}>
                    {isContractor ? (
                      <div className="flex flex-wrap justify-center gap-2 mb-4 py-2 w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
                        <button
                          type="button"
                          onClick={() => { markProBotWelcomeSeen(); onWelcomeChoiceMade?.(); setProbotCrmView('calendar'); }}
                          className="probot-sky-btn px-4 py-2.5 rounded-lg bg-white border-2 border-black text-sm font-medium text-gray-900 hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                          {tBot('crmCalendar')}
                        </button>
                        <button
                          type="button"
                          onClick={() => { markProBotWelcomeSeen(); onWelcomeChoiceMade?.(); setProbotCrmView('customers'); }}
                          className="probot-sky-btn px-4 py-2.5 rounded-lg bg-white border-2 border-black text-sm font-medium text-gray-900 hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                          {tBot('crmCustomers')}
                        </button>
                        <button
                          type="button"
                          onClick={() => { markProBotWelcomeSeen(); onWelcomeChoiceMade?.(); setProbotCrmView('estimates'); }}
                          className="probot-sky-btn px-4 py-2.5 rounded-lg bg-white border-2 border-black text-sm font-medium text-gray-900 hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                          {tBot('crmEstimates')}
                        </button>
                        <button
                          type="button"
                          onClick={() => { markProBotWelcomeSeen(); onWelcomeChoiceMade?.(); setProbotCrmView('invoices'); }}
                          className="probot-sky-btn px-4 py-2.5 rounded-lg bg-white border-2 border-black text-sm font-medium text-gray-900 hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                          {tBot('crmInvoices')}
                        </button>
                        <button
                          type="button"
                          onClick={() => { markProBotWelcomeSeen(); onWelcomeChoiceMade?.(); setProbotCrmView('projects'); }}
                          className="probot-sky-btn px-4 py-2.5 rounded-lg bg-white border-2 border-black text-sm font-medium text-gray-900 hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                          {tBot('crmProjects')}
                        </button>
                        <button
                          type="button"
                          onClick={() => { markProBotWelcomeSeen(); onWelcomeChoiceMade?.(); setProbotCrmView('expenses'); }}
                          className="probot-sky-btn px-4 py-2.5 rounded-lg bg-white border-2 border-black text-sm font-medium text-gray-900 hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                          {tBot('crmExpenses')}
                        </button>
                        <button
                          type="button"
                          onClick={() => { markProBotWelcomeSeen(); onWelcomeChoiceMade?.(); setProbotCrmView('add_task'); }}
                          className="probot-sky-btn px-4 py-2.5 rounded-lg bg-white border-2 border-black text-sm font-medium text-gray-900 hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                          {tBot('addTask')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setHasChosenThisVisit(true);
                            markProBotWelcomeSeen();
                            setUserChoice('add_customer');
                            onWelcomeChoiceMade?.();
                          }}
                          className="probot-sky-btn px-4 py-2.5 rounded-lg bg-white border-2 border-black text-sm font-medium text-gray-900 hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                          {tBot('addCustomer')}
                        </button>
                      </div>
                    ) : isAuthenticated ? (
                      <button
                        type="button"
                        onClick={() => {
                          setHasChosenThisVisit(true);
                          markProBotWelcomeSeen();
                          setUserChoice('free_estimate');
                          onWelcomeChoiceMade?.();
                        }}
                        className="probot-sky-btn px-4 py-2.5 rounded-lg bg-white border-2 border-black text-sm font-medium text-gray-900 hover:bg-gray-50 transition-colors cursor-pointer"
                      >
                        {tBot('getFreeEstimate')}
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setHasChosenThisVisit(true);
                            markProBotWelcomeSeen();
                            setUserChoice('create_account');
                            onWelcomeChoiceMade?.();
                          }}
                          className="probot-sky-btn px-4 py-2.5 rounded-lg bg-white border-2 border-black text-sm font-medium text-gray-900 hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                          {tBot('createAccount')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setHasChosenThisVisit(true);
                            markProBotWelcomeSeen();
                            setUserChoice('free_estimate');
                            onWelcomeChoiceMade?.();
                          }}
                          className="probot-sky-btn px-4 py-2.5 rounded-lg bg-white border-2 border-black text-sm font-medium text-gray-900 hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                          {tBot('getFreeEstimate')}
                        </button>
                        {onOpenSidebar && (
                          <button
                            type="button"
                            onClick={() => {
                              markProBotWelcomeSeen();
                              onOpenSidebar();
                              onWelcomeChoiceMade?.();
                            }}
                            className="probot-sky-btn md:hidden px-4 py-2.5 rounded-lg bg-white border-2 border-black text-sm font-medium text-black hover:bg-gray-50 transition-colors cursor-pointer"
                          >
                            {tBot('chatWithAPro')}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                  )}
                  {!showProBotWizardFlow && !showAdminInitialWelcome && (
                    <div className="w-full shrink-0 md:mb-[50px]">
                      <ChatPendingAttachments
                        attachments={pendingAttachments}
                        onRemove={removePendingAttachment}
                        projects={isContractor ? jobProjects : []}
                        savedToProject={savedToProject}
                        savingUrl={savingProjectUrl}
                        onSaveToProject={isContractor ? saveAttachmentToProject : undefined}
                        saveLabel={t('saveToProject')}
                        savedLabel={(name) => t('savedToProject', { name })}
                      />
                      <ChatCamFrame>
                      <form
                        onSubmit={handleSubmit}
                        className="w-full rounded-2xl border-2 border-black bg-gray-50/80 hover:bg-gray-50 focus-within:bg-white focus-within:ring-2 focus-within:ring-black/10 transition-all py-1.5 pl-1.5 pr-1.5"
                      >
                        <ChatInputBar
                          wrapperClassName="flex items-center gap-0 w-full"
                          replyPreview={replyPreview}
                            onCancelReply={() => setReplyTarget(null)}
                            onRecorderError={setError}
                            value={inputValue}
                          onChange={(e) => setInputValue(e.target.value)}
                          placeholder={isAdminView ? t('replyToCustomer') : t('messagePlaceholder')}
                          disabled={sending}
                          maxLength={2000}
                          inputRef={messageInputRef}
                          fileInputRef={fileInputRef}
                          onFileSelect={handleFileSelect}
                          attachMenuOpen={attachMenuOpen}
                          setAttachMenuOpen={setAttachMenuOpen}
                          attachDisabled={uploadingAttach || pendingAttachments.length >= 10}
                          sendDisabled={(!inputValue.trim() && pendingAttachments.length === 0) || sending}
                          hasText={!!(inputValue.trim() || pendingAttachments.length > 0)}
                          labels={chatInputLabels}
                          crmActions={crmActions}
                        />
                      </form>
                      </ChatCamFrame>
                    </div>
                  )}
                </div>
                )}
              </div>
            ) : showSignupForm ? (
              <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
                <ChatSignupForm
                  mode="signup"
                  showBackToChoice
                  onCancel={() => {
                    setUserChoice(null);
                    setHasChosenThisVisit(false);
                  }}
                  onSuccess={() => setEstimateSubmitted(true)}
                  onStepIndexChange={setSignupStepIndex}
                />
              </div>
            ) : showGuestContactForm ? (
              <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
                <ChatSignupForm
                  mode="guest_estimate"
                  showBackToChoice
                  onCancel={() => {
                    setUserChoice(null);
                    setHasChosenThisVisit(false);
                  }}
                  onGuestSubmit={(data) => setGuestContact(data)}
                  onStepIndexChange={setSignupStepIndex}
                />
              </div>
            ) : showBookingGuestForm ? (
              <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
                <ChatSignupForm
                  mode="guest_estimate"
                  showBackToChoice
                  onCancel={() => {
                    setUserChoice(null);
                    setBookingGuestContact(null);
                  }}
                  onGuestSubmit={(data) => setBookingGuestContact(data)}
                  onStepIndexChange={setSignupStepIndex}
                />
              </div>
            ) : showBookingFlow && selectedContact?.businessId ? (
              <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
                <ProEstimateBookingFlow
                  businessId={selectedContact.businessId}
                  businessName={selectedContact.name ?? ''}
                  isAuthenticated={!!isAuthenticated}
                  guestContact={bookingGuestContact ?? undefined}
                  onSuccess={() => {
                    setUserChoice(null);
                    setBookingGuestContact(null);
                  }}
                  onCancel={() => {
                    setUserChoice(null);
                    setBookingGuestContact(null);
                  }}
                />
              </div>
            ) : showAddCustomerFlow ? (
              <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
                <AddCustomerForm
                  showBackToChoice
                  onCancel={() => setUserChoice(null)}
                  onSuccess={() => setAddCustomerSubmitted(true)}
                />
              </div>
            ) : showAddCustomerSuccess ? (
              <div className="space-y-6 flex-1 flex flex-col min-h-0 py-4 px-2">
                <div className="flex flex-col justify-start pt-8">
                  <div className="bg-white border-2 border-black rounded-lg p-6 flex flex-col justify-center text-center mx-4">
                    <svg
                      className="w-16 h-16 mx-auto text-green-600 mb-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <h2 className="text-2xl font-semibold mb-4 text-black">
                      {tBot('addCustomerSuccess')}
                    </h2>
                    <div className="flex flex-col gap-3 mt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setUserChoice(null);
                          setAddCustomerSubmitted(false);
                          setHasChosenThisVisit(false);
                        }}
                        className="w-full px-4 py-2.5 rounded-lg border-2 border-black bg-white text-black text-sm font-medium hover:bg-gray-100 transition-colors cursor-pointer"
                      >
                        {tBot('backToProBotMenu')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setUserChoice('free_estimate');
                          setAddCustomerSubmitted(false);
                          setHasChosenThisVisit(true);
                        }}
                        className="w-full px-4 py-2.5 rounded-lg border-2 border-black bg-black text-white text-sm font-medium hover:bg-gray-800 transition-colors cursor-pointer"
                      >
                        {tBot('addAnEstimate')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setUserChoice(null);
                          setAddCustomerSubmitted(false);
                        }}
                        className="w-full px-4 py-2.5 rounded-lg border-2 border-black bg-black text-white text-sm font-medium hover:bg-gray-800 transition-colors cursor-pointer"
                      >
                        {tBot('continueToChat')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : showProjectInfoFormView ? (
              <div className="probot-estimate-flow flex flex-col min-h-0 flex-1 overflow-hidden">
                <ChatEstimateForm
                  key={estimateFormKey}
                  guestContact={guestContact ?? undefined}
                  onSuccess={() => setProjectEstimateSubmitted(true)}
                  onBack={() => {
                    if (userChoice === 'free_estimate') {
                      if (guestContact) setGuestContact(null);
                      else {
                        setUserChoice(null);
                        setHasChosenThisVisit(false);
                      }
                    } else {
                      setShowProjectInfoForm(false);
                      if (isAuthenticated) {
                        setUserChoice(null);
                        setHasChosenThisVisit(false);
                      }
                    }
                  }}
                />
              </div>
            ) : showEstimateSuccess ? (
              <div className="space-y-6 flex-1 flex flex-col min-h-0 py-4 px-2">
                <div className="flex flex-col justify-start pt-8">
                  <div className="bg-white border-2 border-black rounded-lg p-6 flex flex-col justify-center text-center mx-4">
                    <svg
                      className="w-16 h-16 mx-auto text-green-600 mb-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <h2 className="text-2xl font-semibold mb-4 text-black">
                      {tBot('accountCreatedSuccess')}
                    </h2>
                    <p className="text-gray-700">
                      {tBot('accountCreatedMessage')}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 w-full shrink-0 px-4">
                  <button
                    type="button"
                    onClick={() => router.push(`/${locale}`)}
                    className="flex-1 py-3 px-4 rounded-lg border-2 border-black bg-white text-gray-900 text-base font-medium hover:bg-black hover:text-white transition-colors cursor-pointer md:text-sm whitespace-nowrap"
                  >
                    {tBot('goToHomePage')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowProjectInfoForm(true)}
                    className="flex-1 py-3 px-4 rounded-lg border-2 border-black bg-gray-900 text-white text-base font-medium hover:bg-gray-800 transition-colors cursor-pointer md:text-sm whitespace-nowrap"
                  >
                    {tBot('getAnEstimate')}
                  </button>
                </div>
              </div>
            ) : showProjectEstimateSuccess ? (
              <div className="flex flex-col gap-4 py-4 px-2 flex-1 min-h-0 overflow-y-auto">
                <div className="flex flex-col justify-start">
                  <div className="bg-white border-2 border-black rounded-lg p-6 flex flex-col justify-center text-center mx-4">
                    <svg
                      className="w-16 h-16 mx-auto text-green-600 mb-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <h2 className="text-2xl font-semibold mb-4 text-black">
                      {tSuccess('title')}
                    </h2>
                    <p className="text-gray-700">
                      {tSuccess('body')}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 w-full shrink-0 px-4">
                  <button
                    type="button"
                    onClick={() => router.push(`/${locale}`)}
                    className="flex-1 py-3 px-4 rounded-lg border-2 border-black bg-white text-gray-900 text-base font-medium hover:bg-black hover:text-white transition-colors cursor-pointer md:text-sm whitespace-nowrap"
                  >
                    {tSuccess('goToHome')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProjectEstimateSubmitted(false);
                      setEstimateFormKey((k) => k + 1);
                    }}
                    className="flex-1 py-3 px-4 rounded-lg border-2 border-black bg-gray-900 text-white text-base font-medium hover:bg-gray-800 transition-colors cursor-pointer md:text-sm whitespace-nowrap"
                  >
                    {tSuccess('requestNewEstimate')}
                  </button>
                </div>
              </div>
            ) : showBusinessEmptyChat ? (
              <div className="probot-chat-business-empty flex-1 flex flex-col items-center justify-center px-2 pt-6 pb-4 min-h-0 w-full">
                <div className="flex flex-col items-center text-center w-full max-w-md">
                  <div className="flex justify-center w-20 h-20 rounded-xl bg-white border-2 border-black shadow-sm overflow-hidden shrink-0 mb-4">
                    {selectedContact?.logo ? (
                      <img src={selectedContact.logo} alt="" width={80} height={80} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-100">
                        <Building2 className="w-10 h-10 text-gray-500" aria-hidden />
                      </div>
                    )}
                  </div>
                  <p className="text-xl font-semibold text-gray-900 mb-4">
                    {t('chatWithBusiness', { name: selectedContact?.name ?? '' })}
                  </p>
                  <button
                    type="button"
                    onClick={() => setUserChoice('book_proestimate')}
                    className="probot-sky-btn mb-6 px-4 py-2.5 rounded-lg bg-black text-white border-2 border-black text-sm font-medium hover:bg-gray-800 transition-colors cursor-pointer"
                  >
                    {t('booking.bookProEstimate')}
                  </button>
                  <ChatCamFrame className="w-full">
                  <form
                    onSubmit={handleSubmit}
                    className="w-full rounded-2xl border-2 border-black bg-gray-50/80 hover:bg-gray-50 focus-within:bg-white focus-within:ring-2 focus-within:ring-black/10 transition-all py-1.5 pl-1.5 pr-1.5"
                  >
                    <ChatPendingAttachments
                      attachments={pendingAttachments}
                      onRemove={removePendingAttachment}
                      projects={isContractor ? jobProjects : []}
                      savedToProject={savedToProject}
                      savingUrl={savingProjectUrl}
                      onSaveToProject={isContractor ? saveAttachmentToProject : undefined}
                      saveLabel={t('saveToProject')}
                      savedLabel={(name) => t('savedToProject', { name })}
                    />
                    <ChatInputBar
                        wrapperClassName="flex items-center gap-0 w-full"
                        replyPreview={replyPreview}
                            onCancelReply={() => setReplyTarget(null)}
                            onRecorderError={setError}
                            value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder={t('messagePlaceholder')}
                        disabled={sending}
                        maxLength={2000}
                        inputRef={messageInputRef}
                        fileInputRef={fileInputRef}
                        onFileSelect={handleFileSelect}
                        attachMenuOpen={attachMenuOpen}
                        setAttachMenuOpen={setAttachMenuOpen}
                        attachDisabled={uploadingAttach || pendingAttachments.length >= 10}
                        sendDisabled={(!inputValue.trim() && pendingAttachments.length === 0) || sending}
                        hasText={!!(inputValue.trim() || pendingAttachments.length > 0)}
                        labels={chatInputLabels}
                        crmActions={crmActions}
                      />
                  </form>
                  </ChatCamFrame>
                </div>
              </div>
            ) : (
              <>
                {error && (
                  <p className="text-sm text-red-600 px-4 pt-4">{error}</p>
                )}
                {agentStatus && sending && selectedContact?.isProBot && !businessId && (
                  <p className="px-4 pt-2 text-xs text-gray-500" aria-live="polite">
                    {agentStatus === 'searching_pros'
                      ? 'Searching pros…'
                      : agentStatus === 'listing_categories'
                        ? 'Listing categories…'
                        : agentStatus === 'drafting_estimate'
                          ? 'Drafting estimate…'
                          : agentStatus === 'reading_pro'
                            ? 'Opening pro profile…'
                            : agentStatus === 'reading_places'
                              ? 'Checking your places…'
                              : agentStatus === 'searching_places'
                                ? 'Searching your places…'
                                : agentStatus === 'opening_estimate'
                                  ? 'Opening the estimate…'
                            : agentStatus === 'writing'
                              ? 'Writing…'
                              : 'Thinking…'}
                  </p>
                )}
                <ProBotMessageList
                  messages={filteredMessages}
                  scrollContainerRef={messagesScrollRef}
                  isAdminView={isAdminView}
                  adminViewingConversation={adminViewingConversation ?? null}
                  selectedContact={selectedContact}
                  visitorAvatarUrl={
                    isAdminView && adminViewingConversation
                      ? // Customer bubbles always use the customer photo — never the pro/business logo.
                        adminViewingConversation.profile_user_picture
                        ?? selectedContact?.profile_user_picture
                        ?? (adminViewingConversation.participant_type === 'contractor'
                          ? adminViewingConversation.business_logo ?? null
                          : null)
                      : isContractor && user?.businessLogo
                        ? user.businessLogo
                        : user?.userPicture ?? null
                  }
                  businessReplyName={
                    adminViewingConversation?.business_name || user?.companyName || null
                  }
                  businessReplyLogo={
                    adminViewingConversation?.business_logo || user?.businessLogo || null
                  }
                  confirmingStepId={confirmingStepId}
                  onConfirmEstimate={isAdminView ? undefined : confirmEstimate}
                  onEditEstimate={() => messageInputRef.current?.focus()}
                  onReply={(msg) => {
                    setReplyTarget(msg);
                    messageInputRef.current?.focus();
                  }}
                  onCrmEstimateApproved={handleCrmEstimateApproved}
                  canDelete={canDeleteMessage}
                  onDelete={setPendingDelete}
                  onAddPlaceToCrm={isProReplying ? addPlaceToCrm : undefined}
                  onCrmQuickAction={isAdminView && isContractor ? (kind) => setComposerKind(kind) : undefined}
                  onPickTime={isAdminView ? undefined : (msg) => msg.payload?.bookingInvite && setBookingInvite(msg.payload.bookingInvite)}
                />
                <Modal
                  isOpen={placePickerOpen}
                  onClose={() => setPlacePickerOpen(false)}
                  title={t('sharePlaceTitle')}
                  showHeader
                  maxWidth="md"
                  contentClassName="max-h-[70vh] overflow-y-auto p-3"
                >
                  {myPlacesError ? (
                    <p className="p-2 text-sm text-red-600">{myPlacesError}</p>
                  ) : myPlaces === null ? (
                    <div className="flex justify-center p-6">
                      <Loader2 className="h-6 w-6 animate-spin text-gray-400" aria-label={t('sharePlaceLoading')} />
                    </div>
                  ) : myPlaces.length === 0 ? (
                    <div className="p-3 text-center">
                      <p className="text-sm text-gray-600">{t('sharePlaceEmpty')}</p>
                      <Link
                        href={`/${locale}/myplaces`}
                        className="mt-3 inline-flex h-10 items-center justify-center rounded-lg bg-black px-4 text-sm font-medium text-white"
                      >
                        {t('sharePlaceAdd')}
                      </Link>
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {myPlaces.map((place) => (
                        <li key={place.id}>
                          <button
                            type="button"
                            onClick={() => shareMyPlace(place)}
                            disabled={sending}
                            className="flex w-full items-center gap-3 rounded-lg border-2 border-black p-2 text-left hover:bg-gray-50 disabled:opacity-60"
                          >
                            <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
                              {place.photoUrl ? (
                                <img src={place.photoUrl} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <HomeIcon className="h-6 w-6 text-gray-400" aria-hidden />
                              )}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-gray-900">{place.name}</span>
                              <span className="block truncate text-xs text-gray-500">{placeAddress(place)}</span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </Modal>
                <Modal
                  isOpen={Boolean(bookingInvite)}
                  onClose={() => setBookingInvite(null)}
                  title={bookingInvite ? t('bookingInviteTitle', { name: bookingInvite.businessName }) : ''}
                  showHeader
                  maxWidth="md"
                  contentClassName="max-h-[80vh] overflow-y-auto p-2"
                >
                  {bookingInvite ? (
                    <ProEstimateBookingFlow
                      businessId={bookingInvite.businessId}
                      businessName={bookingInvite.businessName}
                      isAuthenticated={isAuthenticated}
                      onCancel={() => setBookingInvite(null)}
                      onSuccess={() => {
                        setBookingInvite(null);
                        void sendMessage(t('bookingInviteBooked'));
                      }}
                    />
                  ) : null}
                </Modal>
                <ConfirmationModal
                  isOpen={confirmDeleteChat}
                  onClose={() => setConfirmDeleteChat(false)}
                  title={t('deleteChat')}
                  message={t('deleteChatConfirm')}
                  primaryButton={{ label: deletingChat ? t('deleteChatDeleting') : t('deleteChat'), onClick: () => void deleteConversationForPro() }}
                  secondaryButton={{ label: t('deleteMessageCancel'), onClick: () => setConfirmDeleteChat(false) }}
                />
                <ConfirmationModal
                  isOpen={Boolean(pendingDelete)}
                  onClose={() => setPendingDelete(null)}
                  title={t('deleteMessage')}
                  message={t('deleteMessageConfirm')}
                  primaryButton={{
                    label: t('deleteMessage'),
                    onClick: () => {
                      const target = pendingDelete;
                      setPendingDelete(null);
                      if (target) void deleteMessage(target);
                    },
                  }}
                  secondaryButton={{ label: t('deleteMessageCancel'), onClick: () => setPendingDelete(null) }}
                />
              </>
            )}
          </div>

          {!showProBotWizardFlow && !showWelcome && !showAdminInitialWelcome && !showBusinessEmptyChat && (
            <>
              {error && (
                <div className="shrink-0 px-4 py-2 bg-red-50 border-t border-red-200 flex items-center justify-between gap-2">
                  <p className="text-sm text-red-700 flex-1 min-w-0">{error}</p>
                  <button
                    type="button"
                    onClick={() => setError(null)}
                    className="shrink-0 text-red-600 hover:text-red-800 text-sm font-medium cursor-pointer"
                    aria-label="Dismiss"
                  >
                    Dismiss
                  </button>
                </div>
              )}
              <form
                onSubmit={handleSubmit}
                className="probot-chat-footer shrink-0 w-full px-2 md:px-4 py-3 pb-[10px] md:pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 bg-white md:bg-transparent border-t border-gray-200/90 shadow-[0_-2px_10px_rgba(0,0,0,0.04)] md:shadow-none"
              >
              <ChatPendingAttachments
                attachments={pendingAttachments}
                onRemove={removePendingAttachment}
                className="mx-auto mb-2 flex w-full flex-wrap gap-2 md:w-[70%]"
                projects={isContractor ? jobProjects : []}
                savedToProject={savedToProject}
                savingUrl={savingProjectUrl}
                onSaveToProject={isContractor ? saveAttachmentToProject : undefined}
                saveLabel={t('saveToProject')}
                savedLabel={(name) => t('savedToProject', { name })}
              />
              <ChatCamFrame>
              <div className="w-full flex items-center gap-0 rounded-2xl border-2 border-black bg-gray-50/80 hover:bg-gray-50 focus-within:bg-white focus-within:ring-2 focus-within:ring-black/10 focus-within:ring-offset-0 transition-all py-1.5 pl-1.5 pr-1.5">
                <ChatInputBar
                  wrapperClassName="flex items-center gap-0 w-full"
                  replyPreview={replyPreview}
                            onCancelReply={() => setReplyTarget(null)}
                            onRecorderError={setError}
                            value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={isAdminView ? t('replyToCustomer') : t('messagePlaceholder')}
                  disabled={sending}
                  maxLength={2000}
                  inputRef={messageInputRef}
                  fileInputRef={fileInputRef}
                  onFileSelect={handleFileSelect}
                  attachMenuOpen={attachMenuOpen}
                  setAttachMenuOpen={setAttachMenuOpen}
                  attachDisabled={uploadingAttach || pendingAttachments.length >= 10}
                  sendDisabled={(!inputValue.trim() && pendingAttachments.length === 0) || sending}
                  hasText={!!(inputValue.trim() || pendingAttachments.length > 0)}
                  labels={chatInputLabels}
                  crmActions={crmActions}
                />
              </div>
              </ChatCamFrame>
            </form>
            </>
          )}
        </>
      )}

      {showClearModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-modal-title"
          aria-describedby="clear-modal-desc"
          onClick={() => setShowClearModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-lg max-w-sm w-full p-5 border border-gray-200"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="clear-modal-title" className="text-lg font-semibold text-gray-900 mb-2">
              {t('clearMessages')}
            </h2>
            <p id="clear-modal-desc" className="text-gray-600 text-sm mb-5">
              {t('clearMessagesConfirm')}
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => performClearMessages()}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors cursor-pointer"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {crmPickerKind ? (
        <ChatCrmDocPicker
          open
          kind={crmPickerKind}
          locale={locale}
          customerId={crmCustomerId}
          title={t('crmSendSaved')}
          onKindChange={setCrmPickerKind}
          tabLabels={{ estimate: t('crmTabEstimates'), invoice: t('crmTabInvoices'), payment: t('crmTabUnpaid') }}
          onCreateNew={() => {
            setComposerKind(crmPickerKind);
            setCrmPickerKind(null);
          }}
          emptyLabel={
            crmPickerKind === 'estimate'
              ? t('crmNoEstimates')
              : crmPickerKind === 'payment'
                ? t('crmNoPayments')
                : t('crmNoInvoices')
          }
          loadingLabel={t('loading')}
          sendLabel={t('crmSendInChat')}
          createNewLabel={
            crmPickerKind === 'estimate'
              ? t('crmCreateEstimateHere')
              : crmPickerKind === 'payment'
                ? t('crmCreatePaymentHere')
                : t('crmCreateInvoiceHere')
          }
          allDocsLabel={t('crmAllDocs')}
          forCustomerLabel={t('crmThisCustomer')}
          onClose={() => setCrmPickerKind(null)}
          onSend={(doc) => sendCrmDocLink(crmPickerKind, doc)}
        />
      ) : null}
      {composerKind ? (
        <ChatQuickDocComposer
          key={composerKind}
          open
          kind={composerKind}
          customerName={selectedContact?.name}
          ensureCustomerId={ensureCrmCustomerId}
          onCreated={({ kind, id }) => shareCrmDocById(kind, id)}
          onOpenFullEditor={() => openCrmEditor(composerKind)}
          onPickSaved={() => {
            setCrmPickerKind(composerKind);
            setComposerKind(null);
          }}
          onClose={() => setComposerKind(null)}
        />
      ) : null}
    </div>
  );
}
