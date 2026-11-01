/**
 * Public business directory queries.
 * Unfiltered pages are cached. Search and category run in Postgres and return one page.
 */

import { cache } from 'react';
import { unstable_cache, revalidateTag } from 'next/cache';
import { createServiceRoleClient } from '@/lib/supabase/server';
import {
  sanitizeDirectoryCategory,
  sanitizeDirectoryCity,
  sanitizeDirectorySearch,
} from '@/lib/data/directoryParams';
import { transformBusinessToProCardData } from '@/lib/utils/businessTransform';
import { normalizeLinks } from '@/lib/utils/normalizeLinks';
import { getBusinessCategories, licenseCodesForCategory } from '@/lib/utils/businessSearch';
import { DIRECTORY_CARD_PAGE_SIZE, DIRECTORY_MAX_PAGE_SIZE } from '@/lib/constants/businessDirectory';
import type { ProCardData } from '@/components/proscard/ProCard';

export { sanitizeDirectoryCategory, sanitizeDirectoryCity, sanitizeDirectorySearch } from '@/lib/data/directoryParams';

export const BUSINESS_DIRECTORY_CACHE_TAG = 'businesses-list';

export interface DirectoryQuery {
  limit: number;
  offset: number;
  search?: string;
  category?: string;
}

export interface DirectoryPage {
  businesses: ProCardData[];
  total: number;
}

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
}

interface DbBusinessRow {
  id: string;
  business_name: string;
  business_logo: string | null;
  slug: string | null;
  company_description: string | null;
  email: string | null;
  phone: string | null;
  mobile_phone: string | null;
  links: unknown;
  services?: string[] | null;
  owner_id: string;
  show_calendar_on_procard?: boolean | null;
  addresses?: DbAddressRow | DbAddressRow[] | null;
  licenses?: DbLicenseRow[] | null;
}

const LIST_SELECT = `
  id,
  business_name,
  business_logo,
  slug,
  company_description,
  email,
  phone,
  mobile_phone,
  links,
  services,
  owner_id,
  show_calendar_on_procard,
  addresses (
    street_address,
    apartment,
    city,
    state,
    zip_code
  ),
  licenses (
    license_number,
    license_type,
    license_name
  )
`;

export function clampDirectoryPage(limit: number, offset: number): { limit: number; offset: number } {
  return {
    limit: Math.min(Math.max(Number.isFinite(limit) ? limit : DIRECTORY_CARD_PAGE_SIZE, 1), DIRECTORY_MAX_PAGE_SIZE),
    offset: Math.max(Number.isFinite(offset) ? offset : 0, 0),
  };
}

/** Drop the cached directory after a business is created, updated, or removed. */
export function invalidateBusinessDirectoryCache(): void {
  revalidateTag(BUSINESS_DIRECTORY_CACHE_TAG, { expire: 0 });
}

function quotePostgrestValue(value: string): string {
  if (/[,\s()"\\]/.test(value)) {
    return `"${value.replace(/"/g, '')}"`;
  }
  return value;
}

async function loadLicenseCategories(): Promise<Array<{ code: string; name: string }>> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from('license_categories').select('code, name');
  return (data ?? []).map((row) => ({ code: row.code, name: row.name }));
}

const getCachedLicenseCategories = unstable_cache(loadLicenseCategories, ['license-categories'], {
  revalidate: 300,
  tags: [BUSINESS_DIRECTORY_CACHE_TAG],
});

function toCards(rows: DbBusinessRow[], licenseCategories: Array<{ code: string; name: string }>): ProCardData[] {
  return rows.map((business) => {
    const licenses = (business.licenses || []).map((license) => ({
      license: license.license_type || 'GENERAL',
      licenseNumber: license.license_number || '',
      trade: license.license_name || '',
    }));
    if (licenses.length === 0) {
      licenses.push({ license: 'GENERAL', licenseNumber: '', trade: '' });
    }
    const address = Array.isArray(business.addresses) ? business.addresses[0] : business.addresses;
    const transformed = transformBusinessToProCardData(
      {
        id: business.id,
        businessName: business.business_name,
        businessLogo: business.business_logo || undefined,
        slug: business.slug || undefined,
        companyDescription: business.company_description || undefined,
        licenses,
        services: business.services ?? [],
        address: address?.street_address || undefined,
        streetAddress: address?.street_address || undefined,
        city: address?.city || undefined,
        state: address?.state || undefined,
        zipCode: address?.zip_code || undefined,
        apartment: address?.apartment || undefined,
        email: business.email || undefined,
        phone: business.phone || undefined,
        mobilePhone: business.mobile_phone || undefined,
        links: normalizeLinks(business.links),
        userId: business.owner_id,
        showCalendarOnProCard: business.show_calendar_on_procard ?? false,
      },
      { licenseCategories }
    );
    if (!transformed.category) transformed.category = 'General';
    const { userId: _userId, ...card } = transformed;
    void _userId;
    return card;
  });
}

async function queryPlainDirectory(limit: number, offset: number): Promise<DirectoryPage> {
  const supabase = createServiceRoleClient();
  const licenseCategories = await getCachedLicenseCategories();
  const { data, error, count } = await supabase
    .from('businesses')
    .select(LIST_SELECT, { count: 'exact' })
    .eq('is_active', true)
    .order('display_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(error.message);
  }

  return {
    businesses: toCards((data ?? []) as unknown as DbBusinessRow[], licenseCategories),
    total: count ?? data?.length ?? 0,
  };
}

function isMissingDirectoryRpc(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === 'PGRST202' ||
    error.code === '42883' ||
    (error.message ?? '').includes('list_directory_business_ids')
  );
}

async function queryFilteredDirectory(
  search: string,
  category: string,
  limit: number,
  offset: number
): Promise<DirectoryPage | null> {
  const supabase = createServiceRoleClient();
  const codes = category
    ? [...new Set([...licenseCodesForCategory(category), category])]
    : null;

  const { data, error } = await supabase.rpc('list_directory_business_ids', {
    search: search || null,
    license_types: codes,
    category_name: category || null,
    lim: limit,
    off: offset,
  });

  if (error) {
    if (isMissingDirectoryRpc(error)) return null;
    throw new Error(error.message);
  }

  const pageRows = data ?? [];
  const total = Number(pageRows[0]?.total_count ?? 0);
  const ids = pageRows.map((row) => row.id).filter((id): id is string => Boolean(id));
  if (ids.length === 0) {
    return { businesses: [], total };
  }

  const licenseCategories = await getCachedLicenseCategories();
  const { data: businesses, error: fetchError } = await supabase
    .from('businesses')
    .select(LIST_SELECT)
    .in('id', ids);

  if (fetchError) {
    throw new Error(fetchError.message);
  }
  if (!businesses) {
    return { businesses: [], total };
  }

  const order = new Map(ids.map((id, index) => [id, index]));
  const rows = (businesses as unknown as DbBusinessRow[]).slice().sort(
    (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)
  );
  return { businesses: toCards(rows, licenseCategories), total };
}

async function queryFilteredFallback(
  search: string,
  category: string,
  limit: number,
  offset: number
): Promise<DirectoryPage> {
  const supabase = createServiceRoleClient();
  const licenseCategories = await getCachedLicenseCategories();
  const select = category ? LIST_SELECT.replace('licenses (', 'licenses!inner (') : LIST_SELECT;
  let query = supabase
    .from('businesses')
    .select(select, { count: 'exact' })
    .eq('is_active', true);

  if (category) {
    const codes = [...new Set([...licenseCodesForCategory(category), category])];
    const typeList = codes.map(quotePostgrestValue).join(',');
    query = query.or(
      `license_type.in.(${typeList}),license_name.eq.${quotePostgrestValue(category)}`,
      { referencedTable: 'licenses' }
    );
  }

  if (search) {
    const term = quotePostgrestValue(`%${search}%`);
    query = query.or(`business_name.ilike.${term},company_description.ilike.${term}`);
  }

  const { data, error, count } = await query
    .order('display_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(error.message);
  }

  const seen = new Set<string>();
  const rows = ((data ?? []) as unknown as DbBusinessRow[]).filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });

  return {
    businesses: toCards(rows, licenseCategories),
    total: count ?? rows.length,
  };
}

async function queryBusinessDirectory(params: DirectoryQuery): Promise<DirectoryPage> {
  const { limit, offset } = clampDirectoryPage(params.limit, params.offset);
  const search = sanitizeDirectorySearch(params.search);
  const category = sanitizeDirectoryCategory(params.category);

  if (!search && !category) {
    return queryPlainDirectory(limit, offset);
  }

  const filtered = await queryFilteredDirectory(search, category, limit, offset);
  if (filtered) return filtered;
  return queryFilteredFallback(search, category, limit, offset);
}

/**
 * One page of the public directory.
 * Unfiltered pages share a 60s cache. Filtered pages hit Postgres directly.
 */
export async function getBusinessDirectoryPage(params: DirectoryQuery): Promise<DirectoryPage> {
  const { limit, offset } = clampDirectoryPage(params.limit, params.offset);
  const search = sanitizeDirectorySearch(params.search);
  const category = sanitizeDirectoryCategory(params.category);

  if (!search && !category) {
    return unstable_cache(
      () => queryPlainDirectory(limit, offset),
      [BUSINESS_DIRECTORY_CACHE_TAG, String(limit), String(offset)],
      { revalidate: 60, tags: [BUSINESS_DIRECTORY_CACHE_TAG] }
    )();
  }

  return queryBusinessDirectory({ limit, offset, search, category });
}

interface LicenseCategorySource {
  license_type: string | null;
  license_name: string | null;
  businesses:
    | { display_order: number | null; created_at: string }
    | { display_order: number | null; created_at: string }[]
    | null;
}

async function fetchDirectoryCategories(): Promise<string[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('licenses')
    .select(`
      license_type,
      license_name,
      businesses!inner (
        is_active,
        display_order,
        created_at
      )
    `)
    .eq('businesses.is_active', true);

  if (error || !data) return [];

  const rows = (data as unknown as LicenseCategorySource[]).slice().sort((a, b) => {
    const left = Array.isArray(a.businesses) ? a.businesses[0] : a.businesses;
    const right = Array.isArray(b.businesses) ? b.businesses[0] : b.businesses;
    const leftOrder = left?.display_order ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right?.display_order ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    const leftCreated = left?.created_at ? new Date(left.created_at).getTime() : 0;
    const rightCreated = right?.created_at ? new Date(right.created_at).getTime() : 0;
    return rightCreated - leftCreated;
  });

  const seen = new Set<string>();
  const order: string[] = [];
  for (const row of rows) {
    const labels = getBusinessCategories({
      id: 'directory',
      businessName: 'directory',
      contractorType: '',
      links: [],
      licenses: [
        {
          license: row.license_type || 'GENERAL',
          licenseNumber: '',
          tradeName: row.license_name || undefined,
        },
      ],
    });
    for (const label of labels) {
      if (!seen.has(label)) {
        seen.add(label);
        order.push(label);
      }
    }
  }
  return order;
}

/** Category chips for the directory, in listing order. Cached with the directory. */
export async function getCachedDirectoryCategories(): Promise<string[]> {
  return unstable_cache(fetchDirectoryCategories, [BUSINESS_DIRECTORY_CACHE_TAG, 'categories'], {
    revalidate: 60,
    tags: [BUSINESS_DIRECTORY_CACHE_TAG],
  })();
}

const AGENT_CITY_SCAN = 200;

/** One active business by id or slug. Inactive listings are hidden. */
async function loadPublicBusiness(idOrSlug: string): Promise<ProCardData | null> {
  const supabase = createServiceRoleClient();
  const licenseCategories = await getCachedLicenseCategories();
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
  const query = supabase.from('businesses').select(LIST_SELECT).eq('is_active', true);
  const { data, error } = await (isUUID ? query.eq('id', idOrSlug) : query.eq('slug', idOrSlug)).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return toCards([data as unknown as DbBusinessRow], licenseCategories)[0] ?? null;
}

export const getPublicBusiness = cache(loadPublicBusiness);

export async function listDirectoryCities(): Promise<string[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from('businesses').select('addresses(city)').eq('is_active', true);
  if (error || !data) return [];

  const cities = new Set<string>();
  for (const row of data) {
    const addresses = row.addresses as { city: string | null } | { city: string | null }[] | null;
    const list = Array.isArray(addresses) ? addresses : addresses ? [addresses] : [];
    for (const address of list) {
      const city = sanitizeDirectoryCity(address.city);
      if (city) cities.add(city);
    }
  }
  return [...cities].sort((left, right) => left.localeCompare(right));
}

export async function getCachedDirectoryCities(): Promise<string[]> {
  return unstable_cache(listDirectoryCities, [BUSINESS_DIRECTORY_CACHE_TAG, 'cities'], {
    revalidate: 3600,
    tags: [BUSINESS_DIRECTORY_CACHE_TAG],
  })();
}

export interface AgentDirectoryPage extends DirectoryPage {
  /** True when the city has more active pros than the scan cap, so this page is incomplete. */
  cityMatchTruncated: boolean;
}

function matchesAgentSearch(card: ProCardData, search: string): boolean {
  const needle = search.toLowerCase();
  const haystack = [
    card.businessName,
    card.companyDescription,
    card.contractorType,
    card.category,
    ...(card.services ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

function matchesAgentCategory(card: ProCardData, category: string): boolean {
  const needle = category.toLowerCase();
  if ((card.category ?? '').toLowerCase() === needle) return true;
  if ((card.contractorType ?? '').toLowerCase() === needle) return true;
  return (card.licenses ?? []).some((license) => {
    const named = license as { tradeName?: string; trade?: string; license: string };
    return (
      (named.tradeName ?? '').toLowerCase() === needle ||
      (named.trade ?? '').toLowerCase() === needle ||
      named.license.toLowerCase() === needle
    );
  });
}

/**
 * Directory search for agents.
 * City is applied in a bounded scan so the public directory query stays unchanged.
 */
export async function searchBusinessesForAgents(params: DirectoryQuery & { city?: string }): Promise<AgentDirectoryPage> {
  const { limit, offset } = clampDirectoryPage(params.limit, params.offset);
  const search = sanitizeDirectorySearch(params.search);
  const category = sanitizeDirectoryCategory(params.category);
  const city = sanitizeDirectoryCity(params.city);

  if (!city) {
    const page = await getBusinessDirectoryPage({ limit, offset, search, category });
    return { ...page, cityMatchTruncated: false };
  }

  const supabase = createServiceRoleClient();
  const licenseCategories = await getCachedLicenseCategories();
  const select = LIST_SELECT.replace('addresses (', 'addresses!inner (');
  const { data, error, count } = await supabase
    .from('businesses')
    .select(select, { count: 'exact' })
    .eq('is_active', true)
    .ilike('addresses.city', city)
    .order('display_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(AGENT_CITY_SCAN);

  if (error) throw new Error(error.message);

  const seen = new Set<string>();
  const rows = ((data ?? []) as unknown as DbBusinessRow[]).filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
  let cards = toCards(rows, licenseCategories);
  if (search) cards = cards.filter((card) => matchesAgentSearch(card, search));
  if (category) cards = cards.filter((card) => matchesAgentCategory(card, category));

  return {
    businesses: cards.slice(offset, offset + limit),
    total: cards.length,
    cityMatchTruncated: (count ?? rows.length) > AGENT_CITY_SCAN,
  };
}
