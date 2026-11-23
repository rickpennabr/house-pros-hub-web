import type { SupabaseClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';

const LINK_DAYS = 30;
/** Reuse a link only if the customer still has this long to open it. */
const REUSE_MIN_DAYS_LEFT = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Customer pay link for an invoice (public view page with the card payment button).
 * Reuses a live token so printing or downloading the invoice again does not pile up new links.
 * Needs a service-role client: tokens are not readable through RLS.
 */
export async function getOrCreateInvoicePayLink(
  service: SupabaseClient,
  invoiceId: string,
  baseUrl: string,
  locale = 'en'
): Promise<{ url: string; token: string } | null> {
  const reuseAfter = new Date(Date.now() + REUSE_MIN_DAYS_LEFT * DAY_MS).toISOString();
  const { data: existing } = await service
    .from('pro_invoice_view_tokens')
    .select('token')
    .eq('invoice_id', invoiceId)
    .gt('expires_at', reuseAfter)
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let token = (existing as { token?: string } | null)?.token ?? null;
  if (!token) {
    const { data: created, error } = await service
      .from('pro_invoice_view_tokens')
      .insert({ invoice_id: invoiceId, expires_at: new Date(Date.now() + LINK_DAYS * DAY_MS).toISOString() })
      .select('token')
      .single();
    if (error || !created) return null;
    token = (created as { token: string }).token;
  }
  return { url: `${baseUrl}/${locale}/invoices/view?token=${token}`, token };
}

/** Whether a printed / downloaded invoice should carry a pay link. Drafts are not sent yet, so no link. */
export function invoiceTakesPayLink(status: string, amountCents: number, paymentAppliedCents: number | null | undefined) {
  return status !== 'draft' && status !== 'cancelled' && amountCents - (paymentAppliedCents ?? 0) > 0;
}

/** PNG data URL of a QR code for the pay link (works in the browser and on the server). */
export function payLinkQrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, { margin: 1, width: 240, errorCorrectionLevel: 'M' });
}
