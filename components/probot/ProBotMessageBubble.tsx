'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Building2, User, Check, CheckCheck, ImageIcon, Reply } from 'lucide-react';
import { ChatMediaAttachment } from '@/components/chat/ChatMediaAttachment';
import { PROBOT_ASSETS } from '@/lib/constants/probot';
import type { ChatMessage } from '@/lib/types/chat';
import ProAgentCards from './ProAgentCards';
import type { ProBotContact, ProBotRecentConversation } from './ProBotSidebar';

interface ProBotMessageBubbleProps {
  msg: ChatMessage;
  isAdminView: boolean;
  adminViewingConversation: ProBotRecentConversation | null;
  selectedContact: ProBotContact | null;
  visitorAvatarUrl: string | null;
  confirmingStepId?: string | null;
  onConfirmEstimate?: (stepId: string) => void;
  onEditEstimate?: () => void;
  onReply?: (msg: ChatMessage) => void;
}

export default function ProBotMessageBubble({
  msg,
  isAdminView,
  adminViewingConversation,
  selectedContact,
  visitorAvatarUrl,
  confirmingStepId,
  onConfirmEstimate,
  onEditEstimate,
  onReply,
}: ProBotMessageBubbleProps) {
  const t = useTranslations('probot');
  const isVisitor = msg.sender === 'visitor';
  const body = typeof msg.body === 'string' ? msg.body : '';

  const avatarContent = isVisitor ? (
    visitorAvatarUrl ? (
      <img src={visitorAvatarUrl} alt="" width={32} height={32} className="w-full h-full object-cover" />
    ) : (
      <User className="w-4 h-4 text-gray-300" aria-hidden />
    )
  ) : (msg.admin_avatar_url ? (
    <img src={msg.admin_avatar_url} alt="" width={32} height={32} className="w-full h-full object-cover" />
  ) : msg.admin_sent_as === 'business' || msg.business_id ? (
    selectedContact?.logo ? (
      <img src={selectedContact.logo} alt="" width={32} height={32} className="w-full h-full object-cover" />
    ) : (
      <Building2 className="w-4 h-4 text-gray-500" aria-hidden />
    )
  ) : (
    <Image src={PROBOT_ASSETS.avatar} alt="" width={32} height={32} className="w-full h-full object-contain" />
  ));

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
              {msg.admin_sent_as === 'business'
                ? (msg.business_name ?? selectedContact?.name ?? 'Business')
                : msg.admin_sent_as === 'hub_agent'
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
          {body.trim() && <p className="whitespace-pre-wrap break-words">{body}</p>}
          {msg.payload && (
            <ProAgentCards
              payload={msg.payload}
              canConfirm={!isAdminView && !msg.payload.confirmed}
              confirming={confirmingStepId === msg.payload.confirm?.stepId}
              onConfirm={onConfirmEstimate}
              onEdit={onEditEstimate}
            />
          )}
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
