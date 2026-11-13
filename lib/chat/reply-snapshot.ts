import type { ChatReply, ChatReplyKind } from '@/lib/types/chat';

type ReplyRow = {
  id: string;
  conversation_id: string;
  sender: string;
  body: string | null;
  attachments: unknown;
};

function kindFromAttachment(name: string, contentType: string): ChatReplyKind {
  if (name.startsWith('voice-note') || contentType.startsWith('audio/')) return 'voice';
  if (contentType.startsWith('video/')) return 'video';
  if (contentType.startsWith('image/')) return 'photo';
  return 'file';
}

/** Build the quote stored on a reply. Returns null when the target is not in this thread. */
export function snapshotFromRow(row: ReplyRow, conversationId: string): ChatReply | null {
  if (row.conversation_id !== conversationId) return null;
  if (row.sender !== 'visitor' && row.sender !== 'admin') return null;
  const text = (row.body ?? '').trim();
  const attachments = Array.isArray(row.attachments) ? row.attachments : [];
  const first = attachments[0] as { name?: string; contentType?: string } | undefined;
  const name = typeof first?.name === 'string' ? first.name : '';
  const contentType = typeof first?.contentType === 'string' ? first.contentType : '';
  const kind: ChatReplyKind = text ? 'text' : first ? kindFromAttachment(name, contentType) : 'text';
  return {
    id: row.id,
    sender: row.sender,
    body: text ? text.slice(0, 160) : name,
    kind,
  };
}

export function parseStoredReply(value: unknown): ChatReply | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== 'string') return undefined;
  if (row.sender !== 'visitor' && row.sender !== 'admin') return undefined;
  const kind = row.kind;
  if (kind !== 'text' && kind !== 'photo' && kind !== 'video' && kind !== 'voice' && kind !== 'file') {
    return undefined;
  }
  return {
    id: row.id,
    sender: row.sender,
    body: typeof row.body === 'string' ? row.body : '',
    kind,
  };
}
