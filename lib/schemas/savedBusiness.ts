import { z } from 'zod';

export const savedBusinessIdSchema = z.object({
  businessId: z.string().uuid('Invalid business ID'),
});
