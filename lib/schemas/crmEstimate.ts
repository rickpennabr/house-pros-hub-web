import { z } from 'zod';

export const crmEstimateStatusSchema = z.enum(['draft', 'sent', 'accepted', 'declined']);

export const crmEstimateLineItemSchema = z.object({
  product_or_service: z.string().trim().min(1).nullable().optional(),
  description: z.string().trim().min(1).nullable().optional(),
  unit: z.string().trim().min(1).nullable().optional(),
  qty: z.coerce.number().min(0),
  rate_cents: z.coerce.number().int().min(0),
  amount_cents: z.coerce.number().int().min(0),
});

export const crmEstimateCreateSchema = z.object({
  customerId: z.string().uuid(),
  lineItems: z.array(crmEstimateLineItemSchema).nullable().optional(),
  status: crmEstimateStatusSchema.default('draft'),
  dueDate: z.string().date().nullable().optional(),
  validityDate: z.string().date().nullable().optional(),
  note: z.string().trim().max(5000).nullable().optional(),
});

export const crmEstimateUpdateSchema = z.object({
  customerId: z.string().uuid().optional(),
  lineItems: z.array(crmEstimateLineItemSchema).nullable().optional(),
  status: crmEstimateStatusSchema.optional(),
  dueDate: z.string().date().nullable().optional(),
  validityDate: z.string().date().nullable().optional(),
  note: z.string().trim().max(5000).nullable().optional(),
});

export function normalizeEstimateAmountCents(
  lineItems: Array<{
    qty: number;
    rate_cents: number;
    amount_cents: number;
  }> | null | undefined
): number {
  if (!lineItems || lineItems.length === 0) return 0;
  return lineItems.reduce((sum, item) => {
    const amount = Number.isFinite(item.amount_cents)
      ? item.amount_cents
      : Math.round(item.qty * item.rate_cents);
    return sum + Math.max(0, Math.round(amount));
  }, 0);
}

export function isValidEstimateStatusTransition(current: string, next: string): boolean {
  if (current === next) return true;
  if (current === 'draft' && next === 'sent') return true;
  if (current === 'sent' && (next === 'accepted' || next === 'declined')) return true;
  return false;
}
