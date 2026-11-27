import { z } from 'zod';

const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a real date')
  .nullable()
  .optional();

export const billboardSlideSchema = z
  .object({
    kind: z.enum(['image', 'video', 'promotion']),
    mediaUrl: z.string().trim().max(2000).nullable().optional(),
    headline: z.string().trim().max(80).nullable().optional(),
    body: z.string().trim().max(240).nullable().optional(),
    badge: z.string().trim().max(24).nullable().optional(),
    ctaLabel: z.string().trim().max(32).nullable().optional(),
    ctaUrl: z.string().trim().max(2000).nullable().optional(),
    isActive: z.boolean().optional(),
    durationSeconds: z.number().int().min(3).max(30).optional(),
    startsOn: day,
    endsOn: day,
  })
  .strict();

export const billboardReorderSchema = z
  .object({
    orderedIds: z.array(z.string().uuid()).min(1).max(12),
  })
  .strict();

export type BillboardSlidePayload = z.infer<typeof billboardSlideSchema>;
