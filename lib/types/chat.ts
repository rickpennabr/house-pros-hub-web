/**
 * Shared chat types for ProBot and admin chat.
 */

export interface ChatAttachment {
  url: string;
  name: string;
  contentType: string;
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

/** Cards attached to a ProAgent chat message. Plain text stays in body. */
export interface ProAgentPayload {
  pros?: ProAgentProCard[];
  confirm?: {
    stepId: string;
    summary: ProAgentEstimateSummary;
  };
  confirmed?: boolean;
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
