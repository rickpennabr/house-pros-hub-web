/** Emoji reactions on chat messages: one per side of the chat (customer and pro). */
export const CHAT_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const;

export type ReactionSide = 'visitor' | 'admin';
export type MessageReactions = Partial<Record<ReactionSide, string>>;

export function isChatReaction(value: unknown): value is string {
  return typeof value === 'string' && (CHAT_REACTIONS as readonly string[]).includes(value);
}

export function parseReactions(value: unknown): MessageReactions {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const row = value as Record<string, unknown>;
  const out: MessageReactions = {};
  if (isChatReaction(row.visitor)) out.visitor = row.visitor;
  if (isChatReaction(row.admin)) out.admin = row.admin;
  return out;
}
