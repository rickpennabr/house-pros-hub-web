import { z } from 'zod';

const MAX_MESSAGE_LENGTH = 2000;

export const createConversationSchema = z.object({
  visitorId: z.string().trim().min(1, 'visitorId is required').max(100),
});

export const sendMessageSchema = z.object({
  conversationId: z.string().uuid().optional(),
  visitorId: z.string().trim().min(1, 'visitorId is required').max(100),
  body: z.string().trim().min(1, 'Message cannot be empty').max(MAX_MESSAGE_LENGTH),
  businessId: z.string().uuid().optional(), // When set, message is directed to this pro (admin + pro receive)
});

export const getMessagesSchema = z.object({
  conversationId: z.string().uuid(),
  visitorId: z.string().trim().max(100).optional(), // for visitor verification
});

export const adminSendMessageSchema = z.object({
  conversationId: z.string().uuid(),
  body: z.string().trim().min(1, 'Message cannot be empty').max(MAX_MESSAGE_LENGTH),
});

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});
