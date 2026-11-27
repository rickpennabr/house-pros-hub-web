import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/supabase';
import { contactDisplayName } from '@/lib/crm/contact-name';
import { applyCompanyDisplay } from '@/lib/invoices/companyDisplay';
import { getDefaultCompanyForInvoice } from '@/lib/invoices/defaultCompany';
import { invoiceDueState, type InvoiceDueState } from '@/lib/invoices/dueState';
import { applyInvoiceBrand } from '@/lib/invoices/invoice-brand';
import { getOrCreateInvoicePayLink } from '@/lib/invoices/payLink';
import { connectAccountFor } from '@/lib/billing/connect';
import type { InvoiceEmailData, InvoiceReminderEmailData } from '@/lib/utils/emailTemplates';

type Db = SupabaseClient<Database>;

/** Settings that shape reminder emails (migration 165 columns may be missing: then empty). */
export interface ReminderSettings {
  paymentInstructions: string | null;
  reminderMessage: string | null;
}

export async function loadReminderSettings(supabase: Db, ownerId: string): Promise<ReminderSettings> {
  const { data } = await supabase.from('pro_invoice_settings').select('*').eq('owner_id', ownerId).maybeSingle();
  const row = (data ?? {}) as Record<string, unknown>;
  const text = (key: string) => (typeof row[key] === 'string' && (row[key] as string).trim() ? (row[key] as string).trim() : null);
  return { paymentInstructions: text('payment_instructions'), reminderMessage: text('reminder_message') };
}

/** "Nov 21, 2026" from "2026-11-21" without timezone drift. */
export function reminderDateLabel(dateKey: string | null): string {
  if (!dateKey) return 'on receipt';
  return new Date(`${dateKey}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Business shown on the reminder: the invoice's business (or the default company) with invoice branding. */
/**
 * The business as it shows on an invoice's emails (invoice email and reminders): name, logo,
 * contact, address, footer, with the invoice settings and the invoice's own company override applied.
 */
export async function loadInvoiceEmailBusiness(supabase: Db, ownerId: string, businessId: string | null, companyDisplay: unknown) {
  const business: {
    business_name: string;
    business_logo?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    website?: string | null;
    invoice_footer?: string | null;
  } = { business_name: 'Your pro' };
  let found = false;
  if (businessId) {
    const { data: biz } = await supabase
      .from('businesses')
      .select('business_name, business_logo, email, phone, business_address_id')
      .eq('id', businessId)
      .maybeSingle();
    if (biz) {
      const { business_address_id: addressId, ...rest } = biz;
      Object.assign(business, rest);
      found = true;
      if (addressId) {
        const { data: addr } = await supabase
          .from('addresses')
          .select('street_address, apartment, city, state, zip_code')
          .eq('id', addressId)
          .maybeSingle();
        if (addr) {
          const street = [addr.street_address, addr.apartment].filter(Boolean).join(' ');
          const place = [addr.city, [addr.state, addr.zip_code].filter(Boolean).join(' ')].filter(Boolean).join(', ');
          business.address = [street, place].filter(Boolean).join('\n') || null;
        }
      }
    }
  }
  if (!found) {
    const fallback = await getDefaultCompanyForInvoice(supabase as never, ownerId);
    if (fallback) {
      business.business_name = fallback.business_name;
      business.business_logo = fallback.business_logo;
      business.email = fallback.email;
      business.phone = fallback.phone;
    }
  }
  const brand = await applyInvoiceBrand(supabase, ownerId, business);
  applyCompanyDisplay(business as unknown as Record<string, unknown>, companyDisplay);
  return { business, themeColor: brand.themeColorHex };
}

/** Branding fields for the "your invoice is ready" email: logo, color, address, contact, footer. */
export async function loadInvoiceEmailBranding(
  supabase: Db,
  ownerId: string,
  businessId: string | null,
  companyDisplay: unknown
): Promise<Omit<InvoiceEmailData, 'invoiceNumber' | 'amountCents' | 'viewUrl' | 'message' | 'balanceCents'>> {
  const { business, themeColor } = await loadInvoiceEmailBusiness(supabase, ownerId, businessId, companyDisplay);
  return {
    businessName: business.business_name,
    logoUrl: business.business_logo ?? null,
    themeColor,
    businessAddress: business.address ?? null,
    businessEmail: business.email ?? null,
    businessPhone: business.phone ?? null,
    businessWebsite: business.website ?? null,
    footerText: business.invoice_footer ?? null,
  };
}

export type BuiltReminder =
  | { ok: false; status: number; error: string }
  | {
      ok: true;
      to: string;
      replyTo: string | null;
      state: InvoiceDueState;
      email: InvoiceReminderEmailData;
      defaultMessage: string | null;
      invoiceNumber: string;
      customerId: string;
    };

/**
 * Everything needed to preview or send a payment reminder for one of the owner's invoices.
 * Creates (or reuses) the customer's pay link.
 */
export async function buildInvoiceReminder(args: {
  supabase: Db;
  service: Db;
  ownerId: string;
  invoiceId: string;
  baseUrl: string;
  locale?: string;
  message?: string | null;
}): Promise<BuiltReminder> {
  const { supabase, ownerId, invoiceId } = args;
  const { data: row, error } = await supabase
    .from('pro_crm_invoices')
    .select('*')
    .eq('id', invoiceId)
    .eq('owner_id', ownerId)
    .maybeSingle();
  if (error || !row) return { ok: false, status: 404, error: 'Invoice not found' };

  const state = invoiceDueState(row);
  if (row.status === 'draft') return { ok: false, status: 400, error: 'Send the invoice first. Drafts have no reminder.' };
  if (state.kind === 'cancelled') return { ok: false, status: 400, error: 'This invoice is cancelled' };
  if (state.kind === 'paid') return { ok: false, status: 400, error: 'This invoice is already paid' };

  const { data: customer } = await supabase
    .from('pro_crm_customers')
    .select('*')
    .eq('id', row.customer_id)
    .maybeSingle();
  // A company's accounts payable email gets reminders when it is set.
  const to = (customer as { billing_email?: string | null } | null)?.billing_email?.trim() || customer?.email?.trim();
  if (!to) return { ok: false, status: 400, error: 'This customer has no email address. Add one on the contact first.' };

  const [{ business, themeColor }, settings, link, card] = await Promise.all([
    loadInvoiceEmailBusiness(supabase, ownerId, row.business_id ?? null, row.company_display),
    loadReminderSettings(supabase, ownerId),
    getOrCreateInvoicePayLink(args.service, invoiceId, args.baseUrl, args.locale ?? 'en'),
    connectAccountFor(args.service, ownerId, row.business_id ?? null).catch(() => null),
  ]);
  if (!link) return { ok: false, status: 500, error: 'Could not create the pay link' };

  const message = args.message !== undefined ? args.message : settings.reminderMessage;
  return {
    ok: true,
    to,
    replyTo: business.email ?? null,
    state,
    defaultMessage: settings.reminderMessage,
    invoiceNumber: row.invoice_number,
    customerId: row.customer_id,
    email: {
      businessName: business.business_name,
      logoUrl: business.business_logo ?? null,
      themeColor,
      businessPhone: business.phone ?? null,
      businessEmail: business.email ?? null,
      businessAddress: business.address ?? null,
      businessWebsite: business.website ?? null,
      customerName: customer ? contactDisplayName(customer) : null,
      invoiceNumber: row.invoice_number,
      balanceCents: state.balanceCents,
      dueDateLabel: reminderDateLabel(state.dueDate),
      daysOverdue: state.daysOverdue,
      viewUrl: link.url,
      canPayByCard: Boolean(card),
      paymentInstructions: settings.paymentInstructions,
      message: message?.trim() || null,
      footerText: business.invoice_footer ?? null,
    },
  };
}
