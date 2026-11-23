import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/supabase';

type Db = SupabaseClient<Database>;

/** Invoice settings that shape every invoice. Columns from migration 147 may be missing. */
export type InvoiceBrandSettings = {
  themeColorHex: string;
  /** Logo the pro uploaded for invoices; null uses the business logo. */
  logoUrl: string | null;
  footerText: string | null;
  defaultPaymentTerms: string | null;
  defaultNote: string | null;
  /** Company info for every invoice header; null keeps the business profile value. */
  companyAddress: string | null;
  companyEmail: string | null;
  companyPhone: string | null;
  companyWebsite: string | null;
};

export async function loadInvoiceBrandSettings(supabase: Db, ownerId: string): Promise<InvoiceBrandSettings> {
  const { data } = await supabase.from('pro_invoice_settings').select('*').eq('owner_id', ownerId).maybeSingle();
  const row = (data ?? {}) as Record<string, unknown>;
  const text = (key: string) => (typeof row[key] === 'string' && (row[key] as string).trim() ? (row[key] as string) : null);
  return {
    themeColorHex: text('theme_color_hex') ?? '#000000',
    logoUrl: text('logo_url'),
    footerText: text('footer_text'),
    defaultPaymentTerms: text('default_payment_terms'),
    defaultNote: text('default_note'),
    companyAddress: text('company_address'),
    companyEmail: text('company_email'),
    companyPhone: text('company_phone'),
    companyWebsite: text('company_website'),
  };
}

/**
 * The logo an invoice shows when the pro has not uploaded one: the business logo, or (for a
 * display name with no logo) the logo on the pro's first business that has one.
 */
export async function ownerBusinessLogo(supabase: Db, ownerId: string): Promise<string | null> {
  const { data } = await supabase
    .from('businesses')
    .select('business_logo')
    .eq('owner_id', ownerId)
    .eq('is_active', true)
    .not('business_logo', 'is', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.business_logo ?? null;
}

/**
 * Put the invoice settings on a resolved business: the uploaded logo (or a fallback logo when the
 * business has none) and the footer. Call before applyCompanyDisplay, so a per-invoice override wins.
 */
export async function applyInvoiceBrand<
  T extends {
    business_logo?: string | null;
    invoice_footer?: string | null;
    address?: string | null;
    email?: string | null;
    phone?: string | null;
    website?: string | null;
  },
>(supabase: Db, ownerId: string, business: T): Promise<InvoiceBrandSettings> {
  const settings = await loadInvoiceBrandSettings(supabase, ownerId);
  if (settings.logoUrl) business.business_logo = settings.logoUrl;
  else if (!business.business_logo) business.business_logo = await ownerBusinessLogo(supabase, ownerId);
  business.invoice_footer = settings.footerText;
  if (settings.companyAddress) business.address = settings.companyAddress;
  if (settings.companyEmail) business.email = settings.companyEmail;
  if (settings.companyPhone) business.phone = settings.companyPhone;
  if (settings.companyWebsite) (business as { website?: string | null }).website = settings.companyWebsite;
  return settings;
}

/** Days until due for "Net 30" style terms; 0 for due on receipt; null when unknown. */
export function termsDays(terms: string | null | undefined): number | null {
  const value = (terms ?? '').trim().toLowerCase();
  if (!value || value.includes('receipt')) return 0;
  const net = value.match(/net\s*(\d{1,3})/);
  return net ? Number(net[1]) : null;
}

/** Due date for the terms from the invoice date (YYYY-MM-DD); null when the terms give no days. */
export function dueDateForTerms(invoiceDate: string, terms: string | null | undefined): string | null {
  const days = termsDays(terms);
  if (days == null || !/^\d{4}-\d{2}-\d{2}$/.test(invoiceDate)) return null;
  const date = new Date(`${invoiceDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export const PAYMENT_TERM_OPTIONS = ['Due on receipt', 'Net 7', 'Net 10', 'Net 15', 'Net 30', 'Net 45', 'Net 60'] as const;
