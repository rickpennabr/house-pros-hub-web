import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { ADMIN_EMAIL } from '@/lib/constants/admin';
import { transformBusinessToProCardData } from '@/lib/utils/businessTransform';
import { normalizeLinks } from '@/lib/utils/normalizeLinks';
import { sanitizeText, sanitizeUrl } from '@/lib/utils/sanitize';

interface DbLicenseRow {
  license_number: string | null;
  license_type: string | null;
  license_name: string | null;
}

interface LicenseInput {
  license: string;
  licenseNumber: string;
  trade?: string;
}

interface BusinessUpdateBody {
  businessName?: string;
  slug?: string;
  businessLogo?: string;
  businessBackground?: string;
  businessBackgroundPosition?: string;
  companyDescription?: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
  links?: unknown;
  services?: Array<{ name: string }>;
  images?: string[];
  operatingHours?: unknown;
  streetAddress?: string;
  apartment?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  gateCode?: string;
  addressNote?: string;
  licenses?: LicenseInput[];
  is_active?: boolean;
  is_verified?: boolean;
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      user: null,
    };
  }
  if (user.email?.toLowerCase().trim() !== ADMIN_EMAIL.toLowerCase().trim()) {
    return {
      error: NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      ),
      user: null,
    };
  }
  return { error: null, user };
}

/**
 * GET /api/admin/businesses/[id]
 * Get one business for admin view/edit with address and licenses. Admin only.
 * Returns same shape as public GET (transformed) for use in admin form.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: 'Business ID required' },
        { status: 400 }
      );
    }

    const service = createServiceRoleClient();

    const { data: business, error } = await service
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
      .eq('id', id)
      .single();

    if (error || !business) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      );
    }

    const licenseRows = (business.licenses || []) as DbLicenseRow[];
    const licenses = licenseRows.map((l) => ({
      license: l.license_type || 'GENERAL',
      licenseNumber: l.license_number || '',
      trade: l.license_name || '',
    }));
    const licensesForTransform =
      licenses.length > 0
        ? licenses
        : [{ license: 'GENERAL', licenseNumber: '', trade: '' }];

    const address = Array.isArray(business.addresses)
      ? business.addresses[0]
      : business.addresses;
    const links = normalizeLinks(business.links);
    const businessServices = (business as { services?: string[] }).services;
    const businessImages = (business as { images?: string[] }).images;

    const transformed = transformBusinessToProCardData({
      id: business.id,
      businessName: business.business_name,
      businessLogo: business.business_logo || undefined,
      businessBackground: business.business_background || undefined,
      businessBackgroundPosition:
        (business as { business_background_position?: string | null })
          .business_background_position ?? '50% 50%',
      slug: business.slug || undefined,
      companyDescription: business.company_description || undefined,
      licenses: licensesForTransform,
      services: Array.isArray(businessServices) ? businessServices : [],
      images: Array.isArray(businessImages) ? businessImages : [],
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

    return NextResponse.json({
      business: transformed,
      is_active: business.is_active ?? true,
      is_verified: business.is_verified ?? false,
    });
  } catch (err) {
    console.error('GET /api/admin/businesses/[id]', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/businesses/[id]
 * Update a business (admin only). Same body as owner PUT plus is_active, is_verified.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: 'Business ID required' },
        { status: 400 }
      );
    }

    const rawBody = (await request.json().catch(() => ({}))) as BusinessUpdateBody;
    const body: BusinessUpdateBody = {
      ...rawBody,
      businessName: rawBody.businessName ? sanitizeText(rawBody.businessName) || rawBody.businessName : rawBody.businessName,
      slug: rawBody.slug ? sanitizeText(rawBody.slug) || rawBody.slug : rawBody.slug,
      companyDescription:
        rawBody.companyDescription !== undefined
          ? (rawBody.companyDescription ? sanitizeText(rawBody.companyDescription) || undefined : undefined)
          : rawBody.companyDescription,
      email:
        rawBody.email !== undefined
          ? (rawBody.email ? sanitizeText(rawBody.email) || undefined : undefined)
          : rawBody.email,
      phone: rawBody.phone !== undefined ? (rawBody.phone ? sanitizeText(rawBody.phone) || undefined : undefined) : rawBody.phone,
      mobilePhone:
        rawBody.mobilePhone !== undefined
          ? (rawBody.mobilePhone ? sanitizeText(rawBody.mobilePhone) || undefined : undefined)
          : rawBody.mobilePhone,
      streetAddress: rawBody.streetAddress ? sanitizeText(rawBody.streetAddress) || rawBody.streetAddress : rawBody.streetAddress,
      apartment: rawBody.apartment ? sanitizeText(rawBody.apartment) || undefined : rawBody.apartment,
      city: rawBody.city ? sanitizeText(rawBody.city) || rawBody.city : rawBody.city,
      state: rawBody.state ? sanitizeText(rawBody.state) || rawBody.state : rawBody.state,
      zipCode: rawBody.zipCode ? sanitizeText(rawBody.zipCode) || rawBody.zipCode : rawBody.zipCode,
      gateCode: rawBody.gateCode ? sanitizeText(rawBody.gateCode) || undefined : rawBody.gateCode,
      addressNote: rawBody.addressNote ? sanitizeText(rawBody.addressNote) || undefined : rawBody.addressNote,
      links:
        rawBody.links && Array.isArray(rawBody.links)
          ? rawBody.links.map((link: { type?: string; url?: string; value?: string }) => {
              const url = link.url?.trim();
              const value = link.value != null ? sanitizeText(String(link.value)) : undefined;
              if (link.type === 'phone' || link.type === 'email' || link.type === 'location') {
                return { ...link, value: value ?? link.value };
              }
              const safeUrl = url ? sanitizeUrl(url) || url : undefined;
              return { ...link, url: safeUrl ?? link.url, value: value ?? link.value };
            })
          : rawBody.links,
      services:
        rawBody.services && Array.isArray(rawBody.services)
          ? rawBody.services
              .map((s: { name?: string } | string) => {
                const name = typeof s === 'string' ? s : (s?.name != null ? String(s.name).trim() : '');
                return name ? { name: sanitizeText(name) || name } : null;
              })
              .filter((item): item is { name: string } => item != null && item.name.length > 0)
          : rawBody.services,
      licenses:
        rawBody.licenses && Array.isArray(rawBody.licenses)
          ? rawBody.licenses.map((lic) => ({
              license: lic.license ? sanitizeText(lic.license) || lic.license : lic.license,
              licenseNumber: lic.licenseNumber ? sanitizeText(lic.licenseNumber) || lic.licenseNumber : lic.licenseNumber,
              trade: lic.trade ? sanitizeText(lic.trade) || lic.trade : lic.trade,
            }))
          : rawBody.licenses,
    };

    const service = createServiceRoleClient();

    const { data: existingBusiness, error: fetchError } = await service
      .from('businesses')
      .select('owner_id, business_address_id')
      .eq('id', id)
      .single();

    if (fetchError || !existingBusiness) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      );
    }

    if (body.streetAddress || body.city || body.state || body.zipCode) {
      if (existingBusiness.business_address_id) {
        await service
          .from('addresses')
          .update({
            street_address: body.streetAddress || undefined,
            apartment: body.apartment || undefined,
            city: body.city || undefined,
            state: body.state || undefined,
            zip_code: body.zipCode || undefined,
            gate_code: body.gateCode || undefined,
            address_note: body.addressNote || undefined,
          })
          .eq('id', existingBusiness.business_address_id);
      }
    }

    const updateData: Record<string, unknown> = {};
    if (body.businessName) updateData.business_name = body.businessName;
    if (body.slug) updateData.slug = body.slug;
    if (body.businessLogo !== undefined) updateData.business_logo = body.businessLogo;
    if (body.businessBackground !== undefined) updateData.business_background = body.businessBackground;
    if (body.businessBackgroundPosition !== undefined)
      updateData.business_background_position = body.businessBackgroundPosition;
    if (body.companyDescription !== undefined) updateData.company_description = body.companyDescription;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.mobilePhone !== undefined) updateData.mobile_phone = body.mobilePhone;
    if (body.links !== undefined) updateData.links = body.links;
    if (body.services !== undefined) updateData.services = body.services;
    if (body.images !== undefined) updateData.images = body.images;
    if (body.operatingHours !== undefined) updateData.operating_hours = body.operatingHours;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;
    if (body.is_verified !== undefined) updateData.is_verified = body.is_verified;

    const { error: updateError } = await service
      .from('businesses')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('PUT /api/admin/businesses/[id] updateError', updateError);
      return NextResponse.json(
        { error: 'Failed to update business' },
        { status: 500 }
      );
    }

    if (body.licenses && Array.isArray(body.licenses)) {
      const { data: licenseCategories } = await service
        .from('license_categories')
        .select('code')
        .eq('requires_contractor_license', false);
      const nonContractorCodes = new Set(
        (licenseCategories ?? []).map((r: { code: string }) => r.code)
      );
      const { isValidNevadaBusinessLicense } = await import('@/lib/schemas/business');
      for (let i = 0; i < body.licenses.length; i++) {
        const lic = body.licenses[i];
        if (lic?.license && nonContractorCodes.has(lic.license)) {
          const num = (lic.licenseNumber ?? '').trim();
          if (num && !isValidNevadaBusinessLicense(num)) {
            return NextResponse.json(
              { error: `License ${i + 1}: Nevada Business License must be 11 digits (spaces or dashes are ignored)` },
              { status: 400 }
            );
          }
        }
      }
      await service.from('licenses').delete().eq('business_id', id);
      const licenseInserts = body.licenses.map((license) => {
        const num = (license.licenseNumber ?? '').trim();
        return {
          business_id: id,
          license_number: num || '',
          license_type: license.license,
          license_name: license.trade || null,
          is_active: true,
        };
      });
      const { error: insertError } = await service.from('licenses').insert(licenseInserts);
      if (insertError) {
        console.error('PUT /api/admin/businesses/[id] licenses insert error:', insertError);
        return NextResponse.json(
          { error: insertError.code === '23505' ? 'A license with this number already exists' : 'Failed to save licenses' },
          { status: 400 }
        );
      }
    }

    const { data: completeBusiness, error: completeError } = await service
      .from('businesses')
      .select(
        `
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
      `
      )
      .eq('id', id)
      .single();

    if (completeError || !completeBusiness) {
      return NextResponse.json({ ok: true });
    }

    const licenseRows = (completeBusiness.licenses || []) as DbLicenseRow[];
    const licenses = licenseRows.map((l) => ({
      license: l.license_type || 'GENERAL',
      licenseNumber: l.license_number || '',
      trade: l.license_name || '',
    }));
    const licensesForTransform =
      licenses.length > 0
        ? licenses
        : [{ license: 'GENERAL', licenseNumber: '', trade: '' }];
    const address = Array.isArray(completeBusiness.addresses)
      ? completeBusiness.addresses[0]
      : completeBusiness.addresses;
    const businessServices = (completeBusiness as { services?: string[] }).services;
    const businessImages = (completeBusiness as { images?: string[] }).images;
    const transformed = transformBusinessToProCardData({
      id: completeBusiness.id,
      businessName: completeBusiness.business_name,
      businessLogo: completeBusiness.business_logo || undefined,
      businessBackground: completeBusiness.business_background || undefined,
      businessBackgroundPosition:
        (completeBusiness as { business_background_position?: string | null })
          .business_background_position ?? '50% 50%',
      slug: completeBusiness.slug || undefined,
      companyDescription: completeBusiness.company_description || undefined,
      licenses: licensesForTransform,
      services: Array.isArray(businessServices) ? businessServices : [],
      images: Array.isArray(businessImages) ? businessImages : [],
      address: address?.street_address || undefined,
      streetAddress: address?.street_address || undefined,
      city: address?.city || undefined,
      state: address?.state || undefined,
      zipCode: address?.zip_code || undefined,
      apartment: address?.apartment || undefined,
      email: completeBusiness.email || undefined,
      phone: completeBusiness.phone || undefined,
      mobilePhone: completeBusiness.mobile_phone || undefined,
      links: normalizeLinks(completeBusiness.links),
      userId: completeBusiness.owner_id,
    });

    return NextResponse.json({ business: transformed });
  } catch (err) {
    console.error('PUT /api/admin/businesses/[id]', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/businesses/[id]
 * Delete a business. Admin only. May fail if dependent records exist (e.g. licenses).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: 'Business ID required' },
        { status: 400 }
      );
    }

    const service = createServiceRoleClient();

    const { error: deleteError } = await service
      .from('businesses')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message || 'Failed to delete business' },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/admin/businesses/[id]', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
