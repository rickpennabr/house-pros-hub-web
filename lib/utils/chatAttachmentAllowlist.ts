/**
 * Allowlist for chat attachment URLs. Only URLs from our Supabase storage
 * chat-attachments bucket are accepted when saving messages (prevents arbitrary URLs).
 */

const CHAT_ATTACHMENTS_BUCKET = 'chat-attachments';

/**
 * Returns the URL prefix that all valid chat attachment URLs must start with.
 * Uses NEXT_PUBLIC_SUPABASE_URL so it matches what upload returns.
 */
export function getChatAttachmentUrlPrefix(): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
  return `${base}/storage/v1/object/public/${CHAT_ATTACHMENTS_BUCKET}/`;
}

/**
 * Returns true if the URL is from our chat-attachments bucket (same origin and path prefix).
 */
export function isAllowedChatAttachmentUrl(url: string): boolean {
  try {
    const prefix = getChatAttachmentUrlPrefix();
    if (!prefix || !url || typeof url !== 'string') return false;
    return url.startsWith(prefix);
  } catch {
    return false;
  }
}

/**
 * Filters attachments to only those with allowlisted URLs. Returns the filtered array.
 * If any attachment has a disallowed URL, returns null (caller should 400).
 */
export function filterAllowedAttachments<T extends { url: string }>(attachments: T[]): T[] | null {
  if (!attachments?.length) return attachments ?? [];
  const allowed: T[] = [];
  for (const a of attachments) {
    if (!isAllowedChatAttachmentUrl(a.url)) return null;
    allowed.push(a);
  }
  return allowed;
}
