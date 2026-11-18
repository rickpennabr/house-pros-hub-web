import type { ChatCrmEstimateShare, ChatCrmInvoiceShare } from '@/lib/types/chat';

/** What the chat needs to post a CRM document as a card. */
export interface SharedCrmDoc {
  label: string;
  amountCents: number;
  url: string;
  estimateShare?: ChatCrmEstimateShare;
  invoiceShare?: ChatCrmInvoiceShare;
}

/** Create (or reuse) the customer link for an estimate and shape it as the in-chat approval card. */
export async function createEstimateShare(estimateId: string, fallbackLabel?: string): Promise<SharedCrmDoc> {
  const res = await fetch(`/api/crm/estimates/${encodeURIComponent(estimateId)}/share-link`, {
    method: 'POST',
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url || !data.token) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Could not create estimate link');
  }
  const label = String(data.label || fallbackLabel || estimateId.slice(0, 8));
  const amountCents = typeof data.amountCents === 'number' ? data.amountCents : 0;
  return {
    label,
    amountCents,
    url: data.url,
    estimateShare: {
      token: data.token,
      estimateId: data.estimateId || estimateId,
      estimateNumber: label,
      amountCents,
      depositCents: data.depositCents ?? 0,
      status: data.status === 'accepted' || data.status === 'declined' ? data.status : 'sent',
      validUntilDate: data.validUntilDate ?? null,
      businessName: data.businessName ?? null,
      businessLogo: data.businessLogo ?? null,
      viewUrl: data.url,
      lineItemsPreview: data.lineItemsPreview,
    },
  };
}

/** Create the customer pay link for an invoice and shape it as the in-chat pay card. */
export async function createInvoiceShare(
  invoiceId: string,
  kind: 'invoice' | 'payment',
  fallbackLabel?: string
): Promise<SharedCrmDoc> {
  const res = await fetch(`/api/crm/invoices/${encodeURIComponent(invoiceId)}/payment-link`, {
    method: 'POST',
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Could not create payment link');
  }
  const token = typeof data.token === 'string' ? data.token : new URL(data.url).searchParams.get('token') ?? '';
  if (!token) throw new Error('Could not create payment link');
  const label = String(data.invoiceNumber || fallbackLabel || invoiceId.slice(0, 8));
  const amountCents = typeof data.balanceCents === 'number' ? data.balanceCents : 0;
  return {
    label,
    amountCents,
    url: data.url,
    invoiceShare: {
      token,
      invoiceId,
      invoiceNumber: label,
      amountCents,
      dueDate: typeof data.dueDate === 'string' ? data.dueDate : null,
      kind,
    },
  };
}

/**
 * Only send the pro back to a chat page of this site (no open redirects).
 * Accepts `/{locale}/probot` with an optional query string.
 */
export function safeChatReturnTo(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!/^\/[a-z]{2}(-[A-Z]{2})?\/probot(\?[^#\s\\]*)?$/.test(value)) return null;
  if (value.includes('//')) return null;
  return value;
}

/** The chat URL to land on after the CRM saved a document; the chat then posts it as a card. */
export function chatReturnWithDoc(returnTo: string, kind: 'estimate' | 'invoice', id: string): string {
  const key = kind === 'estimate' ? 'sendEstimate' : 'sendInvoice';
  return `${returnTo}${returnTo.includes('?') ? '&' : '?'}${key}=${encodeURIComponent(id)}`;
}
