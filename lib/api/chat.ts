/**
 * Thin API layer for chat endpoints. Keeps route URLs and response shapes in one place.
 */

export interface GetMessagesResponse {
  messages: Array<{
    id: string;
    sender: string;
    body: string;
    created_at: string;
    business_id?: string;
    business_name?: string;
    read_at?: string;
    attachments?: Array<{ url: string; name: string; contentType: string }>;
    replyLinkUrl?: string;
    replyLinkLabel?: string;
    admin_sent_as?: string;
    admin_user_id?: string;
    admin_avatar_url?: string | null;
    admin_display_name?: string | null;
  }>;
  /** When visitor fetches ProBot conversation: display name + avatar of hub agent (admin who replied). */
  hubAgent?: { displayName: string; avatarUrl: string | null };
}

export async function getMessages(
  conversationId: string,
  options?: { visitorId?: string; credentials?: RequestCredentials; locale?: 'en' | 'pt' | 'es' }
): Promise<GetMessagesResponse> {
  const params = new URLSearchParams({ conversationId });
  if (options?.visitorId) params.set('visitorId', options.visitorId);
  if (options?.locale) params.set('locale', options.locale);
  const res = await fetch(`/api/chat/messages?${params}`, {
    cache: 'no-store',
    credentials: options?.credentials ?? 'include',
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(typeof d.error === 'string' ? d.error : 'Failed to load messages');
  }
  return res.json();
}

export async function createConversation(visitorId: string): Promise<{ conversationId: string }> {
  const res = await fetch('/api/chat/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ visitorId }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error ?? 'Failed to load chat');
  }
  return res.json();
}

export interface SendMessagePayload {
  conversationId?: string;
  visitorId: string;
  body: string;
  businessId?: string;
  displayName?: string;
  userId?: string;
  attachments?: Array<{ url: string; name: string; contentType: string }>;
  replyToId?: string;
  placeShareId?: string;
  locale?: 'en' | 'pt' | 'es';
  stream?: boolean;
}

export type SendMessageBot = {
  id: string;
  conversationId: string;
  sender: 'admin';
  body: string;
  created_at: string;
  admin_sent_as: 'probot';
  payload?: import('@/lib/types/chat').ProAgentPayload | null;
};

export type SendMessageResult = {
  message?: unknown;
  conversationId?: string;
  botMessage?: SendMessageBot;
};

export type SendMessageStreamHandlers = {
  onMessage?: (message: unknown) => void;
  onStatus?: (label: string) => void;
  onToken?: (text: string) => void;
  onBot?: (bot: SendMessageBot) => void;
};

async function readSendMessageSse(
  res: Response,
  handlers: SendMessageStreamHandlers
): Promise<SendMessageResult> {
  if (!res.body) throw new Error('Failed to send');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let eventName = 'message';
  const result: SendMessageResult = {};

  const dispatch = (event: string, raw: string) => {
    let data: unknown = null;
    try {
      data = JSON.parse(raw) as unknown;
    } catch {
      return;
    }
    if (event === 'message') {
      result.message = data;
      handlers.onMessage?.(data);
      return;
    }
    if (event === 'status' && data && typeof data === 'object' && 'label' in data) {
      const label = (data as { label?: unknown }).label;
      if (typeof label === 'string') handlers.onStatus?.(label);
      return;
    }
    if (event === 'token' && data && typeof data === 'object' && 'text' in data) {
      const text = (data as { text?: unknown }).text;
      if (typeof text === 'string' && text) handlers.onToken?.(text);
      return;
    }
    if (event === 'bot' && data && typeof data === 'object') {
      result.botMessage = data as SendMessageBot;
      handlers.onBot?.(result.botMessage);
      return;
    }
    if (event === 'error' && data && typeof data === 'object' && 'error' in data) {
      const error = (data as { error?: unknown }).error;
      throw new Error(typeof error === 'string' ? error : 'Failed to send');
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim() || 'message';
        continue;
      }
      if (line.startsWith('data:')) {
        dispatch(eventName, line.slice(5).trim());
        eventName = 'message';
      }
    }
  }

  return result;
}

export async function sendMessage(
  payload: SendMessagePayload,
  handlers?: SendMessageStreamHandlers
): Promise<SendMessageResult> {
  const useStream = Boolean(payload.stream);
  const res = await fetch('/api/chat/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(useStream ? { Accept: 'text/event-stream' } : {}),
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  const contentType = res.headers.get('content-type') ?? '';
  if (useStream && res.ok && contentType.includes('text/event-stream')) {
    return readSendMessageSse(res, handlers ?? {});
  }
  const data = (await res.json().catch(() => ({}))) as SendMessageResult & { error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Failed to send');
  return data;
}

export async function sendAdminMessage(payload: {
  conversationId: string;
  body: string;
  attachments?: Array<{ url: string; name: string; contentType: string }>;
  replyToId?: string;
  sentAs?: 'probot' | 'hub_agent' | { businessId: string };
  payload?: {
    crmEstimate?: import('@/lib/types/chat').ChatCrmEstimateShare;
    crmInvoice?: import('@/lib/types/chat').ChatCrmInvoiceShare;
    bookingInvite?: import('@/lib/types/chat').ChatBookingInvite;
  };
}): Promise<{ message?: unknown }> {
  const res = await fetch('/api/chat/admin/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Failed to send');
  return data;
}

/** Fetch a short-lived token required to delete a visitor conversation. */
export async function getVisitorDeleteToken(visitorId: string): Promise<string> {
  const res = await fetch('/api/chat/visitor-delete-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ visitorId }),
  });
  if (!res.ok) throw new Error('Failed to get delete token');
  const data = await res.json();
  return data.token ?? '';
}

export async function deleteConversation(
  conversationId: string,
  visitorId: string,
  options: { deleteToken: string; businessId?: string; hubOnly?: boolean }
): Promise<void> {
  const res = await fetch('/api/chat/conversations/delete', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      conversationId,
      visitorId,
      deleteToken: options.deleteToken,
      ...(options.businessId ? { businessId: options.businessId } : {}),
      ...(options.hubOnly ? { hubOnly: true } : {}),
    }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error ?? 'Failed to delete');
  }
}
