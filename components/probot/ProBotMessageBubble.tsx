'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Building2, Paperclip, User, Check, CheckCheck, ImageIcon } from 'lucide-react';
import { PROBOT_ASSETS } from '@/lib/constants/probot';
import type { ChatMessage } from '@/lib/types/chat';
import type { ProBotContact, ProBotRecentConversation } from './ProBotSidebar';

/** Renders image with WhatsApp-style thumbnail; shows placeholder if load fails. */
function ChatImageWithFallback({
  url,
  name,
  isVisitor,
}: {
  url: string;
  name: string;
  isVisitor: boolean;
}) {
  const [error, setError] = useState(false);
  if (error) {
    return (
      <div
        className={`flex items-center gap-2 py-3 px-4 rounded-lg max-w-[280px] ${
          isVisitor ? 'bg-white/10 text-gray-300' : 'bg-gray-100 text-gray-600'
        }`}
      >
        <ImageIcon className="w-5 h-5 shrink-0" />
        <span className="text-sm truncate">{name || 'Photo'}</span>
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={name || 'Image'}
      className="w-full h-auto max-h-[320px] object-cover block"
      onError={() => setError(true)}
    />
  );
}

interface ProBotMessageBubbleProps {
  msg: ChatMessage;
  isAdminView: boolean;
  adminViewingConversation: ProBotRecentConversation | null;
  selectedContact: ProBotContact | null;
  visitorAvatarUrl: string | null;
}

export default function ProBotMessageBubble({
  msg,
  isAdminView,
  adminViewingConversation,
  selectedContact,
  visitorAvatarUrl,
}: ProBotMessageBubbleProps) {
  const t = useTranslations('probot');
  const isVisitor = msg.sender === 'visitor';

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
              {msg.admin_sent_as === 'business' ? (msg.business_name ?? selectedContact?.name ?? 'Business') : 'ProBot'}
            </p>
          )}
          {msg.body.trim() && <p className="whitespace-pre-wrap break-words">{msg.body}</p>}
          {msg.attachments?.length ? (
            <div className="mt-2 space-y-2">
              {msg.attachments.map((att, i) =>
                att.contentType.startsWith('image/') ? (
                  <a
                    key={i}
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-xl overflow-hidden max-w-[280px] border border-gray-200/50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 cursor-pointer hover:opacity-95 transition-opacity"
                    title={t('openImage')}
                  >
                    <ChatImageWithFallback url={att.url} name={att.name} isVisitor={isVisitor} />
                  </a>
                ) : (
                  <a
                    key={i}
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm underline"
                  >
                    <Paperclip className="w-4 h-4 shrink-0" />
                    {att.name}
                  </a>
                )
              )}
            </div>
          ) : null}
          {isVisitor && !msg.body.trim() && !msg.attachments?.length ? (
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
