import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/types/supabase';

export interface EstimateBusinessBrand {
  business_name: string;
  business_logo: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  company_tagline: string | null;
}

const EMPTY_BRAND: EstimateBusinessBrand = {
  business_name: 'My Business',
  business_logo: null,
  email: null,
  phone: null,
  website: null,
  address: null,
  company_tagline: null,
};

function firstWebsite(links: Json | null | undefined): string | null {
  if (!Array.isArray(links)) return null;
  for (const entry of links) {
    if (!entry || typeof entry !== 'object') continue;
    const url = (entry as { url?: unknown }).url;
    if (typeof url === 'string' && url.trim()) return url.trim();
  }
  return null;
}

function formatAddress(row: {
  street_address?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
} | null): string | null {
  if (!row) return null;
  const line1 = row.street_address?.trim() || '';
  const cityStateZip = [row.city, row.state, row.zip_code]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean)
    .join(', ')
    .replace(', ,', ',');
  const parts = [line1, cityStateZip].filter(Boolean);
  return parts.length > 0 ? parts.join('\n') : null;
}

/** Active business letterhead for estimate/agreement documents. */
export async function loadEstimateBusinessBrand(
  supabase: SupabaseClient<Database>,
  ownerId: string
): Promise<EstimateBusinessBrand> {
  const { data: biz } = await supabase
    .from('businesses')
    .select('id, business_name, business_logo, email, phone, links, business_address_id')
    .eq('owner_id', ownerId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (!biz) return EMPTY_BRAND;

  let address: {
    street_address: string | null;
    city: string | null;
    state: string | null;
    zip_code: string | null;
  } | null = null;

  if (biz.business_address_id) {
    const { data } = await supabase
      .from('addresses')
      .select('street_address, city, state, zip_code')
      .eq('id', biz.business_address_id)
      .maybeSingle();
    address = data;
  }
  if (!address) {
    const { data } = await supabase
      .from('addresses')
      .select('street_address, city, state, zip_code')
      .eq('user_id', ownerId)
      .eq('address_type', 'business')
      .limit(1)
      .maybeSingle();
    address = data;
  }

  return {
    business_name: biz.business_name || EMPTY_BRAND.business_name,
    business_logo: biz.business_logo ?? null,
    email: biz.email ?? null,
    phone: biz.phone ?? null,
    website: firstWebsite(biz.links),
    address: formatAddress(address),
    company_tagline: null,
  };
}
