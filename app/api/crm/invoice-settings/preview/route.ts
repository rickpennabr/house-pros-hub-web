import { NextRequest, NextResponse } from 'next/server';
import { requireContractor } from '@/lib/crm/require-contractor';
import { createClient } from '@/lib/supabase/server';
import { getDefaultCompanyForInvoice } from '@/lib/invoices/defaultCompany';
import { applyInvoiceBrand } from '@/lib/invoices/invoice-brand';
import { loadReminderSettings } from '@/lib/invoices/reminder';
import { generateInvoiceEmail, generateInvoiceReminderEmail } from '@/lib/utils/emailTemplates';

/**
 * GET /api/crm/invoice-settings/preview?kind=reminder|invoice
 * Sample emails with the pro's saved branding, for the invoice settings previews.
 */
export async function GET(request: NextRequest) {
  const { error: authError, user } = await requireContractor();
  if (authError || !user) return authError;
  const supabase = await createClient();
  const company = await getDefaultCompanyForInvoice(supabase, user.id);
  const business = {
    business_name: company?.business_name ?? 'Your business',
    business_logo: company?.business_logo ?? null,
    invoice_footer: null as string | null,
  };
  const brand = await applyInvoiceBrand(supabase as never, user.id, business);
  const kind = new URL(request.url).searchParams.get('kind');
  const viewUrl = '#';
  let html: string;
  if (kind === 'invoice') {
    html = generateInvoiceEmail({
      businessName: business.business_name,
      logoUrl: business.business_logo,
      themeColor: brand.themeColorHex,
      businessEmail: company?.email ?? null,
      businessPhone: company?.phone ?? null,
      businessAddress: company?.address ?? null,
      footerText: business.invoice_footer,
      invoiceNumber: 'INV-1001',
      amountCents: 125000,
      viewUrl,
      message: brand.defaultNote ?? undefined,
    });
  } else {
    const settings = await loadReminderSettings(supabase as never, user.id);
    const due = new Date(Date.now() - 2 * 86_400_000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    html = generateInvoiceReminderEmail({
      businessName: business.business_name,
      logoUrl: business.business_logo,
      themeColor: brand.themeColorHex,
      businessPhone: company?.phone ?? null,
      businessEmail: company?.email ?? null,
      customerName: 'Sample Customer',
      invoiceNumber: 'INV-1001',
      balanceCents: 125000,
      dueDateLabel: due,
      daysOverdue: 2,
      viewUrl,
      paymentInstructions: settings.paymentInstructions,
      message: settings.reminderMessage,
      footerText: business.invoice_footer,
    });
  }
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
