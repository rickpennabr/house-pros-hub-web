import type { createClient } from '@/lib/supabase/server';

export type DefaultCompanyShape = {
  id: string;
  business_name: string;
  business_logo: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  company_tagline?: string | null;
  website?: string;
};

/**
 * Resolves the default company for invoices: either the custom display name
 * (when default_display_name_id is set) or the business (when default_business_id is set),
 * or the owner's first business. Returns null if none available.
 */
export async function getDefaultCompanyForInvoice(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string
): Promise<DefaultCompanyShape | null> {
  const { data: settings } = await supabase
    .from('pro_invoice_settings')
    .select('default_business_id, default_display_name_id, company_tagline')
    .eq('owner_id', ownerId)
    .single();

  const defaultDisplayNameId = (settings as { default_display_name_id?: string | null } | null)?.default_display_name_id ?? null;
  const defaultBusinessId = (settings as { default_business_id?: string | null } | null)?.default_business_id ?? null;
  const companyTagline = (settings as { company_tagline?: string | null } | null)?.company_tagline ?? null;

  if (defaultDisplayNameId) {
    const { data: dn } = await supabase
      .from('pro_invoice_display_names')
      .select('id, display_name')
      .eq('id', defaultDisplayNameId)
      .eq('owner_id', ownerId)
      .single();
    if (dn) {
      return {
        id: (dn as { id: string }).id,
        business_name: (dn as { display_name: string }).display_name,
        business_logo: null,
        email: null,
        phone: null,
        address: null,
        company_tagline: companyTagline ?? null,
        website: undefined,
      };
    }
  }

  if (defaultBusinessId) {
    const biz = await getBusinessById(supabase, ownerId, defaultBusinessId);
    if (biz) return { ...biz, company_tagline: companyTagline ?? biz.company_tagline ?? null };
  }

  const firstBiz = await getFirstBusinessForOwner(supabase, ownerId);
  if (firstBiz) return { ...firstBiz, company_tagline: companyTagline ?? firstBiz.company_tagline ?? null };

  return null;
}

async function getBusinessById(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string,
  businessId: string
): Promise<DefaultCompanyShape | null> {
  const { data: biz } = await supabase
    .from('businesses')
    .select('id, business_name, business_logo, email, phone, business_address_id, links')
    .eq('id', businessId)
    .eq('owner_id', ownerId)
    .single();
  if (!biz) return null;
  let address: string | null = null;
  if ((biz as { business_address_id?: string }).business_address_id) {
    const { data: addr } = await supabase
      .from('addresses')
      .select('street_address, apartment, city, state, zip_code')
      .eq('id', (biz as { business_address_id: string }).business_address_id)
      .single();
    if (addr) {
      const a = addr as { street_address?: string; apartment?: string; city?: string; state?: string; zip_code?: string };
      const parts = [a.street_address, a.apartment, [a.city, a.state, a.zip_code].filter(Boolean).join(', ')].filter(Boolean);
      address = parts.join('\n');
    }
  }
  const links = (biz as { links?: { website?: string } }).links;
  return {
    id: (biz as { id: string }).id,
    business_name: (biz as { business_name: string }).business_name,
    business_logo: (biz as { business_logo: string | null }).business_logo,
    email: (biz as { email: string | null }).email,
    phone: (biz as { phone: string | null }).phone,
    address,
    company_tagline: null,
    website: links?.website ?? undefined,
  };
}

async function getFirstBusinessForOwner(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string
): Promise<DefaultCompanyShape | null> {
  const { data: firstBiz } = await supabase
    .from('businesses')
    .select('id, business_name, business_logo, email, phone, business_address_id, links')
    .eq('owner_id', ownerId)
    .eq('is_active', true)
    .limit(1)
    .single();
  if (!firstBiz) return null;
  return getBusinessById(supabase, ownerId, (firstBiz as { id: string }).id);
}
