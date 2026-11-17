'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Building2, User, Check, CheckCheck, ImageIcon, Reply } from 'lucide-react';
import { ChatMediaAttachment } from '@/components/chat/ChatMediaAttachment';
import ChatEstimateShareCard from '@/components/chat/ChatEstimateShareCard';
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
}: ProBotMessageBubbleProps) {
  const t = useTranslations('probot');
  const isVisitor = msg.sender === 'visitor';
  const body = typeof msg.body === 'string' ? msg.body : '';

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
          className={`underline break-all ${isVisitor ? 'text-blue-200' : 'text-blue-700'}`}
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
    <div className={`flex ${isVisitor ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2.5 text-sm flex items-start gap-2 ${
          isVisitor ? 'bg-black text-white' : 'bg-white text-gray-900 border border-gray-200 shadow-sm'
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
          {onReply ? (
            <button
              type="button"
              onClick={() => onReply(msg)}
              className="float-right cursor-pointer p-0.5 opacity-70 hover:opacity-100"
              aria-label={t('reply')}
            >
              <Reply className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {body.trim() && <p className="whitespace-pre-wrap break-words">{renderBody(body)}</p>}
          {msg.payload?.crmEstimate ? (
            <ChatEstimateShareCard
              estimate={msg.payload.crmEstimate}
              canApprove={!isAdminView}
              onApproved={(next) => onCrmEstimateApproved?.(msg.id, next)}
            />
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
            <div className={`flex items-center gap-2 py-2 ${isVisitor ? 'text-gray-400' : 'text-gray-500'}`}>
              <ImageIcon className="w-5 h-5 shrink-0 opacity-70" />
              <span className="text-sm italic">{t('photoPlaceholder')}</span>
            </div>
          ) : null}
          {(isAdminView && msg.sender === 'admin') || (!isAdminView && msg.sender === 'visitor') ? (
            <p
              className={`text-xs mt-1.5 flex items-center justify-end gap-1 opacity-90 ${isVisitor ? 'text-gray-300' : 'text-gray-500'}`}
              title={msg.read_at ? t('read') : t('sent')}
            >
              <span>
                {new Date(msg.created_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
              </span>
              {msg.read_at ? (
                <CheckCheck className={`w-4 h-4 shrink-0 ${isVisitor ? 'text-blue-400' : 'text-blue-500'}`} aria-label={t('read')} />
              ) : (
                <Check className={`w-4 h-4 shrink-0 ${isVisitor ? 'text-gray-400' : 'text-gray-500'}`} aria-label={t('sent')} />
              )}
            </p>
          ) : (
            <p className={`text-xs mt-1.5 flex items-center justify-end gap-1.5 opacity-90 ${isVisitor ? 'text-gray-300' : 'text-gray-500'}`}>
              <span>
                {new Date(msg.created_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
              </span>
              {isAdminView && msg.sender === 'visitor' && msg.read_at ? (
                <CheckCheck className={`w-4 h-4 shrink-0 ${isVisitor ? 'text-blue-400' : 'text-blue-500'}`} aria-label={t('read')} />
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
