'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Building2, User, Check, CheckCheck, ImageIcon, Reply, Trash2, UserPlus, CalendarDays, Home as HomeIcon, FileText, Receipt } from 'lucide-react';
import { ChatMediaAttachment } from '@/components/chat/ChatMediaAttachment';
import ChatEstimateShareCard from '@/components/chat/ChatEstimateShareCard';
import ChatInvoiceShareCard from '@/components/chat/ChatInvoiceShareCard';
import ChatDocCard, { CHAT_DOC_BUBBLE_WIDTH } from '@/components/chat/ChatDocCard';
import { PROBOT_ASSETS } from '@/lib/constants/probot';
import type { ChatCrmEstimateShare, ChatMessage } from '@/lib/types/chat';
import ProAgentCards from './ProAgentCards';
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
  /** Pro side: add the customer who shared a place to the CRM. */
  onAddPlaceToCrm?: (msg: ChatMessage) => Promise<void>;
  /** Customer side: open the shared calendar to pick a time. */
  onPickTime?: (msg: ChatMessage) => void;
  /** Pro view: open the estimate / invoice picker for this customer. */
  onCrmQuickAction?: (kind: 'estimate' | 'invoice') => void;
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
  onAddPlaceToCrm,
  onPickTime,
  onCrmQuickAction,
}: ProBotMessageBubbleProps) {
  const [addingToCrm, setAddingToCrm] = useState(false);
  const [crmError, setCrmError] = useState<string | null>(null);
  const t = useTranslations('probot');
  const locale = useLocale();
  const isVisitor = msg.sender === 'visitor';
  /** WhatsApp layout: the viewer's own messages sit on the right in green. */
  const isOwn = isAdminView ? !isVisitor : isVisitor;
  const body = typeof msg.body === 'string' ? msg.body : '';
  /** Place cards replace their plain-text body. */
  const showBody = Boolean(body.trim()) && !msg.payload?.placeShare && !msg.payload?.placeLinked;
  /** Document cards share one width, whatever the caption length. */
  const hasDocCard = Boolean(
    msg.payload?.crmEstimate ||
      msg.payload?.crmInvoice ||
      msg.payload?.bookingInvite ||
      msg.payload?.placeShare ||
      msg.payload?.placeLinked
  );

  const renderBody = (text: string) => {
    const parts = text.split(/(https?:\/\/[^\s]+)/g);
    if (parts.length === 1) return text;
    return parts.map((part, index) =>
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
        <span key={`t-${index}`}>{part}</span>
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
    <Image src={PROBOT_ASSETS.avatar} alt="" width={32} height={32} className="w-full h-full object-contain" />
  );

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`${hasDocCard ? CHAT_DOC_BUBBLE_WIDTH : 'max-w-[85%]'} rounded-lg px-2.5 py-1.5 text-sm text-gray-900 flex items-start gap-2 shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] ${
          isOwn ? 'rounded-tr-none bg-[#d9fdd3]' : 'rounded-tl-none bg-white'
        }`}
      >
        <div className="w-8 h-8 shrink-0 rounded-lg border-2 border-black overflow-hidden bg-gray-200 flex items-center justify-center">
          {avatarContent}
        </div>
        <div className="min-w-0 flex-1">
          {msg.sender === 'admin' && (
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
          {showBody || onReply || onDelete ? (
            <div className="flex items-start gap-1.5">
              {showBody ? (
                <p className="min-w-0 flex-1 whitespace-pre-wrap break-words">{renderBody(body)}</p>
              ) : (
                <span className="flex-1" />
              )}
              {onReply || onDelete ? (
                <span className="flex shrink-0 items-center">
                  {onDelete ? (
                    <button
                      type="button"
                      onClick={() => onDelete(msg)}
                      className="cursor-pointer p-0.5 opacity-70 hover:opacity-100"
                      aria-label={t('deleteMessage')}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                  {onReply ? (
                    <button
                      type="button"
                      onClick={() => onReply(msg)}
                      className="cursor-pointer p-0.5 opacity-70 hover:opacity-100"
                      aria-label={t('reply')}
                    >
                      <Reply className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </span>
              ) : null}
            </div>
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
          {(isAdminView && msg.sender === 'admin') || (!isAdminView && msg.sender === 'visitor') ? (
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
