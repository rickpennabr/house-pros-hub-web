import { DEFAULT_UNIT } from '@/lib/constants/unitOptions';

/** Line item shape used by CRM estimate create/edit forms. */
export interface CrmEstimateLineItemForm {
  product_or_service?: string;
  description?: string;
  unit?: string;
  qty: number;
  rate_cents: number;
  amount_cents: number;
}

export function parseCrmEstimateLineItems(raw: unknown): CrmEstimateLineItemForm[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return raw.map((item) => {
    const qty = typeof item?.qty === 'number' ? item.qty : parseFloat(String(item?.qty || 0)) || 0;
    const rateCents = typeof item?.rate_cents === 'number' ? item.rate_cents : Math.round(parseFloat(String(item?.rate_cents || 0)) * 100) || 0;
    const amountCents = typeof item?.amount_cents === 'number' ? item.amount_cents : Math.round(parseFloat(String(item?.amount_cents || 0)) * 100) || 0;
    return {
      product_or_service: typeof item?.product_or_service === 'string' ? item.product_or_service : '',
      description: typeof item?.description === 'string' ? item.description : '',
      unit: typeof item?.unit === 'string' ? item.unit : DEFAULT_UNIT,
      qty,
      rate_cents: rateCents,
      amount_cents: amountCents || Math.round(qty * rateCents),
    };
  });
}

/** Non-empty line items from API, or one blank row using total amount when there are no lines. */
export function lineItemsForEstimateForm(
  rawLineItems: unknown,
  amountCentsFallback: number
): CrmEstimateLineItemForm[] {
  const lineItems = parseCrmEstimateLineItems(rawLineItems);
  if (lineItems.length > 0) return lineItems;
  return [
    {
      product_or_service: '',
      description: '',
      unit: DEFAULT_UNIT,
      qty: 1,
      rate_cents: amountCentsFallback,
      amount_cents: amountCentsFallback,
    },
  ];
}

/**
 * Maps GET /api/crm/estimates/:id JSON into form fields for a new draft estimate (copy).
 * Caller sets status to draft, validity date, and view mode to create.
 */
export function duplicateEstimateDraftFromGetResponse(data: {
  customerId?: string;
  lineItems?: unknown;
  amountCents?: number;
  note?: string;
}): {
  customerId: string;
  lineItems: CrmEstimateLineItemForm[];
  note: string;
} {
  return {
    customerId: data.customerId ?? '',
    lineItems: lineItemsForEstimateForm(data.lineItems, data.amountCents ?? 0),
    note: typeof data.note === 'string' ? data.note : '',
  };
}
