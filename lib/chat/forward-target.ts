const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** A chat a message can be copied into. ProBot is not a target (a copy would be answered as a new question). */
export type ForwardTarget =
  | { kind: 'customer'; userId: string }
  | { kind: 'visitor'; visitorId: string }
  | { kind: 'business'; businessId: string };

export function parseForwardContact(contactId: string): ForwardTarget | null {
  const id = contactId.trim();
  if (!id || id === 'probot' || id.startsWith('conversation-')) return null;
  if (id.startsWith('customer-')) {
    const userId = id.slice('customer-'.length);
    return UUID.test(userId) ? { kind: 'customer', userId } : null;
  }
  if (id.startsWith('visitor-')) {
    const visitorId = id.slice('visitor-'.length).trim();
    return visitorId.length > 0 && visitorId.length <= 100 ? { kind: 'visitor', visitorId } : null;
  }
  return UUID.test(id) ? { kind: 'business', businessId: id } : null;
}

/** Text or a file can be copied. A card with no caption cannot. */
export function canForwardMessage(body: string, attachmentCount: number): boolean {
  return body.trim().length > 0 || attachmentCount > 0;
}

/** Same conversation and same pro thread: forwarding there would duplicate the message in place. */
export function isSameThread(
  source: { conversationId: string; businessId: string | null },
  target: { conversationId: string; businessId: string | null }
): boolean {
  return source.conversationId === target.conversationId && (source.businessId ?? null) === (target.businessId ?? null);
}
