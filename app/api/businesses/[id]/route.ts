import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { requireAuth, AuthenticatedRequest } from '@/lib/middleware/auth';
import { transformBusinessToProCardData } from '@/lib/utils/businessTransform';
import { normalizeLinks } from '@/lib/utils/normalizeLinks';
import { deleteBusinessBackground, deleteBusinessLogo } from '@/lib/utils/storage';
import { sanitizeText, sanitizeUrl } from '@/lib/utils/sanitize';
import { handleError } from '@/lib/utils/errorHandler';
import { logger } from '@/lib/utils/logger';

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
}

/**
 * GET /api/businesses/[id]
 * Get a single business by ID or slug
 */
async function handleGetBusiness(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const businessId = id;
  console.log('[GET /api/businesses/[id]] request', { businessId });

  try {
    // Prefer service role (matches business list). Fall back to anon if key is missing (e.g. production env).
    let supabase: Awaited<ReturnType<typeof createClient>>;
    try {
      supabase = createServiceRoleClient();
      console.log('[GET /api/businesses/[id]] using service role client');
    } catch (serviceRoleError) {
      console.warn('[GET /api/businesses/[id]] service role unavailable, using anon client', {
        message: serviceRoleError instanceof Error ? serviceRoleError.message : String(serviceRoleError),
      });
      supabase = await createClient();
    }

    // Check if businessId is a UUID (36 chars with dashes) or a slug
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(businessId);
    
    // Build query - try by ID if it's a UUID, otherwise try by slug
    // For slug lookup, only return active businesses (same as list).
    const baseQuery = supabase
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
      `);
    
    const query = isUUID
      ? baseQuery.eq('id', businessId).single()
      : baseQuery.eq('slug', businessId).eq('is_active', true).single();

    const { data: business, error } = await query;
    console.log('[GET /api/businesses/[id]] query result', {
      businessId,
      hasData: !!business,
      error: error?.message,
      errorCode: error?.code,
    });

    if (error || !business) {
      // Log more details for debugging
      logger.error('Business not found', { 
        endpoint: '/api/businesses/[id]', 
        businessId, 
        error: error?.message || 'No business found',
        errorCode: error?.code 
      });
      return NextResponse.json(
        { error: 'Business not found', details: error?.message || 'No business found with the provided ID or slug' },
        { status: 404 }
      );
    }

    const licenseRows = (business.licenses || []) as DbLicenseRow[];
    const licenses = licenseRows.map((l) => ({
      license: l.license_type || 'GENERAL',
      licenseNumber: l.license_number || '',
      trade: l.license_name || '',
    }));

    // Ensure at least one license exists (default to GENERAL if none)
    const licensesForTransform = licenses.length > 0 ? licenses : [{
      license: 'GENERAL',
      licenseNumber: '',
      trade: '',
    }];

    // Address can be an object (from foreign key) or array, handle both
    const address = Array.isArray(business.addresses) 
      ? business.addresses[0] 
      : business.addresses;

    const links = normalizeLinks(business.links);

    const { data: licenseCategories } = await supabase
      .from('license_categories')
      .select('code, name');
    const licenseCategoriesList = (licenseCategories ?? []).map((r: { code: string; name: string }) => ({
      code: r.code,
      name: r.name,
    }));

    const businessServices = (business as { services?: string[] }).services;
    const businessImages = (business as { images?: string[] }).images;
    const transformed = transformBusinessToProCardData(
      {
        id: business.id,
        businessName: business.business_name,
        businessLogo: business.business_logo || undefined,
        businessBackground: business.business_background || undefined,
        businessBackgroundPosition: (business as { business_background_position?: string | null }).business_background_position ?? '50% 50%',
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
      },
      { licenseCategories: licenseCategoriesList }
    );

    return NextResponse.json({ business: transformed });
  } catch (error) {
    // Log to console so production (e.g. Vercel) shows the cause of 500
    console.error('[GET /api/businesses/[id]] error', {
      businessId,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    logger.error('Error in GET /api/businesses/[id]', { endpoint: '/api/businesses/[id]', businessId }, error as Error);
    return handleError(error, { endpoint: '/api/businesses/[id]', businessId });
  }
}

/**
 * PUT /api/businesses/[id]
 * Update a business (owner only)
 */
async function handleUpdateBusiness(
  request: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = request.userId;
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const supabase = await createClient();
    const { id } = await params;
    const businessId = id;
    const rawBody = (request._body || await request.json()) as BusinessUpdateBody;

    // Sanitize user-editable strings before persist (defense-in-depth)
    const body: BusinessUpdateBody = {
      ...rawBody,
      businessName: rawBody.businessName ? sanitizeText(rawBody.businessName) || rawBody.businessName : rawBody.businessName,
      slug: rawBody.slug ? sanitizeText(rawBody.slug) || rawBody.slug : rawBody.slug,
      companyDescription: rawBody.companyDescription !== undefined
        ? (rawBody.companyDescription ? sanitizeText(rawBody.companyDescription) || undefined : undefined)
        : rawBody.companyDescription,
      email: rawBody.email !== undefined
        ? (rawBody.email ? sanitizeText(rawBody.email) || undefined : undefined)
        : rawBody.email,
      phone: rawBody.phone !== undefined ? (rawBody.phone ? sanitizeText(rawBody.phone) || undefined : undefined) : rawBody.phone,
      mobilePhone: rawBody.mobilePhone !== undefined
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
              const safeUrl = url ? (sanitizeUrl(url) || url) : undefined;
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

    // Verify ownership
    const { data: existingBusiness, error: fetchError } = await supabase
      .from('businesses')
      .select('owner_id, business_address_id, business_logo, business_background, business_background_position')
      .eq('id', businessId)
      .single();

    if (fetchError || !existingBusiness) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      );
    }

    if (existingBusiness.owner_id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized - you can only update your own business' },
        { status: 403 }
      );
    }

    const oldBusinessLogo = existingBusiness.business_logo || null;
    const oldBusinessBackground = existingBusiness.business_background || null;

    // Update business address if provided
    if (body.streetAddress || body.city || body.state || body.zipCode) {
      if (existingBusiness.business_address_id) {
        await supabase
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

    // Update business record
    const updateData: Record<string, unknown> = {};
    if (body.businessName) updateData.business_name = body.businessName;
    if (body.slug) updateData.slug = body.slug;
    if (body.businessLogo !== undefined) updateData.business_logo = body.businessLogo;
    if (body.businessBackground !== undefined) updateData.business_background = body.businessBackground;
    if (body.businessBackgroundPosition !== undefined) updateData.business_background_position = body.businessBackgroundPosition;
    if (body.companyDescription !== undefined) updateData.company_description = body.companyDescription;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.mobilePhone !== undefined) updateData.mobile_phone = body.mobilePhone;
    if (body.links !== undefined) updateData.links = body.links;
    if (body.services !== undefined) updateData.services = body.services;
    if (body.images !== undefined) updateData.images = body.images;
    if (body.operatingHours !== undefined) updateData.operating_hours = body.operatingHours;

    const { error: updateError } = await supabase
      .from('businesses')
      .update(updateData)
      .eq('id', businessId)
      .select()
      .single();

    if (updateError) {
      logger.error('Error updating business', { endpoint: '/api/businesses/[id]' }, updateError as Error);
      return NextResponse.json(
        { error: 'Failed to update business' },
        { status: 500 }
      );
    }

    // Safe image swap: delete old images only after DB update succeeds
    if (body.businessLogo !== undefined && oldBusinessLogo && body.businessLogo !== oldBusinessLogo) {
      try {
        const deleted = await deleteBusinessLogo(oldBusinessLogo);
        if (!deleted) {
          logger.warn('Failed to delete old business logo (post-update)', { url: oldBusinessLogo });
        }
      } catch (error) {
        logger.warn('Error deleting old business logo (post-update)', { error });
      }
    }

    if (body.businessBackground !== undefined && oldBusinessBackground && body.businessBackground !== oldBusinessBackground) {
      try {
        const deleted = await deleteBusinessBackground(oldBusinessBackground);
        if (!deleted) {
          logger.warn('Failed to delete old business background (post-update)', { url: oldBusinessBackground });
        }
      } catch (error) {
        logger.warn('Error deleting old business background (post-update)', { error });
      }
    }

    // Update licenses if provided
    if (body.licenses && Array.isArray(body.licenses)) {
      const { data: licenseCategories } = await supabase
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
      // Delete existing licenses
      await supabase
        .from('licenses')
        .delete()
        .eq('business_id', businessId);

      // Insert new licenses (null license_number when empty for non-contractor types)
      const licenseInserts = body.licenses.map((license) => {
        const num = (license.licenseNumber ?? '').trim();
        return {
          business_id: businessId,
          license_number: num || null,
          license_type: license.license,
          license_name: license.trade || null,
          is_active: true,
        };
      });

      const { error: insertError } = await supabase
        .from('licenses')
        .insert(licenseInserts);
      if (insertError) {
        logger.error('Error inserting licenses', { endpoint: '/api/businesses/[id]' }, insertError as Error);
        return NextResponse.json(
          { error: insertError.code === '23505' ? 'A license with this number already exists' : 'Failed to save licenses' },
          { status: 400 }
        );
      }
    }

    // Fetch complete updated business
    const { data: completeBusiness } = await supabase
      .from('businesses')
      .select(`
        *,
        addresses!businesses_business_address_id_fkey (
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
      .eq('id', businessId)
      .single();

    if (!completeBusiness) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      );
    }

    // Map licenses from database format to transform function format
    const licenses = ((completeBusiness.licenses || []) as DbLicenseRow[]).map((l) => ({
      license: l.license_type || 'GENERAL',
      licenseNumber: l.license_number || '',
      trade: l.license_name || '',
    }));

    // Ensure at least one license exists (default to GENERAL if none)
    const licensesForTransform = licenses.length > 0 ? licenses : [{
      license: 'GENERAL',
      licenseNumber: '',
      trade: '',
    }];

    const address = Array.isArray(completeBusiness.addresses)
      ? completeBusiness.addresses[0]
      : completeBusiness.addresses;

    const { data: licenseCategories } = await supabase
      .from('license_categories')
      .select('code, name');
    const licenseCategoriesList = (licenseCategories ?? []).map((r: { code: string; name: string }) => ({
      code: r.code,
      name: r.name,
    }));

    const completeBusinessServices = (completeBusiness as { services?: string[] }).services;
    const completeBusinessImages = (completeBusiness as { images?: string[] }).images;
    const transformed = transformBusinessToProCardData(
      {
        id: completeBusiness.id,
        businessName: completeBusiness.business_name,
        businessLogo: completeBusiness.business_logo || undefined,
        businessBackground: completeBusiness.business_background || undefined,
        slug: completeBusiness.slug || undefined,
        companyDescription: completeBusiness.company_description || undefined,
        licenses: licensesForTransform,
        services: Array.isArray(completeBusinessServices) ? completeBusinessServices : [],
        images: Array.isArray(completeBusinessImages) ? completeBusinessImages : [],
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
      },
      { licenseCategories: licenseCategoriesList }
    );

    return NextResponse.json({ business: transformed });
  } catch (error) {
    logger.error('Error in PUT /api/businesses/[id]', { endpoint: '/api/businesses/[id]' }, error as Error);
    return handleError(error, { endpoint: '/api/businesses/[id]' });
  }
}

/**
 * DELETE /api/businesses/[id]
 * Delete a business (owner only) - soft delete by setting is_active = false
 */
async function handleDeleteBusiness(
  request: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = request.userId;
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const supabase = await createClient();
    const { id } = await params;
    const businessId = id;

    // Verify ownership
    const { data: existingBusiness, error: fetchError } = await supabase
      .from('businesses')
      .select('owner_id')
      .eq('id', businessId)
      .single();

    if (fetchError || !existingBusiness) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      );
    }

    if (existingBusiness.owner_id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized - you can only delete your own business' },
        { status: 403 }
      );
    }

    // Soft delete by setting is_active = false
    const { error: deleteError } = await supabase
      .from('businesses')
      .update({ is_active: false })
      .eq('id', businessId);

    if (deleteError) {
      logger.error('Error deleting business', { endpoint: '/api/businesses/[id]' }, deleteError as Error);
      return NextResponse.json(
        { error: 'Failed to delete business' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/businesses/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return handleGetBusiness(request, context);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // Wrap the handler to pass params through requireAuth
  const wrappedHandler = requireAuth(async (authRequest: AuthenticatedRequest) => {
    const params = await context.params;
    return handleUpdateBusiness(authRequest, { params: Promise.resolve(params) });
  });
  
  return wrappedHandler(request);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // Wrap the handler to pass params through requireAuth
  const wrappedHandler = requireAuth(async (authRequest: AuthenticatedRequest) => {
    const params = await context.params;
    return handleDeleteBusiness(authRequest, { params: Promise.resolve(params) });
  });
  
  return wrappedHandler(request);
}

