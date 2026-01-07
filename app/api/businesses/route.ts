import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { transformBusinessToProCardData } from '@/lib/utils/businessTransform';
import { normalizeLinks } from '@/lib/utils/normalizeLinks';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { logger } from '@/lib/utils/logger';
import { handleError } from '@/lib/utils/errorHandler';

// Route segment config - optimize for caching and performance
// This helps prevent unnecessary re-compilations and improves caching
export const dynamic = 'force-dynamic'; // Force dynamic since we need fresh data from Supabase
export const revalidate = 0; // Disable ISR - we use our own cache headers with stale-while-revalidate

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

/**
 * GET /api/businesses
 * List all active businesses (public endpoint)
 * 
 * Returns businesses in ProCardData format for display
 */
export async function GET(request: NextRequest) {
  try {
    // Check rate limit for general API endpoints
    const rateLimitResponse = await checkRateLimit(request, 'general');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    
    // Enforce pagination limits: default 20, max 100
    const requestedLimit = parseInt(searchParams.get('limit') || '20');
    const limit = Math.min(Math.max(requestedLimit, 1), 100); // Between 1 and 100
    const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0); // Non-negative

    // Build query - use simpler syntax for foreign key relationships
    let query = supabase
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
      .eq('is_active', true);

    // Apply search filter if provided
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      // Search in business_name or company_description
      query = query.or(`business_name.ilike.${searchTerm},company_description.ilike.${searchTerm}`);
    }

    // Order and paginate
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: businesses, error } = await query;

    if (error) {
      logger.error('Error fetching businesses', { endpoint: '/api/businesses' }, error as Error);
      return handleError(error, { endpoint: '/api/businesses' });
    }

    // Handle empty result set
    if (!businesses || businesses.length === 0) {
      return NextResponse.json({ businesses: [] });
    }

    // Transform to ProCardData format
    const businessRows = businesses as unknown as DbBusinessRow[];
    const transformedBusinesses = businessRows.map((business) => {
      // Map licenses from database format to transform function format
      const licenses = (business.licenses || []).map((l) => ({
        license: l.license_type || 'GENERAL',
        licenseNumber: l.license_number || '',
        trade: l.license_name || '',
      }));

      // Ensure at least one license exists (default to GENERAL if none)
      if (licenses.length === 0) {
        licenses.push({
          license: 'GENERAL',
          licenseNumber: '',
          trade: '',
        });
      }

      // Address can be an object (from foreign key) or array, handle both
      const address = Array.isArray(business.addresses) 
        ? business.addresses[0] 
        : business.addresses;

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

      // Ensure category is always set (should be set by transform, but double-check)
      if (!transformed.category) {
        transformed.category = 'General';
      }

      return transformed;
    });

    // Apply category filter in application code (category is derived from license codes)
    // Note: Search filtering is now done in the database query above
    let filtered = transformedBusinesses;
    
    if (category && category !== 'All') {
      filtered = filtered.filter((b) => b.category === category);
    }

    // Return paginated results with metadata
    return NextResponse.json(
      {
        businesses: filtered,
        pagination: {
          limit,
          offset,
          count: filtered.length,
          hasMore: filtered.length === limit, // If we got a full page, there might be more
        },
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      }
    );
  } catch (error) {
    logger.error('Error in GET /api/businesses', { endpoint: '/api/businesses' }, error as Error);
    return handleError(error, { endpoint: '/api/businesses' });
  }
}

