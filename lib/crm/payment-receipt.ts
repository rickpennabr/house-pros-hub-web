import { createServiceRoleClient } from '@/lib/supabase/server';
import { sendPaymentReceiptEmail } from '@/lib/services/emailService';

export type ReceiptResult = 'sent' | 'skipped' | 'failed';

/**
 * Email a receipt. A missing address or mail failure does not undo the payment.
 */
export async function emailPaymentReceipt(input: {
  customerId: string;
  businessId: string | null;
  invoiceId: string;
  invoiceNumber: string;
  paidCents: number;
  balanceCents: number;
  method: string;
  baseUrl: string | null;
  locale?: string;
}): Promise<ReceiptResult> {
  if (!input.baseUrl) return 'skipped';
  try {
    const supabase = createServiceRoleClient();
    const { data: customer } = await supabase
      .from('pro_crm_customers')
      .select('email')
      .eq('id', input.customerId)
      .single();
    const toEmail = customer?.email?.trim();
    if (!toEmail) return 'skipped';

    let businessName = 'Us';
    if (input.businessId) {
      const { data: business } = await supabase
        .from('businesses')
        .select('business_name')
        .eq('id', input.businessId)
        .single();
      businessName = business?.business_name ?? 'Us';
    }

    let viewUrl: string | null = null;
    const { data: tokenRow } = await supabase
      .from('pro_invoice_view_tokens')
      .insert({
        invoice_id: input.invoiceId,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select('token')
      .single();
    if (tokenRow?.token) {
      const locale = input.locale || 'en';
      viewUrl = `${input.baseUrl}/${locale}/invoices/view?token=${tokenRow.token}`;
    }

    const result = await sendPaymentReceiptEmail(
      {
        businessName,
        invoiceNumber: input.invoiceNumber,
        paidCents: input.paidCents,
        balanceCents: input.balanceCents,
        method: input.method,
        viewUrl,
      },
      toEmail
    );
    return result.success ? 'sent' : 'failed';
  } catch {
    return 'failed';
  }
}
