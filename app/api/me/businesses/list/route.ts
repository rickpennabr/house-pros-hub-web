import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { transformBusinessToProCardData } from '@/lib/utils/businessTransform';
import { normalizeLinks } from '@/lib/utils/normalizeLinks';

/**
 * GET /api/me/businesses/list
 * Returns full list of businesses owned by the current user (for account-management Select Account).
 * Requires auth.
 */
export async function GET() {
  try {
    const supabaseAuth = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser();

    if (userError || !user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const service = createServiceRoleClient();
    const { data: rows, error } = await service
      .from('businesses')
      .select(`
        id,
        business_name,
        business_logo,
        business_background,
        business_background_position,
        slug,
        company_description,
        email,
        phone,
        mobile_phone,
        links,
        owner_id,
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
      .eq('owner_id', user.id)
      .eq('is_active', true)
      .order('business_name');

    if (error) {
      console.error('GET /api/me/businesses/list error:', error);
      return NextResponse.json({ error: 'Failed to load businesses' }, { status: 500 });
    }

    const businesses = (rows ?? []).map((business: Record<string, unknown>) => {
      const address = Array.isArray(business.addresses) ? business.addresses[0] : business.addresses;
      const links = normalizeLinks(business.links);
      const transformed = transformBusinessToProCardData({
        id: business.id as string,
        businessName: (business.business_name as string) ?? '',
        businessLogo: (business.business_logo as string) || undefined,
        businessBackground: (business.business_background as string) || undefined,
        businessBackgroundPosition: (business.business_background_position as string) ?? '50% 50%',
        slug: (business.slug as string) || undefined,
        companyDescription: (business.company_description as string) || undefined,
        licenses: (business.licenses as Array<{ license_number?: string; license_type?: string; license_name?: string }>)?.map((l) => ({
          license: l.license_type ?? '',
          licenseNumber: l.license_number ?? '',
          trade: l.license_name ?? undefined,
        })) ?? [],
        services: [],
        images: [],
        address: (address as { street_address?: string })?.street_address || undefined,
        streetAddress: (address as { street_address?: string })?.street_address || undefined,
        city: (address as { city?: string })?.city || undefined,
        state: (address as { state?: string })?.state || undefined,
        zipCode: (address as { zip_code?: string })?.zip_code || undefined,
        apartment: (address as { apartment?: string })?.apartment || undefined,
        email: (business.email as string) || undefined,
        phone: (business.phone as string) || undefined,
        mobilePhone: (business.mobile_phone as string) || undefined,
        links,
        userId: business.owner_id as string,
      });
      return { ...transformed, userId: user.id };
    });

    return NextResponse.json({ businesses }, { status: 200 });
  } catch (e) {
    console.error('GET /api/me/businesses/list error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
