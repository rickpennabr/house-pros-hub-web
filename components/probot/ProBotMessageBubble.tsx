'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Mic, RotateCcw, ThumbsDown, ThumbsUp, Building2, User, Check, CheckCheck, ChevronDown, Copy, Download, ImageIcon, Reply, Trash2, UserPlus, CalendarDays, Home as HomeIcon, FileText, Receipt, Sprout } from 'lucide-react';
import { ChatMediaAttachment } from '@/components/chat/ChatMediaAttachment';
import { ProbotWorkWord } from '@/components/probot/ProbotWorkWord';
import { ExpenseDraftCard } from '@/components/probot/ExpenseDraftCard';
import { ProActionCard } from '@/components/probot/ProActionCard';
import { useChatOptional } from '@/contexts/ChatContext';
import ChatEstimateShareCard from '@/components/chat/ChatEstimateShareCard';
import ChatInvoiceShareCard from '@/components/chat/ChatInvoiceShareCard';
import ChatDocCard, { CHAT_DOC_BUBBLE_WIDTH } from '@/components/chat/ChatDocCard';
import { LeadOfferCard } from '@/components/probot/LeadOfferCard';
import { ProbotFollowupCard } from '@/components/probot/ProbotFollowupCard';
import { PROBOT_ASSETS } from '@/lib/constants/probot';
import type { ChatCrmEstimateShare, ChatMessage } from '@/lib/types/chat';
import ProAgentCards from './ProAgentCards';
import { MessageActionsMenu, type MessageAction } from './MessageActionsMenu';
import type { ProBotContact, ProBotRecentConversation } from './ProBotSidebar';

interface ProBotMessageBubbleProps {
  msg: ChatMessage;
  isAdminView: boolean;
  adminViewingConversation: ProBotRecentConversation | null;
  selectedContact: ProBotContact | null;
  visitorAvatarUrl: string | null;
  /** Business branding when replying in a customer→pro thread */
  businessReplyName?: string | null;
  businessReplyLogo?: string | null;
  confirmingStepId?: string | null;
  onConfirmEstimate?: (stepId: string) => void;
  onEditEstimate?: () => void;
  onReply?: (msg: ChatMessage) => void;
  onCrmEstimateApproved?: (messageId: string, next: ChatCrmEstimateShare) => void;
  /** Shown on the viewer's own messages. Deletes for everyone. */
  onDelete?: (msg: ChatMessage) => void;
  /** Set or clear the viewer's emoji reaction (null clears). */
  onReact?: (msg: ChatMessage, emoji: string | null) => void;
  /** Pro side: add the customer who shared a place to the CRM. */
  onAddPlaceToCrm?: (msg: ChatMessage) => Promise<void>;
  /** Customer side: open the shared calendar to pick a time. */
  onPickTime?: (msg: ChatMessage) => void;
  /** Pro view: open the estimate / invoice picker for this customer. */
  onCrmQuickAction?: (kind: 'estimate' | 'invoice') => void;
  /** While ProBot works on a reply: what it is doing ("Thinking…"), shown in its draft bubble. */
  draftStatus?: string | null;
  /** Admin: correct a wrong plant identification on a ProBot answer. */
  onCorrectPlant?: (msg: ChatMessage) => void;
  /** ProBot chat (Gemini-style): answers as plain text with actions under them, your messages in a gray bubble. */
  assistantLayout?: boolean;
  /** 👍 / 👎 on a ProBot answer (null clears). */
  onFeedback?: (msg: ChatMessage, value: 'up' | 'down' | null) => void;
  /** Ask again: resend the message this answer replied to. */
  onRetry?: (msg: ChatMessage) => void;
  /** Only on the latest answer: its next-step buttons send the text. */
  onSuggestion?: (text: string) => void;
}

export default function ProBotMessageBubble({
  msg,
  isAdminView,
  adminViewingConversation,
  selectedContact,
  visitorAvatarUrl,
  businessReplyName,
  businessReplyLogo,
  confirmingStepId,
  onConfirmEstimate,
  onEditEstimate,
  onReply,
  onCrmEstimateApproved,
  onDelete,
  onReact,
  onAddPlaceToCrm,
  onPickTime,
  onCrmQuickAction,
  draftStatus,
  onCorrectPlant,
  assistantLayout = false,
  onFeedback,
  onRetry,
  onSuggestion,
}: ProBotMessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const chatContext = useChatOptional();
  const [addingToCrm, setAddingToCrm] = useState(false);
  const [crmError, setCrmError] = useState<string | null>(null);
  const [menu, setMenu] = useState<null | 'below' | 'above'>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t = useTranslations('probot');
  const locale = useLocale();
  const isVisitor = msg.sender === 'visitor';
  /** WhatsApp layout: the viewer's own messages sit on the right in green. */
  const isOwn = isAdminView ? !isVisitor : isVisitor;
  const body = typeof msg.body === 'string' ? msg.body : '';
  /** ProBot's reply while it is still being written (ProBotChatArea adds it as "stream-…"). */
  const isDraft = msg.sender === 'admin' && msg.id.startsWith('stream-');
  /** Place cards replace their plain-text body. */
  const draftRecording = /recording/i.test(draftStatus ?? '');
  const isVoiceNote = Boolean(msg.attachments?.some((att) => att.name.startsWith('voice-note')));
  const showBody = Boolean(body.trim()) && !msg.payload?.placeShare && !msg.payload?.placeLinked && !msg.payload?.leadOffer && !msg.payload?.followup;
  /** Document cards share one width, whatever the caption length. */
  const hasDocCard = Boolean(
    msg.payload?.crmEstimate ||
      msg.payload?.crmInvoice ||
      msg.payload?.bookingInvite ||
      msg.payload?.placeShare ||
      msg.payload?.placeLinked ||
      msg.payload?.leadOffer ||
      msg.payload?.followup
  );

  /**
   * The AI writes light markdown: **bold**, *italic* / _italic_, and "- " or "* " list lines.
   * Show it formatted instead of raw asterisks. Links stay clickable.
   */
  const renderInline = (text: string, keyPrefix: string) =>
    text.split(/(\*\*[^*\n]+\*\*|\*[^*\s][^*\n]*\*|_[^_\s][^_\n]*_)/g).map((part, index) => {
      const key = `${keyPrefix}-${index}`;
      if (/^\*\*[^*\n]+\*\*$/.test(part)) return <strong key={key}>{part.slice(2, -2)}</strong>;
      if (/^\*[^*\s][^*\n]*\*$/.test(part) || /^_[^_\s][^_\n]*_$/.test(part)) return <em key={key}>{part.slice(1, -1)}</em>;
      return <span key={key}>{part}</span>;
    });

  const renderBody = (raw: string) => {
    // List lines: "- item" / "* item" → "• item" (whitespace-pre-wrap keeps the line breaks).
    const text = raw.replace(/^([ \t]*)[-*][ \t]+/gm, '$1• ');
    return text.split(/(https?:\/\/[^\s]+)/g).map((part, index) =>
      /^https?:\/\//.test(part) ? (
        <a
          key={`${part}-${index}`}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="underline break-all text-blue-700"
        >
          {part}
        </a>
      ) : (
        <span key={`t-${index}`}>{renderInline(part, `t-${index}`)}</span>
      )
    );
  };

  // Customer→pro threads: contractor replies are the business, not ProBot (even if older rows were tagged probot).
  const isBusinessThread = Boolean(adminViewingConversation?.business_id || msg.business_id);
  const isHubAgent = msg.admin_sent_as === 'hub_agent';
  const isBusinessReply =
    !isVisitor &&
    !isHubAgent &&
    (msg.admin_sent_as === 'business' ||
      Boolean(msg.business_id) ||
      (isAdminView && isBusinessThread));
  const businessName =
    msg.business_name ||
    businessReplyName ||
    (selectedContact?.businessId ? selectedContact.name : undefined) ||
    'Business';
  const businessLogo = businessReplyLogo || selectedContact?.logo || null;

  const avatarContent = isVisitor ? (
    visitorAvatarUrl ? (
      <img src={visitorAvatarUrl} alt="" width={32} height={32} className="w-full h-full object-cover" />
    ) : (
      <User className="w-4 h-4 text-gray-300" aria-hidden />
    )
  ) : isBusinessReply ? (
    businessLogo ? (
      <img src={businessLogo} alt="" width={32} height={32} className="w-full h-full object-cover" />
    ) : (
      <Building2 className="w-4 h-4 text-gray-500" aria-hidden />
    )
  ) : isHubAgent && msg.admin_avatar_url ? (
    <img src={msg.admin_avatar_url} alt="" width={32} height={32} className="w-full h-full object-cover" />
  ) : msg.admin_avatar_url ? (
    <img src={msg.admin_avatar_url} alt="" width={32} height={32} className="w-full h-full object-cover" />
  ) : (
    <Image
      src={isDraft ? PROBOT_ASSETS.avatarAnimated : PROBOT_ASSETS.avatar}
      alt=""
      width={32}
      height={32}
      unoptimized={isDraft}
      className="w-full h-full object-contain"
    />
  );

  /** Open the menu above the arrow when the message sits low in the window. */
  const openMenu = () => {
    const rect = bubbleRef.current?.getBoundingClientRect();
    setMenu(rect && rect.top > window.innerHeight * 0.55 ? 'above' : 'below');
  };
  const cancelPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };

  const downloadAttachment = async (url: string, name: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = href;
      link.download = name || 'file';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    } catch {
      window.open(url, '_blank', 'noopener');
    }
  };

  const myReaction = msg.reactions?.[isAdminView ? 'admin' : 'visitor'];
  const reactionList = [msg.reactions?.visitor, msg.reactions?.admin].filter((emoji): emoji is string => Boolean(emoji));
  const attachmentsToSave = (msg.attachments ?? []).filter((att) => !att.contentType.startsWith('audio/')).slice(0, 3);
  const menuActions: MessageAction[] = [
    ...(onReply ? [{ key: 'reply', icon: <Reply className="h-4 w-4" />, label: t('reply'), onClick: () => onReply(msg) }] : []),
    ...(body.trim()
      ? [{ key: 'copy', icon: <Copy className="h-4 w-4" />, label: t('copyMessage'), onClick: () => void navigator.clipboard?.writeText(body) }]
      : []),
    ...attachmentsToSave.map((att, index) => ({
      key: `download-${index}`,
      icon: <Download className="h-4 w-4" />,
      label: attachmentsToSave.length > 1 ? `${t('downloadFile')} ${index + 1}` : t('downloadFile'),
      onClick: () => void downloadAttachment(att.url, att.name),
    })),
    ...(onDelete
      ? [{ key: 'delete', icon: <Trash2 className="h-4 w-4" />, label: t('deleteMessageShort'), onClick: () => onDelete(msg), danger: true }]
      : []),
  ];
  const hasMenu = menuActions.length > 0 || Boolean(onReact);

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} ${reactionList.length > 0 ? 'mb-3' : ''}`}>
      <div
        ref={bubbleRef}
        onContextMenu={(event) => {
          if (!hasMenu) return;
          event.preventDefault();
          openMenu();
        }}
        onTouchStart={() => {
          if (!hasMenu) return;
          cancelPress();
          pressTimer.current = setTimeout(openMenu, 500);
        }}
        onTouchEnd={cancelPress}
        onTouchMove={cancelPress}
        className={
          assistantLayout
            ? `group relative max-md:select-none max-md:[-webkit-touch-callout:none] flex items-start text-[15px] leading-relaxed text-gray-900 ${
                isOwn ? 'max-w-[80%] rounded-lg bg-gray-100 px-4 py-2.5' : `${hasDocCard ? CHAT_DOC_BUBBLE_WIDTH : 'w-full'} px-1 py-1`
              }`
            : `group relative max-md:select-none max-md:[-webkit-touch-callout:none] ${hasDocCard ? CHAT_DOC_BUBBLE_WIDTH : 'max-w-[85%]'} rounded-lg px-2.5 py-1.5 text-sm text-gray-900 flex items-start gap-2 shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] ${
                isOwn ? 'rounded-tr-none bg-[#d9fdd3]' : 'rounded-tl-none bg-white'
              }`
        }
      >
        {assistantLayout ? null : (
          <div className="w-8 h-8 shrink-0 rounded-lg border-2 border-black overflow-hidden bg-gray-200 flex items-center justify-center">
            {avatarContent}
          </div>
        )}
        {hasMenu ? (
          <button
            type="button"
            onClick={() => (menu ? setMenu(null) : openMenu())}
            className={`absolute right-1 top-1 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-gray-500 transition-opacity hover:text-black ${
              assistantLayout ? (isOwn ? 'bg-gray-100' : 'bg-transparent') : isOwn ? 'bg-[#d9fdd3]' : 'bg-white'
            } ${menu ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus:opacity-100 max-md:hidden'}`}
            aria-label={t('messageMenu')}
            aria-haspopup="menu"
            aria-expanded={Boolean(menu)}
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        ) : null}
        {menu ? (
          <MessageActionsMenu
            align={isOwn ? 'right' : 'left'}
            placement={menu}
            myReaction={myReaction}
            onReact={onReact ? (emoji) => onReact(msg, emoji) : undefined}
            actions={menuActions}
            onClose={() => setMenu(null)}
          />
        ) : null}
        {reactionList.length > 0 ? (
          <button
            type="button"
            onClick={() => onReact && myReaction && onReact(msg, null)}
            title={myReaction ? t('removeReaction') : undefined}
            className={`absolute -bottom-3.5 ${isOwn ? 'right-3' : 'left-12'} z-10 flex cursor-pointer items-center gap-0.5 rounded-md border border-black/10 bg-white px-1.5 py-0.5 text-sm leading-none shadow-sm`}
          >
            {reactionList.map((emoji, index) => (
              <span key={`${emoji}-${index}`}>{emoji}</span>
            ))}
            {reactionList.length > 1 ? <span className="ml-0.5 text-xs text-gray-500">{reactionList.length}</span> : null}
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          {msg.sender === 'admin' && !assistantLayout && (
            <p className="text-xs font-medium text-gray-500 mb-1">
              {isBusinessReply
                ? businessName
                : isHubAgent
                  ? (msg.admin_display_name || t('replyAsHubAgent'))
                  : 'ProBot'}
            </p>
          )}
          {msg.replyTo ? (
            <p className="mb-1 truncate border-l-2 border-current/40 pl-2 text-xs opacity-80">
              {msg.replyTo.kind === 'photo'
                ? t('photoPlaceholder')
                : msg.replyTo.kind === 'video'
                  ? t('videoLabel')
                  : msg.replyTo.kind === 'voice'
                    ? t('voiceNote')
                    : msg.replyTo.kind === 'file'
                      ? msg.replyTo.body || t('fileLabel')
                      : msg.replyTo.body}
            </p>
          ) : null}
          {isDraft && !body.trim() ? (
            <p className="flex items-center gap-2 text-gray-500" aria-live="polite">
              <span className="flex gap-1" aria-hidden>
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" />
              </span>
              {!draftStatus || /^(Thinking|Writing)/.test(draftStatus) ? (
                <ProbotWorkWord />
              ) : draftStatus ? (
                <span className={`flex items-center gap-1 text-xs ${draftRecording ? 'font-medium text-green-700' : ''}`}>
                  {draftRecording ? <Mic className="h-3.5 w-3.5 animate-pulse" aria-hidden /> : null}
                  {draftStatus}
                </span>
              ) : null}
            </p>
          ) : null}
          {showBody ? (
            <p className="min-w-0 whitespace-pre-wrap break-words pr-5 leading-relaxed">{renderBody(body)}</p>
          ) : null}
          {msg.payload?.links?.length && !isOwn && !isAdminView ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {msg.payload.links.map((link) => (
                <a
                  key={link.href}
                  href={`/${locale}${link.href}`}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-800 hover:border-black"
                >
                  {link.label} →
                </a>
              ))}
            </div>
          ) : null}
          {msg.payload?.proAction && !isOwn && !isAdminView ? (
            <ProActionCard
              action={msg.payload.proAction}
              onDone={() => {
                const visitorId = chatContext?.visitorId;
                if (!visitorId) return;
                void fetch('/api/chat/messages', {
                  method: 'PATCH',
                  credentials: 'include',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ id: msg.id, visitorId, actionDone: true }),
                }).catch(() => undefined);
              }}
            />
          ) : null}
          {msg.payload?.expenseDraft && !isOwn ? (
            <ExpenseDraftCard
              draft={msg.payload.expenseDraft}
              onSaved={(expenseId) => {
                const visitorId = chatContext?.visitorId;
                if (!visitorId) return;
                void fetch('/api/chat/messages', {
                  method: 'PATCH',
                  credentials: 'include',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ id: msg.id, visitorId, expenseSavedId: expenseId }),
                }).catch(() => undefined);
              }}
            />
          ) : null}
          {msg.payload?.plantId ? (
            msg.payload.plantId.correctedTo ? (
              <p className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-green-700 px-2 py-0.5 text-xs text-green-800">
                <Sprout className="h-3.5 w-3.5" aria-hidden />
                {t('plantCorrected', { name: msg.payload.plantId.correctedTo })}
              </p>
            ) : onCorrectPlant ? (
              <button
                type="button"
                onClick={() => onCorrectPlant(msg)}
                className="mt-1.5 inline-flex cursor-pointer items-center gap-1 rounded-md border border-black px-2 py-0.5 text-xs font-medium hover:bg-gray-50"
              >
                <Sprout className="h-3.5 w-3.5 text-red-500" aria-hidden />
                {t('plantCorrect')}
              </button>
            ) : null
          ) : null}
          {msg.payload?.bookingInvite ? (
            <ChatDocCard
              tone="calendar"
              icon={<CalendarDays className="h-5 w-5" />}
              eyebrow={t('docCalendarEyebrow')}
              title={t('bookingInviteTitle', { name: msg.payload.bookingInvite.businessName || businessName })}
            >
              <div className="bg-gray-50 px-3 py-3">
                {onPickTime ? (
                  <button
                    type="button"
                    onClick={() => onPickTime(msg)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-900"
                  >
                    <CalendarDays className="h-4 w-4" />
                    {t('bookingInvitePick')}
                  </button>
                ) : (
                  <p className="text-center text-xs text-gray-600">{t('bookingInviteSent')}</p>
                )}
              </div>
            </ChatDocCard>
          ) : null}
          {msg.payload?.placeShare ? (
            <ChatDocCard
              tone="place"
              icon={<HomeIcon className="h-5 w-5" aria-hidden />}
              eyebrow={t('placeShareCardTitle')}
              title={msg.payload.placeShare.name}
              subtitle={msg.payload.placeShare.address}
            >
              <div className="flex flex-col gap-2 bg-gray-50 px-3 py-3">
              {msg.payload.placeShare.crmCustomerId ? (
                <p className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
                  <Check className="h-3.5 w-3.5" />
                  {isAdminView ? t('placeShareInCrm') : t('placeShareLinkedBy', { name: businessName })}
                </p>
              ) : onAddPlaceToCrm ? (
                <div>
                  <button
                    type="button"
                    disabled={addingToCrm}
                    onClick={async () => {
                      setAddingToCrm(true);
                      setCrmError(null);
                      try {
                        await onAddPlaceToCrm(msg);
                      } catch (err) {
                        setCrmError(err instanceof Error ? err.message : t('placeShareFailed'));
                      } finally {
                        setAddingToCrm(false);
                      }
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-900 disabled:opacity-60"
                  >
                    <UserPlus className="h-4 w-4 text-red-500" />
                    {addingToCrm ? t('placeShareAdding') : t('placeShareAddToCrm')}
                  </button>
                  <p className="mt-1 text-xs text-gray-500">{t('placeShareAddHint')}</p>
                  {crmError ? <p className="mt-1 text-xs text-red-600">{crmError}</p> : null}
                </div>
              ) : !isAdminView ? (
                <p className="text-xs text-gray-500">{t('placeShareWaiting', { name: businessName })}</p>
              ) : null}
              {!isAdminView ? (
                <Link
                  href={`/${locale}/myplaces/${msg.payload.placeShare.placeId}`}
                  className="inline-flex w-full items-center justify-center rounded-lg border-2 border-black bg-white px-4 py-2.5 text-sm font-semibold text-black hover:bg-gray-50"
                >
                  {t('placeOpenInMyPlaces')}
                </Link>
              ) : null}
              </div>
            </ChatDocCard>
          ) : null}
          {msg.payload?.leadOffer ? (
            <LeadOfferCard key={`${msg.payload.leadOffer.referralId}-${msg.payload.leadOffer.status}`} lead={msg.payload.leadOffer} canAnswer={!isAdminView} />
          ) : null}
          {msg.payload?.morningBrief && !isAdminView ? (
            <Link
              href={`/${locale}/crm/probot-settings`}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-gray-600 underline hover:text-black"
            >
              {msg.payload.morningBrief.locale === 'es' ? 'Ajustes del resumen' : msg.payload.morningBrief.locale === 'pt' ? 'Ajustes do resumo' : 'Brief settings'}
            </Link>
          ) : null}
          {msg.payload?.followup ? (
            <ProbotFollowupCard key={`${msg.payload.followup.followupId}-${msg.payload.followup.status}`} card={msg.payload.followup} canAnswer={!isAdminView} />
          ) : null}
          {msg.payload?.placeLinked ? (
            <ChatDocCard
              tone="place"
              icon={<HomeIcon className="h-5 w-5" aria-hidden />}
              eyebrow={t('docPlaceEyebrow')}
              title={msg.payload.placeLinked.name}
            >
              <div className="flex flex-col gap-2 bg-gray-50 px-3 py-3">
                <p className="flex items-start gap-1.5 text-sm font-semibold text-gray-900">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                  {t('placeLinkedTitle', { business: businessName, place: msg.payload.placeLinked.name })}
                </p>
                <p className="text-xs text-gray-600">
                  {isAdminView ? t('placeLinkedProHint') : t('placeLinkedCustomerHint', { business: businessName })}
                </p>
                {isAdminView && onCrmQuickAction ? (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onCrmQuickAction('estimate')}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-black px-3 py-2.5 text-sm font-semibold text-white hover:bg-gray-900"
                    >
                      <FileText className="h-4 w-4" />
                      {t('crmNewEstimate')}
                    </button>
                    <button
                      type="button"
                      onClick={() => onCrmQuickAction('invoice')}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border-2 border-black bg-white px-3 py-2.5 text-sm font-semibold text-black hover:bg-gray-50"
                    >
                      <Receipt className="h-4 w-4" />
                      {t('crmNewInvoice')}
                    </button>
                  </div>
                ) : !isAdminView ? (
                  <Link
                    href={`/${locale}/myplaces/${msg.payload.placeLinked.placeId}`}
                    className="inline-flex w-full items-center justify-center rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-900"
                  >
                    {t('placeOpenInMyPlaces')}
                  </Link>
                ) : null}
              </div>
            </ChatDocCard>
          ) : null}
          {msg.payload?.crmEstimate ? (
            <ChatEstimateShareCard
              estimate={msg.payload.crmEstimate}
              canApprove={!isAdminView}
              onApproved={(next) => onCrmEstimateApproved?.(msg.id, next)}
            />
          ) : null}
          {msg.payload?.crmInvoice ? (
            <ChatInvoiceShareCard invoice={msg.payload.crmInvoice} canPay={!isAdminView} />
          ) : null}
          {msg.payload && (msg.payload.pros || msg.payload.confirm || msg.payload.confirmed) ? (
            <ProAgentCards
              payload={msg.payload}
              canConfirm={!isAdminView && !msg.payload.confirmed}
              confirming={confirmingStepId === msg.payload.confirm?.stepId}
              onConfirm={onConfirmEstimate}
              onEdit={onEditEstimate}
            />
          ) : null}
          {msg.attachments?.length ? (
            <div className="mt-2 space-y-2">
              {msg.attachments.map((att, i) => (
                <ChatMediaAttachment key={`${att.url}-${i}`} att={att} />
              ))}
            </div>
          ) : null}
          {isVisitor && !body.trim() && !msg.attachments?.length ? (
            <div className={`flex items-center gap-2 py-2 text-gray-500`}>
              <ImageIcon className="w-5 h-5 shrink-0 opacity-70" />
              <span className="text-sm italic">{t('photoPlaceholder')}</span>
            </div>
          ) : null}
          {assistantLayout ? (
            !isOwn && !isDraft && (showBody || msg.attachments?.length) ? (
              <div className="mt-1.5 flex items-center gap-0.5 text-gray-500">
                {onFeedback ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onFeedback(msg, msg.payload?.feedback === 'up' ? null : 'up')}
                      aria-label="Good answer"
                      title="Good answer"
                      aria-pressed={msg.payload?.feedback === 'up'}
                      className={`flex h-8 w-8 items-center justify-center rounded-md hover:bg-gray-100 hover:text-black ${msg.payload?.feedback === 'up' ? 'text-black' : ''}`}
                    >
                      <ThumbsUp className={`h-4 w-4 ${msg.payload?.feedback === 'up' ? 'fill-current' : ''}`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onFeedback(msg, msg.payload?.feedback === 'down' ? null : 'down')}
                      aria-label="Bad answer"
                      title="Bad answer"
                      aria-pressed={msg.payload?.feedback === 'down'}
                      className={`flex h-8 w-8 items-center justify-center rounded-md hover:bg-gray-100 hover:text-black ${msg.payload?.feedback === 'down' ? 'text-black' : ''}`}
                    >
                      <ThumbsDown className={`h-4 w-4 ${msg.payload?.feedback === 'down' ? 'fill-current' : ''}`} />
                    </button>
                  </>
                ) : null}
                {onRetry ? (
                  <button
                    type="button"
                    onClick={() => onRetry(msg)}
                    aria-label="Ask again"
                    title="Ask again"
                    className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-gray-100 hover:text-black"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                ) : null}
                {body.trim() ? (
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(body);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }}
                    aria-label={t('copyMessage')}
                    title={t('copyMessage')}
                    className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-gray-100 hover:text-black"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                ) : null}
              </div>
            ) : null
          ) : (isAdminView && msg.sender === 'admin') || (!isAdminView && msg.sender === 'visitor') ? (
            <p
              className={`text-xs mt-1.5 flex items-center justify-end gap-1 opacity-90 text-gray-500`}
              title={msg.read_at ? t('read') : t('sent')}
            >
              <span>
                {new Date(msg.created_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
              </span>
              {msg.read_at ? (
                <CheckCheck className={`w-4 h-4 shrink-0 text-sky-500`} aria-label={t('read')} />
              ) : (
                <Check className={`w-4 h-4 shrink-0 text-gray-500`} aria-label={t('sent')} />
              )}
            </p>
          ) : (
            <p className={`text-xs mt-1.5 flex items-center justify-end gap-1.5 opacity-90 text-gray-500`}>
              <span>
                {new Date(msg.created_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
              </span>
              {isAdminView && msg.sender === 'visitor' && msg.read_at ? (
                <CheckCheck className={`w-4 h-4 shrink-0 text-sky-500`} aria-label={t('read')} />
              ) : null}
              {!isAdminView && msg.read_at && (
                <span title={msg.read_at}>
                  · {msg.sender === 'visitor'
                    ? t('seenByProBotAt', {
                        time: new Date(msg.read_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
                      })
                    : t('seenAt', {
                        time: new Date(msg.read_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
                      })}
                </span>
              )}
            </p>
          )}
          {assistantLayout && !isOwn && onSuggestion && msg.payload?.suggestions?.length ? (
            <div className="mt-2 flex flex-col items-start gap-1">
              {msg.payload.suggestions.map((text) => (
                <button
                  key={text}
                  type="button"
                  onClick={() => onSuggestion(text)}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-left text-sm text-gray-800 hover:border-black hover:bg-gray-50"
                >
                  {text}
                </button>
              ))}
            </div>
          ) : null}
          {msg.replyLinkUrl && msg.replyLinkLabel && (
            <Link
              href={msg.replyLinkUrl}
              className="inline-block mt-2 text-sm font-medium text-black underline hover:no-underline focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-1 rounded"
            >
              {msg.replyLinkLabel}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
