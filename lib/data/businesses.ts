/**
 * Server-side data layer for businesses list.
 * Uses unstable_cache so repeated requests share cache without hitting Supabase every time.
 */

import { unstable_cache } from 'next/cache';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { transformBusinessToProCardData } from '@/lib/utils/businessTransform';
import { normalizeLinks } from '@/lib/utils/normalizeLinks';
import type { ProCardData } from '@/components/proscard/ProCard';

interface DbLicenseRow {
  license_number: string | null;
  license_type: string | null;
  license_name: string | null;
}

interface DbAddressRow {
  street_address: string | null;
  apartment: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  gate_code?: string | null;
  address_note?: string | null;
}

interface DbBusinessRow {
  id: string;
  business_name: string;
  business_logo: string | null;
  business_background: string | null;
  slug: string | null;
  company_description: string | null;
  email: string | null;
  phone: string | null;
  mobile_phone: string | null;
  links: unknown;
  owner_id: string;
  addresses?: DbAddressRow | DbAddressRow[] | null;
  licenses?: DbLicenseRow[] | null;
}

const CACHE_TAG = 'businesses-list';
const REVALIDATE_SECONDS = 60;

async function fetchBusinessesFromDb(): Promise<ProCardData[]> {
  // Service role: no cookies(), safe to use inside unstable_cache. We only read public data (is_active = true).
  const supabase = createServiceRoleClient();
  const limit = 100;
  const { data: businesses, error } = await supabase
    .from('businesses')
    .select(`
      *,
      addresses (
        street_address,
        apartment,
        city,
        state,
        zip_code,
        gate_code,
        address_note
      ),
      licenses (
        license_number,
        license_type,
        license_name
      )
    `)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .range(0, limit - 1);

  if (error || !businesses?.length) {
    return [];
  }

  const rows = businesses as unknown as DbBusinessRow[];
  return rows.map((business) => {
    const licenses = (business.licenses || []).map((l) => ({
      license: l.license_type || 'GENERAL',
      licenseNumber: l.license_number || '',
      trade: l.license_name || '',
    }));
    if (licenses.length === 0) {
      licenses.push({ license: 'GENERAL', licenseNumber: '', trade: '' });
    }
    const address = Array.isArray(business.addresses) ? business.addresses[0] : business.addresses;
    const links = normalizeLinks(business.links);
    const transformed = transformBusinessToProCardData({
      id: business.id,
      businessName: business.business_name,
      businessLogo: business.business_logo || undefined,
      businessBackground: business.business_background || undefined,
      slug: business.slug || undefined,
      companyDescription: business.company_description || undefined,
      licenses,
      address: address?.street_address || undefined,
      streetAddress: address?.street_address || undefined,
      city: address?.city || undefined,
      state: address?.state || undefined,
      zipCode: address?.zip_code || undefined,
      apartment: address?.apartment || undefined,
      email: business.email || undefined,
      phone: business.phone || undefined,
      mobilePhone: business.mobile_phone || undefined,
      links,
      userId: business.owner_id,
    });
    if (!transformed.category) transformed.category = 'General';
    return transformed;
  });
}

/**
 * Cached list of active businesses for server components.
 * Revalidates every REVALIDATE_SECONDS.
 */
export async function getCachedBusinessesList(): Promise<ProCardData[]> {
  return unstable_cache(fetchBusinessesFromDb, [CACHE_TAG], {
    revalidate: REVALIDATE_SECONDS,
    tags: [CACHE_TAG],
  })();
}
