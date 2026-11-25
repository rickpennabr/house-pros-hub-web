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
/** The customer's My Places property a chat document was filed under. */
export interface ChatDocPlace {
  id: string;
  name: string;
}

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
  /** Set by the server when the estimate was filed on the customer's My Places. */
  place?: ChatDocPlace | null;
}

/** CRM invoice or payment request shared in chat. The customer pays from the card. */
export interface ChatCrmInvoiceShare {
  /** Public view token; the card links to /{locale}/invoices/view?token= and reads live status with it. */
  token: string;
  invoiceId: string;
  invoiceNumber: string;
  /** Balance due when it was sent. The card refreshes it. */
  amountCents: number;
  dueDate?: string | null;
  /** payment = a deposit or one-off payment request; invoice = a regular invoice */
  kind: 'invoice' | 'payment';
  /** Set by the server when the invoice was filed on the customer's My Places. */
  place?: ChatDocPlace | null;
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
  /** Customer shared a My Places property with this pro. */
  placeShare?: ChatPlaceShare;
  /** Admin sent this pro a job request from the site (Add to my CRM / Decline). */
  leadOffer?: ChatLeadOffer;
  /** Pro shared their booking calendar; the customer picks a time from it in chat. */
  bookingInvite?: ChatBookingInvite;
  /** Pro added the shared place to their CRM; their work now shows on the customer's My Places. */
  placeLinked?: ChatPlaceLinked;
  /** Pro-shared CRM invoice or payment request the customer can pay from the chat */
  crmInvoice?: ChatCrmInvoiceShare;
  /** ProBot's answer came from a plant photo: what the identifier said, so an admin can correct it. */
  plantId?: ChatPlantId;
  /** Morning follow-up for a pro: an unpaid invoice or an unanswered estimate, with action buttons. */
  followup?: ChatProbotFollowup;
  /** This message is the pro's morning brief (shows a link to its settings). */
  morningBrief?: { date: string; locale?: 'en' | 'es' | 'pt' };
}

export interface ChatProbotFollowup {
  followupId: string;
  kind: 'invoice_unpaid' | 'estimate_waiting' | 'estimate_accepted' | 'project_finishing' | 'project_starting';
  /** Invoice, estimate or project id (by kind). */
  documentId: string;
  customerId?: string;
  /** Project cards: the project's name and its finish/start date. */
  projectName?: string;
  date?: string;
  /** How the card was closed: shown as the done line. */
  outcome?: 'paid' | 'dismissed' | 'project_created' | 'invoice_started' | 'opened';
  /** Language the card was written in. */
  locale?: 'en' | 'es' | 'pt';
  documentNumber: string;
  customerName: string;
  customerPhone: string | null;
  /** "3200.00 USD" style, as stored. */
  amountCents: number;
  /** Days since it was sent (or since the last reminder). */
  waitingDays: number;
  /** Invoices only. */
  daysLate?: number;
  /** True when ProBot already sent one reminder/follow-up for it. */
  followedUpBefore: boolean;
  status: 'open' | 'snoozed' | 'sent' | 'done';
  snoozedUntil?: string;
  actedAt?: string;
}

export interface ChatPlantId {
  photoUrl: string;
  commonName: string;
  scientificName: string;
  confidence: 'high' | 'medium' | 'low';
  /** Set once an admin corrected this answer. */
  correctedTo?: string;
}

export interface ChatPlaceLinked {
  placeId: string;
  name: string;
}

export interface ChatBookingInvite {
  businessId: string;
  businessName: string;
}

export interface ChatPlaceShare {
  placeId: string;
  name: string;
  address: string;
  /** Set once the pro adds the customer to their CRM. */
  crmCustomerId?: string;
}

/**
 * A job request the admin sent to this pro (lead_referrals). Until the pro adds it to their CRM
 * the card shows only the job, never the customer's name, phone or email.
 */
export interface ChatLeadOffer {
  referralId: string;
  projectType: string;
  /** City, state and ZIP only. */
  area: string;
  description: string;
  budget: string;
  timeline: string;
  photoCount: number;
  status: 'offered' | 'accepted' | 'declined' | 'cancelled' | 'expired';
  /** Set once accepted. */
  crmCustomerId?: string;
  customerName?: string;
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
  /** Emoji reactions, one per side: { visitor, admin }. */
  reactions?: Partial<Record<'visitor' | 'admin', string>>;
}
