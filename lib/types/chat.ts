/**
 * Shared chat types for ProBot and admin chat.
 */

export interface ChatAttachment {
  url: string;
  name: string;
  contentType: string;
}

export type ChatReplyKind = 'text' | 'photo' | 'video' | 'voice' | 'file';

/** Snapshot stored with a message that answers another message. */
export interface ChatReply {
  id: string;
  sender: 'visitor' | 'admin';
  body: string;
  kind: ChatReplyKind;
}

export function chatReplyFromMessage(msg: {
  id: string;
  sender: 'visitor' | 'admin';
  body: string;
  attachments?: ChatAttachment[];
}): ChatReply {
  const text = msg.body.trim();
  const att = msg.attachments?.[0];
  const voice = !!att && (att.name.startsWith('voice-note') || att.contentType.startsWith('audio/'));
  let kind: ChatReplyKind = 'text';
  if (!text) {
    if (voice) kind = 'voice';
    else if (att?.contentType.startsWith('video/')) kind = 'video';
    else if (att?.contentType.startsWith('image/')) kind = 'photo';
    else if (att) kind = 'file';
  }
  return {
    id: msg.id,
    sender: msg.sender,
    body: text ? text.slice(0, 160) : att?.name ?? '',
    kind,
  };
}

export interface ProAgentProCard {
  id: string;
  name: string;
  category: string | null;
  city: string | null;
  state: string | null;
  profileUrl: string;
}

export interface ProAgentEstimateSummary {
  firstName: string;
  lastName: string;
  streetAddress: string;
  city: string;
  state: string;
  trades: string[];
  budgetRange: string;
  timeline: string;
  projectType: string;
}

/** CRM estimate shared in chat for in-thread review and approval. */
export interface ChatCrmEstimateShare {
  token: string;
  estimateId: string;
  estimateNumber: string;
  amountCents: number;
  depositCents: number;
  status: 'draft' | 'sent' | 'accepted' | 'declined';
  validUntilDate?: string | null;
  businessName?: string | null;
  businessLogo?: string | null;
  viewUrl: string;
  lineItemsPreview?: Array<{
    product_or_service?: string | null;
    description?: string | null;
    amount_cents?: number | null;
  }>;
  /** Set after the customer approves in chat */
  approvedAt?: string;
  depositPaymentUrl?: string | null;
}

/** Cards attached to a ProAgent chat message. Plain text stays in body. */
export interface ProAgentPayload {
  pros?: ProAgentProCard[];
  confirm?: {
    stepId: string;
    summary: ProAgentEstimateSummary;
  };
  confirmed?: boolean;
  /** Pro-shared CRM estimate the customer can approve in chat */
  crmEstimate?: ChatCrmEstimateShare;
}

export interface ChatMessage {
  id: string;
  sender: 'visitor' | 'admin';
  body: string;
  created_at: string;
  business_id?: string;
  business_name?: string;
  read_at?: string;
  attachments?: ChatAttachment[];
  replyTo?: ChatReply;
  replyLinkUrl?: string;
  replyLinkLabel?: string;
  /** For admin messages: which identity sent (probot, business, hub_agent). Used for display. */
  admin_sent_as?: 'probot' | 'business' | 'hub_agent';
  /** When admin_sent_as === 'hub_agent': which admin user sent (for avatar/name). */
  admin_user_id?: string;
  /** Resolved from profiles when admin_sent_as === 'hub_agent'. */
  admin_avatar_url?: string | null;
  /** Resolved from profiles when admin_sent_as === 'hub_agent'. */
  admin_display_name?: string | null;
  payload?: ProAgentPayload | null;
}
