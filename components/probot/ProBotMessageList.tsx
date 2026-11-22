'use client';

import { useEffect, useMemo, useRef } from 'react';
import ProBotMessageBubble from './ProBotMessageBubble';
import type { ChatCrmEstimateShare, ChatMessage } from '@/lib/types/chat';
import type { ProBotContact, ProBotRecentConversation } from './ProBotSidebar';

/** Dedupe by id so React keys are unique (e.g. when merging conversations or after refetch). */
function dedupeMessagesById(messages: ChatMessage[]): ChatMessage[] {
  const seen = new Set<string>();
  return messages.filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}

interface ProBotMessageListProps {
  messages: ChatMessage[];
  /** When set, we scroll this container to the end instead of scrollIntoView (avoids page/window scroll on mobile). */
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
  isAdminView: boolean;
  adminViewingConversation: ProBotRecentConversation | null;
  selectedContact: ProBotContact | null;
  visitorAvatarUrl: string | null;
  businessReplyName?: string | null;
  businessReplyLogo?: string | null;
  confirmingStepId?: string | null;
  onConfirmEstimate?: (stepId: string) => void;
  onEditEstimate?: () => void;
  onReply?: (msg: ChatMessage) => void;
  onCrmEstimateApproved?: (messageId: string, next: ChatCrmEstimateShare) => void;
  canDelete?: (msg: ChatMessage) => boolean;
  onDelete?: (msg: ChatMessage) => void;
  onReact?: (msg: ChatMessage, emoji: string | null) => void;
  onAddPlaceToCrm?: (msg: ChatMessage) => Promise<void>;
  onPickTime?: (msg: ChatMessage) => void;
  onCrmQuickAction?: (kind: 'estimate' | 'invoice') => void;
  /** While ProBot works on a reply: what it is doing ("Thinking…"), shown in its draft bubble. */
  draftStatus?: string | null;
  /** Admin: correct a wrong plant identification on a ProBot answer. */
  onCorrectPlant?: (msg: ChatMessage) => void;
}

export default function ProBotMessageList({
  messages,
  scrollContainerRef,
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
  canDelete,
  onDelete,
  onReact,
  onAddPlaceToCrm,
  onPickTime,
  onCrmQuickAction,
  draftStatus,
  onCorrectPlant,
}: ProBotMessageListProps) {
  const uniqueMessages = useMemo(() => dedupeMessagesById(messages), [messages]);
  const listRef = useRef<HTMLDivElement>(null);
  /** WhatsApp-style: follow new messages only while the reader is at the bottom. */
  const stickToBottomRef = useRef(true);
  const lastMessageIdRef = useRef<string | null>(null);
  const threadKey = adminViewingConversation?.id ?? selectedContact?.id ?? '';

  // Opening a chat starts at the newest message.
  useEffect(() => {
    stickToBottomRef.current = true;
    lastMessageIdRef.current = null;
  }, [threadKey]);

  // Scrolling up to read history stops the auto-follow; scrolling back down resumes it.
  useEffect(() => {
    const container = scrollContainerRef?.current;
    if (!container) return;
    const onScroll = () => {
      const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
      stickToBottomRef.current = distance < 80;
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, [scrollContainerRef]);

  // New message: always jump down for your own message (or the first load), otherwise only when already at the bottom.
  // Scrolls only the messages panel, never the page (no page jump on mobile).
  useEffect(() => {
    const container = scrollContainerRef?.current;
    const last = uniqueMessages[uniqueMessages.length - 1];
    if (!container || !last) return;
    if (last.id !== lastMessageIdRef.current) {
      const mine = isAdminView ? last.sender === 'admin' : last.sender === 'visitor';
      if (mine || lastMessageIdRef.current === null) stickToBottomRef.current = true;
      lastMessageIdRef.current = last.id;
    }
    if (!stickToBottomRef.current) return;
    const frame = requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
    return () => cancelAnimationFrame(frame);
  }, [uniqueMessages, scrollContainerRef, isAdminView]);

  // Cards, photos and streamed replies grow after render: keep the newest message in view while following.
  useEffect(() => {
    const container = scrollContainerRef?.current;
    const list = listRef.current;
    if (!container || !list || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (stickToBottomRef.current) container.scrollTop = container.scrollHeight;
    });
    observer.observe(list);
    observer.observe(container);
    return () => observer.disconnect();
  }, [scrollContainerRef]);

  return (
    // Desktop: one centered reading column (like AI chat apps), the same width as the composer.
    <div ref={listRef} className="p-4 space-y-3 min-h-0 w-full md:mx-auto md:max-w-3xl">
      {uniqueMessages.map((msg) => (
        <ProBotMessageBubble
          key={msg.id}
          msg={msg}
          isAdminView={isAdminView}
          adminViewingConversation={adminViewingConversation}
          selectedContact={selectedContact}
          visitorAvatarUrl={visitorAvatarUrl}
          businessReplyName={businessReplyName}
          businessReplyLogo={businessReplyLogo}
          confirmingStepId={confirmingStepId}
          onConfirmEstimate={onConfirmEstimate}
          onEditEstimate={onEditEstimate}
          onReply={onReply}
          onCrmEstimateApproved={onCrmEstimateApproved}
          onDelete={onDelete && canDelete?.(msg) ? onDelete : undefined}
          onReact={onReact}
          onAddPlaceToCrm={onAddPlaceToCrm}
          onPickTime={onPickTime}
          onCrmQuickAction={onCrmQuickAction}
          draftStatus={draftStatus}
          onCorrectPlant={onCorrectPlant}
        />
      ))}
    </div>
  );
}
