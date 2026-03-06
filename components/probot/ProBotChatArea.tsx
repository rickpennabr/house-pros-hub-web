'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import Image from 'next/image';
import { Send, Building2, Trash2, ArrowLeft, Plus, Paperclip, ImageIcon, Cloud } from 'lucide-react';
import { useChat } from '@/contexts/ChatContext';
import { useAuth } from '@/contexts/AuthContext';
import ChatSignupForm from '@/components/chat/ChatSignupForm';
import ChatEstimateForm from '@/components/chat/ChatEstimateForm';
import { PROBOT_ASSETS, PROBOT_CHAT_BG } from '@/lib/constants/probot';
import ProBotMessageList from './ProBotMessageList';
import type { ProBotContact, ProBotRecentConversation } from './ProBotSidebar';
import type { ChatMessage, ChatAttachment } from '@/lib/types/chat';
import {
  getMessages,
  createConversation,
  sendMessage as sendMessageApi,
  sendAdminMessage,
  getVisitorDeleteToken,
  deleteConversation,
} from '@/lib/api/chat';

export type { ChatMessage, ChatAttachment };

type UserChoice = null | 'account_estimate';

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
}

const POLL_INTERVAL_MS = 10_000;
const TYPING_MS = 60;
const WHERE_START_TYPING_MS = 45;

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
}: ProBotChatAreaProps) {
  const t = useTranslations('probot');
  const tBot = useTranslations('bot');
  const tSuccess = useTranslations('estimate.success');
  const locale = useLocale();
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { visitorId, conversationId, setConversationId } = useChat();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [uploadingAttach, setUploadingAttach] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hiTypedLength, setHiTypedLength] = useState(0);
  const [whereStartTypedLength, setWhereStartTypedLength] = useState(0);
  const [messagesLoadedOnce, setMessagesLoadedOnce] = useState(false);
  const [hasChosenThisVisit, setHasChosenThisVisit] = useState(false);
  const [userChoice, setUserChoice] = useState<UserChoice>(null);
  const [estimateSubmitted, setEstimateSubmitted] = useState(false);
  const [showProjectInfoForm, setShowProjectInfoForm] = useState(false);
  const [projectEstimateSubmitted, setProjectEstimateSubmitted] = useState(false);
  const [estimateFormKey, setEstimateFormKey] = useState(0);
  const [signupStepIndex, setSignupStepIndex] = useState(0);
  const [clearingMessages, setClearingMessages] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  /** 0–3: segment of welcome animation (0,2 = first GIF; 1,3 = second GIF). After 2 cycles show static. */
  const [welcomeGifStep, setWelcomeGifStep] = useState(0);
  const [welcomeShowStaticImage, setWelcomeShowStaticImage] = useState(false);
  /** Admin only: which identity to reply as (ProBot, Hub Agent, or Business when conversation is with a contractor). */
  const [replyAs, setReplyAs] = useState<'probot' | 'hub_agent' | 'business'>('probot');

  useEffect(() => {
    if (adminViewingConversation?.id) setReplyAs('probot');
  }, [adminViewingConversation?.id]);

  /** Duration each welcome GIF shows before switching. Animation runs 2 full cycles then shows static image. */
  const WELCOME_GIF_0_MS = 5000;
  const WELCOME_GIF_1_MS = 5000;

  const showEstimateForm = userChoice === 'account_estimate' && !estimateSubmitted && !showProjectInfoForm;
  const showEstimateSuccess = userChoice === 'account_estimate' && estimateSubmitted && !showProjectInfoForm && !projectEstimateSubmitted;
  const showProjectInfoFormView = userChoice === 'account_estimate' && showProjectInfoForm && !projectEstimateSubmitted;
  const showProjectEstimateSuccess = userChoice === 'account_estimate' && showProjectInfoForm && projectEstimateSubmitted;
  const showAccountEstimateFlow =
    selectedContact?.isProBot &&
    (showEstimateForm || showProjectInfoFormView || showEstimateSuccess || showProjectEstimateSuccess);

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

  const loadMessages = useCallback(async () => {
    if (!conversationId || !visitorId) return;
    try {
      const { messages: msgs } = await getMessages(conversationId, { visitorId });
      setMessages((msgs ?? []) as ChatMessage[]);
      setMessagesLoadedOnce(true);
    } catch {
      setMessages([]);
      setMessagesLoadedOnce(true);
    }
  }, [conversationId, visitorId]);

  const loadAdminViewMessages = useCallback(async () => {
    if (!adminViewingConversation?.id) return;
    try {
      const { messages: msgs } = await getMessages(adminViewingConversation.id, { credentials: 'include' });
      setMessages((msgs ?? []) as ChatMessage[]);
      setMessagesLoadedOnce(true);
    } catch {
      setMessages([]);
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
  }, [adminViewingConversation, loadMessages, loadAdminViewMessages]);

  useEffect(() => {
    const load = adminViewingConversation?.id ? loadAdminViewMessages : loadMessages;
    const shouldPoll = adminViewingConversation?.id || (conversationId && visitorId);
    if (!shouldPoll) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        load();
        intervalId = setInterval(load, POLL_INTERVAL_MS);
      }
    };
    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') startPolling();
      else stopPolling();
    };

    startPolling();
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange);
    }
    return () => {
      stopPolling();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
    };
  }, [adminViewingConversation?.id, conversationId, visitorId, loadMessages, loadAdminViewMessages]);

  // When conversation is cleared (e.g. sign out), reset message state so UI shows welcome
  useEffect(() => {
    if (!adminViewingConversation && !conversationId) {
      setMessages([]);
      setMessagesLoadedOnce(false);
    }
  }, [conversationId, adminViewingConversation]);

  const isAdminView = Boolean((isAdmin || isContractor) && adminViewingConversation);

  const filteredMessages = isAdminView
    ? messages
    : selectedContact
      ? messages.filter((m) => {
          const msgBusinessId = m.business_id ?? undefined;
          if (selectedContact.isProBot) return !msgBusinessId;
          return msgBusinessId === selectedContact.businessId;
        })
      : [];

  // Notify parent so History Chat only shows ProBot when this conversation has at least one message
  useEffect(() => {
    if (!onVisitorProBotHasMessages || isAdminView || !selectedContact?.isProBot || !messagesLoadedOnce) return;
    onVisitorProBotHasMessages(filteredMessages.length > 0);
  }, [onVisitorProBotHasMessages, isAdminView, selectedContact?.isProBot, messagesLoadedOnce, filteredMessages.length]);

  // Notify parent of last message (preview + time) for visitor's History Chat sidebar under "ProBot"
  useEffect(() => {
    if (!onVisitorProBotLastMessage || isAdminView || !selectedContact?.isProBot) return;
    const last = filteredMessages.length > 0
      ? filteredMessages.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
      : null;
    onVisitorProBotLastMessage(last?.body?.trim() ?? undefined, last?.created_at ?? undefined);
  }, [onVisitorProBotLastMessage, isAdminView, selectedContact?.isProBot, filteredMessages]);

  // When ProBot is selected, show conversation if we have messages; otherwise show welcome steps.
  // Show welcome only for customers (not admin/contractor), when role is known (avoids flash for admins before is-admin check), and when there are no messages.
  const isCustomer = !isAdmin && !isContractor;
  const showWelcome =
    roleKnown &&
    isCustomer &&
    !isAdminView &&
    selectedContact?.isProBot &&
    !error &&
    !hasChosenThisVisit &&
    filteredMessages.length === 0;

  // When a business contact is selected with no messages yet (e.g. from card Message button), show centered chat like ProBot welcome.
  const showBusinessEmptyChat =
    !isAdminView &&
    selectedContact != null &&
    !selectedContact.isProBot &&
    !loading &&
    !error &&
    filteredMessages.length === 0 &&
    messagesLoadedOnce;

  useEffect(() => {
    setHiTypedLength(0);
    setWhereStartTypedLength(0);
  }, [selectedContact?.id]);

  // When opened with ?contact= (e.g. from business card Message), focus the message input once the chat view is ready.
  // Focus in welcome (ProBot), business empty (centered), or normal messages view so user can type immediately.
  useEffect(() => {
    if (!focusInputTrigger || showEstimateForm || showProjectInfoFormView) return;
    const t = setTimeout(() => {
      messageInputRef.current?.focus();
    }, 200);
    return () => clearTimeout(t);
  }, [focusInputTrigger, showEstimateForm, showProjectInfoFormView, showWelcome, showBusinessEmptyChat]);

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
    async (body: string) => {
      if (!visitorId || sending) return;
      setSending(true);
      setError(null);
      const choiceAccountEstimate = tBot('choiceAccountEstimate');
      try {
        const displayName =
          isAuthenticated && user
            ? [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
            : undefined;
        const data = await sendMessageApi({
          conversationId: conversationId ?? undefined,
          visitorId,
          body,
          ...(businessId ? { businessId } : {}),
          ...(displayName ? { displayName } : {}),
          ...(isAuthenticated && user?.id ? { userId: user.id } : {}),
          ...(pendingAttachments.length > 0 ? { attachments: pendingAttachments } : {}),
        });
        if (data.message) {
          const msg = data.message as { id: string; conversationId?: string; sender: string; body: string; created_at: string; attachments?: ChatAttachment[] };
          const newMsg: ChatMessage = { ...msg, sender: msg.sender as 'visitor' | 'admin', attachments: msg.attachments ?? [] };
          setMessages((prev) => {
            const next: ChatMessage[] = [...prev, newMsg];
            if (selectedContact?.isProBot && !businessId) {
              const createAccountEstimateLabel = tBot('createAccountAndFreeEstimate');
              if (body === choiceAccountEstimate || body === createAccountEstimateLabel) {
                next.push({
                  id: `bot-reply-${Date.now()}`,
                  sender: 'admin',
                  body: t('replyAccountEstimate'),
                  created_at: new Date().toISOString(),
                  replyLinkUrl: `/${locale}/estimate`,
                  replyLinkLabel: t('replyAccountEstimateLink'),
                });
              }
            }
            return next;
          });
          if (!conversationId && (data as { conversationId?: string }).conversationId) {
            setConversationId((data as { conversationId?: string }).conversationId ?? null);
          }
          if (pendingAttachments.length > 0) setPendingAttachments([]);
          // Dismiss welcome so the sent message shows in the chat area
          if (selectedContact?.isProBot && !businessId) setHasChosenThisVisit(true);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to send');
      } finally {
        setSending(false);
      }
    },
    [visitorId, conversationId, businessId, setConversationId, sending, selectedContact?.isProBot, t, tBot, locale, isAuthenticated, user, pendingAttachments]
  );

  const sendAdminReply = useCallback(
    async (body: string, attachments?: ChatAttachment[]) => {
      if (!adminViewingConversation?.id || sending) return;
      const sentAs =
        isContractor && contractorBusinessId
          ? { businessId: contractorBusinessId }
          : isAdminView
            ? replyAs === 'business' && adminViewingConversation?.business_id
              ? { businessId: adminViewingConversation.business_id }
              : replyAs === 'hub_agent'
                ? 'hub_agent'
                : 'probot'
            : selectedContact?.isProBot
              ? 'probot'
              : selectedContact?.businessId
                ? { businessId: selectedContact.businessId }
                : 'probot';
      setSending(true);
      setError(null);
      try {
        const data = await sendAdminMessage({
          conversationId: adminViewingConversation.id,
          body,
          sentAs,
          ...(attachments?.length ? { attachments } : {}),
        });
        if (data.message) {
          const msg = data.message as {
            id: string; sender: string; body: string; created_at: string;
            attachments?: ChatAttachment[]; admin_sent_as?: string; business_id?: string;
            admin_user_id?: string; admin_avatar_url?: string | null; admin_display_name?: string | null;
          };
          const businessName =
            msg.admin_sent_as === 'business' && adminViewingConversation?.business_name
              ? adminViewingConversation.business_name
              : selectedContact && !selectedContact.isProBot ? selectedContact.name : undefined;
          setMessages((prev) => [
            ...prev,
            {
              id: msg.id,
              sender: 'admin' as const,
              body: msg.body,
              created_at: msg.created_at,
              attachments: msg.attachments ?? [],
              admin_sent_as: (msg.admin_sent_as as 'probot' | 'business' | 'hub_agent') ?? 'probot',
              business_id: msg.business_id,
              business_name: businessName,
              admin_user_id: msg.admin_user_id,
              admin_avatar_url: msg.admin_avatar_url ?? undefined,
              admin_display_name: msg.admin_display_name ?? undefined,
            },
          ]);
        }
        if (attachments?.length) setPendingAttachments([]);
        onAdminReplySent?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to send');
      } finally {
        setSending(false);
      }
    },
    [adminViewingConversation, isContractor, contractorBusinessId, selectedContact, replyAs, sending, onAdminReplySent]
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
      const total = pendingAttachments.length + files.length;
      if (total > 10) {
        setError(t('attachMax10'));
        e.target.value = '';
        return;
      }
      setUploadingAttach(true);
      setError(null);
      try {
        const formData = new FormData();
        formData.set('conversationId', conversationId ?? 'temp');
        formData.set('visitorId', visitorId ?? 'anon');
        for (let i = 0; i < files.length; i++) formData.append('file', files[i]);
        const res = await fetch('/api/storage/upload-chat-attachment', { method: 'POST', body: formData });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? 'Upload failed');
          return;
        }
        const list = (data.attachments ?? []) as ChatAttachment[];
        setPendingAttachments((prev) => [...prev, ...list].slice(0, 10));
      } catch {
        setError('Upload failed');
      } finally {
        setUploadingAttach(false);
        e.target.value = '';
      }
    },
    [conversationId, visitorId, pendingAttachments.length, t]
  );

  const removePendingAttachment = useCallback((index: number) => {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

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

  if (!selectedContact) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 p-4">
        <p className="text-sm text-gray-500">{t('selectContact')}</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col flex-1 min-h-0 overflow-hidden ${PROBOT_CHAT_BG}`}>
      {(!showWelcome || isAdminView) && (
        <div className="sticky top-0 z-10 border-b border-gray-200 px-4 py-2 shrink-0 bg-white flex items-center justify-between gap-2">
          {isAdminView && adminViewingConversation && onExitAdminConversation ? (
            <>
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={onExitAdminConversation}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors shrink-0 cursor-pointer"
                  aria-label={t('backToMyChat')}
                  title={t('backToMyChat')}
                >
                  <ArrowLeft className="w-5 h-5 text-gray-600" />
                </button>
                <p className="text-sm font-medium text-gray-800 truncate">
                  {adminViewingConversation.display_as_probot
                    ? t('conversationWithName', { name: 'ProBot' })
                    : adminViewingConversation.participant_type === 'contractor' && adminViewingConversation.business_name
                      ? t('conversationWithContractor', { name: adminViewingConversation.business_name })
                      : (() => {
                          const profileName =
                            (adminViewingConversation.profile_first_name || adminViewingConversation.profile_last_name)
                              ? [adminViewingConversation.profile_first_name, adminViewingConversation.profile_last_name].filter(Boolean).join(' ').trim()
                              : undefined;
                          const name = profileName || adminViewingConversation.visitor_display_name?.trim();
                          return name ? t('conversationWithName', { name }) : t('conversationWithCustomer');
                        })()}
                </p>
              </div>
            </>
          ) : (
          <>
          <div className="flex items-center gap-2 min-w-0">
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
            <h2 className="text-base font-semibold text-gray-800 truncate min-w-0">
              {selectedContact?.isProBot ? selectedContact.name : selectedContact?.name ?? ''}
            </h2>
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

      {loading && !showWelcome && !showAccountEstimateFlow ? (
        <div className="flex-1 flex items-center justify-center p-4 min-h-0">
          <p className="text-sm text-gray-500">{t('loading')}</p>
        </div>
      ) : (
        <>
          {/* Scrollable messages area: flex-1 min-h-0 so it gets a bounded height and scrolls on mobile. */}
          <div
            className={`flex-1 min-h-0 flex flex-col ${!showAccountEstimateFlow ? 'overflow-y-auto overflow-x-hidden overscroll-contain' : 'overflow-hidden'}`}
            style={{ WebkitOverflowScrolling: 'touch', minHeight: 0 } as React.CSSProperties}
          >
            {showWelcome ? (
              <div className="probot-welcome flex-1 flex flex-col items-center px-2 pt-6 pb-4 min-h-0 md:px-4">
                <div className="flex flex-col items-center text-center w-full md:w-[75%]">
                  <div className="flex items-center justify-center w-24 h-24 rounded-lg bg-white shadow-sm overflow-hidden shrink-0 mb-4">
                    {welcomeShowStaticImage ? (
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
                  <p className="text-lg text-gray-800 font-medium min-h-[1.75rem]">
                    {hiText.slice(0, hiTypedLength)}
                    {hiTypedLength < hiText.length && (
                      <span className="animate-pulse">|</span>
                    )}
                  </p>
                  <p className="text-[1.95rem] md:text-[2.7rem] text-gray-700 mt-1 whitespace-nowrap">{t('welcomeToMyPage')}</p>
                  <p className="text-[1.95rem] md:text-[2.7rem] font-medium text-gray-800 mt-0.5">{t('letsGetItDone')}</p>
                  <div className="flex justify-center w-full mt-4 mb-4 min-h-[1.5em]">
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
                  <div className="flex flex-wrap justify-center gap-2 mb-4">
                    <button
                      type="button"
                      onClick={() => {
                        setHasChosenThisVisit(true);
                        setUserChoice('account_estimate');
                        if (isAuthenticated) setShowProjectInfoForm(true);
                      }}
                      className="probot-sky-btn px-4 py-2.5 rounded-lg bg-white border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors cursor-pointer"
                    >
                      {isAuthenticated ? tBot('choiceRequestEstimate') : tBot('createAccountAndFreeEstimate')}
                    </button>
                  </div>
                  {!showAccountEstimateFlow && (
                    <div className="w-full max-w-[95%]">
                      {pendingAttachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {pendingAttachments.map((att, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-sm"
                            >
                              {att.contentType.startsWith('image/') ? (
                                <ImageIcon className="w-4 h-4 shrink-0" />
                              ) : (
                                <Paperclip className="w-4 h-4 shrink-0" />
                              )}
                              <span className="max-w-[120px] truncate">{att.name}</span>
                              <button
                                type="button"
                                onClick={() => removePendingAttachment(i)}
                                className="shrink-0 text-gray-500 hover:text-red-600"
                                aria-label="Remove"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      <form
                        onSubmit={handleSubmit}
                        className="w-full rounded-2xl border-2 border-black bg-gray-50/80 hover:bg-gray-50 focus-within:bg-white focus-within:ring-2 focus-within:ring-black/10 transition-all py-1.5 pl-1.5 pr-1.5"
                      >
                        <div className="flex items-center gap-2 w-full">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*,application/pdf"
                            multiple
                            className="hidden"
                            onChange={handleFileSelect}
                          />
                          <div className="relative shrink-0">
                            <button
                              type="button"
                              onClick={() => setAttachMenuOpen((o) => !o)}
                              disabled={uploadingAttach || pendingAttachments.length >= 10}
                              className="p-2.5 rounded-full text-black hover:text-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer hover:animate-pulse"
                              aria-label={t('attachFiles')}
                              aria-expanded={attachMenuOpen}
                            >
                              <Plus className="w-5 h-5" />
                            </button>
                            {attachMenuOpen && (
                              <>
                                <div
                                  className="fixed inset-0 z-10"
                                  aria-hidden
                                  onClick={() => setAttachMenuOpen(false)}
                                />
                                <div className="absolute bottom-full left-0 mb-1 w-52 rounded-lg border border-gray-200 bg-white py-1 shadow-lg z-20">
                                  <button
                                    type="button"
                                    onClick={() => { fileInputRef.current?.click(); setAttachMenuOpen(false); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                                  >
                                    <Paperclip className="w-4 h-4" />
                                    {t('uploadFiles')}
                                  </button>
                                  <a
                                    href="https://drive.google.com"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => setAttachMenuOpen(false)}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                                  >
                                    <Cloud className="w-4 h-4" />
                                    {t('addFromGoogleDrive')}
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => { fileInputRef.current?.click(); setAttachMenuOpen(false); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                                  >
                                    <ImageIcon className="w-4 h-4" />
                                    {t('photos')}
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                          <input
                            ref={messageInputRef}
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder={isAdminView ? t('replyToCustomer') : t('messagePlaceholder')}
                            className="flex-1 min-w-0 py-3 text-base bg-transparent border-0 focus:outline-none focus:ring-0 placeholder:text-gray-500"
                            disabled={sending}
                            maxLength={2000}
                          />
                          <button
                            type="submit"
                            disabled={(!inputValue.trim() && pendingAttachments.length === 0) || sending}
                            className={`send-button-plane p-2.5 rounded-lg bg-black text-white flex items-center justify-center shrink-0 cursor-pointer hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors overflow-visible ${(inputValue.trim() || pendingAttachments.length > 0) ? 'has-text' : ''}`}
                            aria-label={t('send')}
                          >
                            <span className="send-plane-icon inline-block text-white">
                              <Send className="w-5 h-5" stroke="currentColor" />
                            </span>
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>
              </div>
            ) : showEstimateForm ? (
              <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
                <ChatSignupForm
                  showBackToChoice
                  onCancel={() => {
                    setUserChoice(null);
                    setHasChosenThisVisit(false);
                  }}
                  onSuccess={() => setEstimateSubmitted(true)}
                  onStepIndexChange={setSignupStepIndex}
                />
              </div>
            ) : showProjectInfoFormView ? (
              <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
                <ChatEstimateForm
                  key={estimateFormKey}
                  onSuccess={() => setProjectEstimateSubmitted(true)}
                  onBack={() => {
                    setShowProjectInfoForm(false);
                    if (isAuthenticated) {
                      setUserChoice(null);
                      setHasChosenThisVisit(false);
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
                      {tBot('estimateSuccessMessageLine1')}
                    </h2>
                    <p className="text-gray-700">
                      {tBot('estimateSuccessMessageLine2')}
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
              <div className="flex-1 flex flex-col items-center justify-center px-2 pt-6 pb-4 min-h-0 w-full">
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
                  <p className="text-xl font-semibold text-gray-900 mb-6">
                    {t('chatWithBusiness', { name: selectedContact?.name ?? '' })}
                  </p>
                  <form
                    onSubmit={handleSubmit}
                    className="w-full max-w-[95%] rounded-2xl border-2 border-black bg-gray-50/80 hover:bg-gray-50 focus-within:bg-white focus-within:ring-2 focus-within:ring-black/10 transition-all py-1.5 pl-1.5 pr-1.5"
                  >
                    {pendingAttachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {pendingAttachments.map((att, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-sm"
                          >
                            {att.contentType.startsWith('image/') ? (
                              <ImageIcon className="w-4 h-4 shrink-0" />
                            ) : (
                              <Paperclip className="w-4 h-4 shrink-0" />
                            )}
                            <span className="max-w-[120px] truncate">{att.name}</span>
                            <button
                              type="button"
                              onClick={() => removePendingAttachment(i)}
                              className="shrink-0 text-gray-500 hover:text-red-600"
                              aria-label="Remove"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2 w-full">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,application/pdf"
                        multiple
                        className="hidden"
                        onChange={handleFileSelect}
                      />
                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={() => setAttachMenuOpen((o) => !o)}
                          disabled={uploadingAttach || pendingAttachments.length >= 10}
                          className="p-2.5 rounded-full text-black hover:text-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer hover:animate-pulse"
                          aria-label={t('attachFiles')}
                          aria-expanded={attachMenuOpen}
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                        {attachMenuOpen && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              aria-hidden
                              onClick={() => setAttachMenuOpen(false)}
                            />
                            <div className="absolute bottom-full left-0 mb-1 w-52 rounded-lg border border-gray-200 bg-white py-1 shadow-lg z-20">
                              <button
                                type="button"
                                onClick={() => { fileInputRef.current?.click(); setAttachMenuOpen(false); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                              >
                                <Paperclip className="w-4 h-4" />
                                {t('uploadFiles')}
                              </button>
                              <a
                                href="https://drive.google.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => setAttachMenuOpen(false)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                              >
                                <Cloud className="w-4 h-4" />
                                {t('addFromGoogleDrive')}
                              </a>
                              <button
                                type="button"
                                onClick={() => { fileInputRef.current?.click(); setAttachMenuOpen(false); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                              >
                                <ImageIcon className="w-4 h-4" />
                                {t('photos')}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                      <input
                        ref={messageInputRef}
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder={t('messagePlaceholder')}
                        className="flex-1 min-w-0 py-3 text-base bg-transparent border-0 focus:outline-none focus:ring-0 placeholder:text-gray-500"
                        disabled={sending}
                        maxLength={2000}
                      />
                      <button
                        type="submit"
                        disabled={(!inputValue.trim() && pendingAttachments.length === 0) || sending}
                        className="send-button-plane p-2.5 rounded-lg bg-black text-white flex items-center justify-center shrink-0 cursor-pointer hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors overflow-visible"
                        aria-label={t('send')}
                      >
                        <span className="send-plane-icon inline-block text-white">
                          <Send className="w-5 h-5" stroke="currentColor" />
                        </span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            ) : (
              <>
                {error && (
                  <p className="text-sm text-red-600 px-4 pt-4">{error}</p>
                )}
                <ProBotMessageList
                  messages={filteredMessages}
                  isAdminView={isAdminView}
                  adminViewingConversation={adminViewingConversation ?? null}
                  selectedContact={selectedContact}
                  visitorAvatarUrl={
                    isAdminView && adminViewingConversation
                      ? adminViewingConversation.participant_type === 'contractor' && adminViewingConversation.business_logo
                        ? adminViewingConversation.business_logo
                        : adminViewingConversation.profile_user_picture ?? null
                      : user?.userPicture ?? null
                  }
                />
              </>
            )}
          </div>

          {!showAccountEstimateFlow && !showWelcome && !showBusinessEmptyChat && (
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
                className="shrink-0 w-full px-4 py-3 pl-[max(1rem,calc(52px+0.5rem))] md:pl-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 bg-white border-t border-gray-200/90 shadow-[0_-2px_10px_rgba(0,0,0,0.04)]"
              >
              {isAdminView && adminViewingConversation && (
                <div className="max-w-5xl mx-auto flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-gray-500 shrink-0">{t('replyAs')}</span>
                  <div className="flex rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
                    <button
                      type="button"
                      onClick={() => setReplyAs('probot')}
                      className={`px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${replyAs === 'probot' ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                    >
                      {t('replyAsProBot')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setReplyAs('hub_agent')}
                      className={`px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer border-l border-gray-200 ${replyAs === 'hub_agent' ? 'bg-gray-900 text-white border-l-gray-600' : 'text-gray-700 hover:bg-gray-100'}`}
                    >
                      {t('replyAsHubAgent')}
                    </button>
                    {adminViewingConversation.participant_type === 'contractor' && adminViewingConversation.business_id && (
                      <button
                        type="button"
                        onClick={() => setReplyAs('business')}
                        className={`px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer border-l border-gray-200 ${replyAs === 'business' ? 'bg-gray-900 text-white border-l-gray-600' : 'text-gray-700 hover:bg-gray-100'}`}
                      >
                        {t('replyAsBusiness')}
                      </button>
                    )}
                  </div>
                </div>
              )}
              {pendingAttachments.length > 0 && (
                <div className="max-w-3xl mx-auto flex flex-wrap gap-2 mb-2">
                  {pendingAttachments.map((att, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-sm"
                    >
                      {att.contentType.startsWith('image/') ? (
                        <ImageIcon className="w-4 h-4 shrink-0" />
                      ) : (
                        <Paperclip className="w-4 h-4 shrink-0" />
                      )}
                      <span className="max-w-[120px] truncate">{att.name}</span>
                      <button
                        type="button"
                        onClick={() => removePendingAttachment(i)}
                        className="shrink-0 text-gray-500 hover:text-red-600"
                        aria-label="Remove"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="max-w-5xl mx-auto flex items-center gap-2 w-full rounded-2xl border-2 border-black bg-gray-50/80 hover:bg-gray-50 focus-within:bg-white focus-within:ring-2 focus-within:ring-black/10 focus-within:ring-offset-0 transition-all py-1.5 pl-1.5 pr-1.5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setAttachMenuOpen((o) => !o)}
                    disabled={uploadingAttach || pendingAttachments.length >= 10}
                    className="p-2.5 rounded-full text-black hover:text-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer hover:animate-pulse"
                    aria-label={t('attachFiles')}
                    aria-expanded={attachMenuOpen}
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                  {attachMenuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        aria-hidden
                        onClick={() => setAttachMenuOpen(false)}
                      />
                      <div className="absolute bottom-full left-0 mb-1 w-52 rounded-lg border border-gray-200 bg-white py-1 shadow-lg z-20">
                        <button
                          type="button"
                          onClick={() => { fileInputRef.current?.click(); setAttachMenuOpen(false); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                        >
                          <Paperclip className="w-4 h-4" />
                          {t('uploadFiles')}
                        </button>
                        <a
                          href="https://drive.google.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setAttachMenuOpen(false)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                        >
                          <Cloud className="w-4 h-4" />
                          {t('addFromGoogleDrive')}
                        </a>
                        <button
                          type="button"
                          onClick={() => { fileInputRef.current?.click(); setAttachMenuOpen(false); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                        >
                          <ImageIcon className="w-4 h-4" />
                          {t('photos')}
                        </button>
                      </div>
                    </>
                  )}
                </div>
                <input
                  ref={messageInputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={isAdminView ? t('replyToCustomer') : t('messagePlaceholder')}
                  className="flex-1 min-w-0 py-3 text-base bg-transparent border-0 focus:outline-none focus:ring-0 placeholder:text-gray-500"
                  disabled={sending}
                  maxLength={2000}
                />
                <button
                  type="submit"
                  disabled={(!inputValue.trim() && pendingAttachments.length === 0) || sending}
                  className={`send-button-plane p-2.5 rounded-lg bg-black text-white flex items-center justify-center shrink-0 cursor-pointer hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors overflow-visible ${(inputValue.trim() || pendingAttachments.length > 0) ? 'has-text' : ''}`}
                  aria-label={t('send')}
                >
                  <span className="send-plane-icon inline-block text-white">
                    <Send className="w-5 h-5" stroke="currentColor" />
                  </span>
                </button>
              </div>
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
    </div>
  );
}
