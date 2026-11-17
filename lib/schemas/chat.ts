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
  replyToId: z.string().uuid().optional(),
  /** My Places property to attach as a share card. Must belong to the signed-in sender. */
  placeShareId: z.string().uuid().optional(),
  locale: z.enum(["en", "pt", "es"]).optional(),
  /** Hub ProAgent turns can stream status + tokens over SSE. */
  stream: z.boolean().optional(),
}).refine((data) => (data.body?.trim()?.length ?? 0) > 0 || (data.attachments?.length ?? 0) > 0, {
  message: 'Message cannot be empty',
  path: ['body'],
});

export const getMessagesSchema = z.object({
  conversationId: z.string().uuid(),
  visitorId: z.string().trim().max(100).optional(), // for visitor verification
  locale: z.enum(['en', 'pt', 'es']).optional(),
});

export const deleteConversationSchema = z.object({
  conversationId: z.string().uuid(),
  visitorId: z.string().trim().min(1, 'visitorId is required').max(100),
  deleteToken: z.string().trim().min(1, 'deleteToken is required').max(500),
  /** Only delete the thread with this pro. */
  businessId: z.string().uuid().optional(),
  /** Only delete the ProBot (hub) messages. */
  hubOnly: z.boolean().optional(),
});

/** Identity the admin is replying as: ProBot, Hub Agent (themselves), or a specific business */
export const adminSentAsSchema = z.enum(['probot', 'hub_agent']).or(
  z.object({ businessId: z.string().uuid() })
);
export type AdminSentAs = z.infer<typeof adminSentAsSchema>;

const crmEstimateShareSchema = z.object({
  token: z.string().min(1).max(200),
  estimateId: z.string().uuid(),
  estimateNumber: z.string().max(64),
  amountCents: z.number().int().nonnegative(),
  depositCents: z.number().int().nonnegative().optional(),
  status: z.enum(['draft', 'sent', 'accepted', 'declined']).optional(),
  validUntilDate: z.string().nullable().optional(),
  businessName: z.string().max(200).nullable().optional(),
  businessLogo: z.string().max(2000).nullable().optional(),
  viewUrl: z.string().url(),
  lineItemsPreview: z
    .array(
      z.object({
        product_or_service: z.string().nullable().optional(),
        description: z.string().nullable().optional(),
        amount_cents: z.number().int().nullable().optional(),
      })
    )
    .max(6)
    .optional(),
});

export const adminSendMessageSchema = z.object({
  conversationId: z.string().uuid(),
  body: z.string().trim().max(MAX_MESSAGE_LENGTH),
  attachments: z.array(attachmentSchema).max(10).optional(),
  replyToId: z.string().uuid().optional(),
  /** Which identity to send as: 'probot' | 'hub_agent' | { businessId }. Defaults to 'probot' */
  sentAs: adminSentAsSchema.optional(),
  /** Optional rich card payload (e.g. CRM estimate share for in-chat approve) */
  payload: z
    .object({
      crmEstimate: crmEstimateShareSchema.optional(),
      bookingInvite: z.object({ businessId: z.string().max(64).optional(), businessName: z.string().max(120).optional() }).optional(),
    })
    .optional(),
}).refine((data) => (data.body?.trim()?.length ?? 0) > 0 || (data.attachments?.length ?? 0) > 0 || Boolean(data.payload?.crmEstimate), {
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

/** POST /api/chat/agent/confirm — homeowner files a draft the model prepared. */
export const confirmAgentEstimateSchema = z.object({
  conversationId: z.string().uuid(),
  visitorId: z.string().trim().min(1).max(100),
  stepId: z.string().uuid(),
  locale: z.enum(['en', 'pt', 'es']).optional(),
});

/** POST /api/chat/admin/agent — pause or hand the thread back to ProAgent. */
export const adminAgentPauseSchema = z.object({
  conversationId: z.string().uuid(),
  paused: z.boolean(),
});
