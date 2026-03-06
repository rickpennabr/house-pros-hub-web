import { z } from 'zod';

const MAX_MESSAGE_LENGTH = 2000;

export const createConversationSchema = z.object({
  visitorId: z.string().trim().min(1, 'visitorId is required').max(100),
});

const attachmentSchema = z.object({
  url: z.string().url(),
  name: z.string().max(256),
  contentType: z.string().max(128),
});

export const sendMessageSchema = z.object({
  conversationId: z.string().uuid().optional(),
  visitorId: z.string().trim().min(1, 'visitorId is required').max(100),
  body: z.string().trim().max(MAX_MESSAGE_LENGTH),
  businessId: z.string().uuid().optional(), // When set, message is directed to this pro (admin + pro receive)
  displayName: z.string().trim().max(200).optional(),
  userId: z.string().uuid().optional(),
  attachments: z.array(attachmentSchema).max(10).optional(),
}).refine((data) => (data.body?.trim()?.length ?? 0) > 0 || (data.attachments?.length ?? 0) > 0, {
  message: 'Message cannot be empty',
  path: ['body'],
});

export const getMessagesSchema = z.object({
  conversationId: z.string().uuid(),
  visitorId: z.string().trim().max(100).optional(), // for visitor verification
});

export const deleteConversationSchema = z.object({
  conversationId: z.string().uuid(),
  visitorId: z.string().trim().min(1, 'visitorId is required').max(100),
  /** Optional short-lived token from POST /api/chat/visitor-delete-token for extra security */
  deleteToken: z.string().trim().max(500).optional(),
});

/** Identity the admin is replying as: ProBot, Hub Agent (themselves), or a specific business */
export const adminSentAsSchema = z.enum(['probot', 'hub_agent']).or(
  z.object({ businessId: z.string().uuid() })
);
export type AdminSentAs = z.infer<typeof adminSentAsSchema>;

export const adminSendMessageSchema = z.object({
  conversationId: z.string().uuid(),
  body: z.string().trim().max(MAX_MESSAGE_LENGTH),
  attachments: z.array(attachmentSchema).max(10).optional(),
  /** Which identity to send as: 'probot' | 'hub_agent' | { businessId }. Defaults to 'probot' */
  sentAs: adminSentAsSchema.optional(),
}).refine((data) => (data.body?.trim()?.length ?? 0) > 0 || (data.attachments?.length ?? 0) > 0, {
  message: 'Message cannot be empty',
  path: ['body'],
});

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});

export const visitorPushSubscriptionSchema = pushSubscriptionSchema.extend({
  conversationId: z.string().uuid(),
  visitorId: z.string().trim().min(1, 'visitorId is required').max(100),
});

export const presenceHeartbeatSchema = z.object({
  type: z.enum(['visitor', 'admin', 'business', 'user', 'offline']),
  visitorId: z.string().trim().max(100).optional(), // required when type === 'visitor'
  businessId: z.string().uuid().optional(), // required when type === 'business'
}).refine((data) => data.type !== 'visitor' || (data.visitorId && data.visitorId.length > 0), {
  message: 'visitorId is required when type is visitor',
  path: ['visitorId'],
}).refine((data) => data.type !== 'business' || (data.businessId && data.businessId.length > 0), {
  message: 'businessId is required when type is business',
  path: ['businessId'],
});

// Query/path validation for chat API GET/DELETE

const MAX_LIST_LENGTH = 100;

/** GET /api/chat/unread-count?visitorId= */
export const getUnreadCountQuerySchema = z.object({
  visitorId: z.string().trim().min(1, 'visitorId is required').max(100),
});

/** Comma-separated list of UUIDs, max MAX_LIST_LENGTH */
export const commaSeparatedUuidsSchema = z
  .string()
  .trim()
  .transform((s) => (s === '' ? [] : s.split(',').map((x) => x.trim()).filter(Boolean)))
  .pipe(z.array(z.string().uuid()).max(MAX_LIST_LENGTH));

/** GET /api/chat/presence - visitorId when used (admin only) */
export const presenceVisitorIdParamSchema = z.string().trim().max(100);

/** Path param: conversation id (UUID) for admin routes */
export const adminConversationIdSchema = z.string().uuid();

/** DELETE /api/chat/admin/conversations/delete?conversationId= (required) */
export const adminDeleteConversationQuerySchema = z.object({
  conversationId: z.string().uuid(),
});
