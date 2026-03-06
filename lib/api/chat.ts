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
}

export async function getMessages(
  conversationId: string,
  options?: { visitorId?: string; credentials?: RequestCredentials }
): Promise<GetMessagesResponse> {
  const params = new URLSearchParams({ conversationId });
  if (options?.visitorId) params.set('visitorId', options.visitorId);
  const res = await fetch(`/api/chat/messages?${params}`, {
    cache: 'no-store',
    credentials: options?.credentials,
  });
  if (!res.ok) throw new Error('Failed to load messages');
  return res.json();
}

export async function createConversation(visitorId: string): Promise<{ conversationId: string }> {
  const res = await fetch('/api/chat/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
}

export async function sendMessage(payload: SendMessagePayload): Promise<{ message?: unknown; conversationId?: string }> {
  const res = await fetch('/api/chat/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Failed to send');
  return data;
}

export async function sendAdminMessage(payload: {
  conversationId: string;
  body: string;
  attachments?: Array<{ url: string; name: string; contentType: string }>;
  sentAs?: 'probot' | 'hub_agent' | { businessId: string };
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

/** Fetch a short-lived token for delete (optional extra security). */
export async function getVisitorDeleteToken(visitorId: string): Promise<string> {
  const res = await fetch('/api/chat/visitor-delete-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitorId }),
  });
  if (!res.ok) throw new Error('Failed to get delete token');
  const data = await res.json();
  return data.token ?? '';
}

export async function deleteConversation(
  conversationId: string,
  visitorId: string,
  options?: { deleteToken?: string }
): Promise<void> {
  const res = await fetch('/api/chat/conversations/delete', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      conversationId,
      visitorId,
      ...(options?.deleteToken ? { deleteToken: options.deleteToken } : {}),
    }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error ?? 'Failed to delete');
  }
}
