import { NextResponse } from 'next/server';
import { isValidEmail, isNotEmpty } from '@/lib/validation';
import { transformBusinessToProCardData, generateSlug } from '@/lib/utils/businessTransform';
import { requireAuth, AuthenticatedRequest } from '@/lib/middleware/auth';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { normalizeLinks } from '@/lib/utils/normalizeLinks';
import { sanitizeText, sanitizeUrl } from '@/lib/utils/sanitize';
import { handleError } from '@/lib/utils/errorHandler';
import { logger } from '@/lib/utils/logger';
import { hasRole } from '@/lib/utils/roles';
import { sendNewSignupAdminNotification } from '@/lib/services/emailService';

/**
 * Convert base64 string to Buffer for server-side file handling
 */
function base64ToBuffer(base64String: string): Buffer {
  const base64Data = base64String.includes(',') 
    ? base64String.split(',')[1] 
    : base64String;
  return Buffer.from(base64Data, 'base64');
}

/**
 * Upload base64 image to Supabase Storage
 */
async function uploadBase64Image(
  supabase: ReturnType<typeof createServiceRoleClient>,
  bucket: string,
  filePath: string,
  base64String: string,
  contentType: string = 'image/jpeg'
): Promise<string | null> {
  try {
    const buffer = base64ToBuffer(base64String);
    // Supabase storage accepts Buffer directly (it extends Uint8Array)

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, buffer, {
        cacheControl: '3600',
        upsert: false,
        contentType: contentType,
      });

    if (error) {
      logger.error(`Error uploading to ${bucket}`, { endpoint: '/api/business/create', bucket, filePath }, error as Error);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return publicUrl;
  } catch (error) {
    logger.error(`Error in uploadBase64Image to ${bucket}`, { endpoint: '/api/business/create', bucket, filePath }, error as Error);
    return null;
  }
}

/**
 * POST /api/business/create
 * Business creation endpoint
 * 
 * Creates a business in Supabase with:
 * - Business record in businesses table
 * - Business address in addresses table
 * - Licenses in licenses table
 * - Returns business data in ProCardData format
 */
async function handleCreateBusiness(request: AuthenticatedRequest) {
  try {
    // Use cached body from middleware to avoid re-reading
    const body = request._body || await request.json();
    const {
      businessName,
      businessLogo,
      businessBackground,
      slug,
      companyDescription,
      licenses,
      address,
      streetAddress,
      city,
      state,
      zipCode,
      apartment,
      email,
      phone,
      mobilePhone,
      links,
      operatingHours,
    } = body;

    // Validate required fields
    if (!businessName || !isNotEmpty(businessName)) {
      return NextResponse.json(
        { error: 'Business name is required' },
        { status: 400 }
      );
    }

    // Validate licenses
    if (!licenses || !Array.isArray(licenses) || licenses.length === 0) {
      return NextResponse.json(
        { error: 'At least one license is required' },
        { status: 400 }
      );
    }

    for (let i = 0; i < licenses.length; i++) {
      const license = licenses[i];
      if (!license.license || !license.licenseNumber) {
        return NextResponse.json(
          { error: `License ${i + 1} must have both classification and number` },
          { status: 400 }
        );
      }
    }

    // Validate address
    if (!streetAddress && !address) {
      return NextResponse.json(
        { error: 'Street address is required' },
        { status: 400 }
      );
    }

    if (!city || !state || !zipCode) {
      return NextResponse.json(
        { error: 'City, state, and ZIP code are required' },
        { status: 400 }
      );
    }

    // Validate email format if provided
    if (email && !isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate phone if provided
    if (phone) {
      const phoneDigits = phone.replace(/\D/g, '');
      if (phoneDigits.length < 10) {
        return NextResponse.json(
          { error: 'Phone number must be at least 10 digits' },
          { status: 400 }
        );
      }
    }

    // Validate link URLs if provided
    if (links && Array.isArray(links)) {
      for (const link of links) {
        if (link.url && link.url.trim()) {
          // Skip validation for phone, email, and location links (they use special protocols)
          if (link.type === 'phone' || link.type === 'email' || link.type === 'location') {
            continue;
          }
          
          try {
            let urlToValidate = link.url.trim();
            
            // Normalize URLs: add https:// if missing and it looks like a domain
            if (!urlToValidate.startsWith('http://') && 
                !urlToValidate.startsWith('https://') && 
                !urlToValidate.startsWith('tel:') &&
                !urlToValidate.startsWith('mailto:')) {
              // If it contains a dot and doesn't start with @, assume it's a domain
              if (urlToValidate.includes('.') && !urlToValidate.startsWith('@')) {
                urlToValidate = `https://${urlToValidate}`;
              } else {
                // For social media handles or invalid formats, let it pass
                // The link processor will handle it
                continue;
              }
            }
            
            // Validate the URL format
            new URL(urlToValidate);
          } catch {
            // If URL validation fails, don't block - let the link processor handle it
            // This allows for flexible input formats
            continue;
          }
        }
      }
    }

    // Get userId from authenticated request (set by middleware)
    const userId = request.userId;
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Sanitize user-editable strings before persist (defense-in-depth)
    const safeBusinessName = sanitizeText(businessName) || businessName.trim();
    const safeCompanyDescription = companyDescription ? sanitizeText(companyDescription) || null : null;
    const safeStreetAddress = sanitizeText(streetAddress || address || '') || (streetAddress || address);
    const safeApartment = apartment ? sanitizeText(apartment) || null : null;
    const safeCity = sanitizeText(city) || city;
    const safeState = sanitizeText(state) || state;
    const safeZipCode = sanitizeText(zipCode) || zipCode;
    const safeEmail = email ? (sanitizeText(email) || email.trim().toLowerCase()) : null;
    const safePhone = phone ? (sanitizeText(phone) || null) : null;
    const safeMobilePhone = mobilePhone ? (sanitizeText(mobilePhone) || null) : null;
    const safeLicenses = licenses.map((lic: { license?: string; licenseNumber?: string; trade?: string }) => ({
      license: lic.license ? sanitizeText(lic.license) || lic.license : lic.license,
      licenseNumber: lic.licenseNumber ? sanitizeText(lic.licenseNumber) || lic.licenseNumber : lic.licenseNumber,
      trade: lic.trade ? sanitizeText(lic.trade) || lic.trade : lic.trade,
    }));
    const safeLinks = links && Array.isArray(links)
      ? links.map((link: { type?: string; url?: string; value?: string }) => {
          const url = link.url?.trim();
          const value = link.value != null ? sanitizeText(String(link.value)) : undefined;
          if (link.type === 'phone' || link.type === 'email' || link.type === 'location') {
            return { ...link, value: value ?? link.value };
          }
          const safeUrl = url ? (sanitizeUrl(url) || url) : undefined;
          return { ...link, url: safeUrl ?? link.url, value: value ?? link.value };
        })
      : null;

    const supabase = await createClient();
    const serviceRoleClient = createServiceRoleClient();

    // Automatically grant contractor role if user doesn't have it
    // Creating a business implies the user is a contractor
    const userHasContractorRole = await hasRole(userId, 'contractor');
    if (!userHasContractorRole) {
      logger.info('Auto-granting contractor role to user creating business', { userId });
      // Use service role client to bypass RLS restrictions
      try {
        const { error: roleError } = await serviceRoleClient
          .from('user_roles')
          .upsert({
            user_id: userId,
            role: 'contractor',
            is_active: true,
            activated_at: new Date().toISOString(),
            deactivated_at: null,
          }, { onConflict: 'user_id,role' });

        if (roleError) {
          logger.warn('Failed to auto-grant contractor role, but continuing with business creation', { userId, error: roleError });
          // Continue anyway - the business creation should still work
        } else {
          logger.info('Successfully auto-granted contractor role', { userId });
        }
      } catch (error) {
        logger.warn('Error auto-granting contractor role, but continuing with business creation', { userId, error });
        // Continue anyway - the business creation should still work
      }
    }

    // Generate slug if not provided
    let businessSlug = slug ? sanitizeText(slug) || generateSlug(safeBusinessName) : generateSlug(safeBusinessName);

    // Check if slug already exists and make it unique
    let counter = 1;
    let uniqueSlug = businessSlug;
    while (true) {
      const { data: existingBusiness } = await supabase
        .from('businesses')
        .select('id')
        .eq('slug', uniqueSlug)
        .single();

      if (!existingBusiness) {
        businessSlug = uniqueSlug;
        break;
      }
      
      uniqueSlug = `${businessSlug}-${counter}`;
      counter++;
      
      // Safety check to prevent infinite loop
      if (counter > 1000) {
        // Fallback to timestamp-based slug
        businessSlug = `${businessSlug}-${Date.now()}`;
        break;
      }
    }

    // Create business address
    const { data: addressData, error: addressError } = await supabase
      .from('addresses')
      .insert({
        user_id: userId,
        address_type: 'business',
        street_address: safeStreetAddress,
        apartment: safeApartment,
        city: safeCity,
        state: safeState,
        zip_code: safeZipCode,
        is_public: true, // Business addresses are public
      })
      .select()
      .single();

    if (addressError) {
      logger.error('Error creating business address', { endpoint: '/api/business/create' }, addressError as Error);
      return NextResponse.json(
        { error: 'Failed to create business address' },
        { status: 500 }
      );
    }

    // Create business record first (without images, we'll update after upload)
    const { data: businessData, error: businessError } = await supabase
      .from('businesses')
      .insert({
        owner_id: userId,
        business_name: safeBusinessName,
        slug: businessSlug,
        business_logo: null, // Will be updated after upload
        business_background: null, // Will be updated after upload
        company_description: safeCompanyDescription,
        email: safeEmail,
        phone: safePhone,
        mobile_phone: safeMobilePhone,
        business_address_id: addressData.id,
        links: safeLinks,
        operating_hours: operatingHours || null,
        is_active: true,
      })
      .select()
      .single();

    if (businessError) {
      logger.error('Error creating business', { endpoint: '/api/business/create' }, businessError as Error);
      // Clean up address if business creation fails
      await supabase.from('addresses').delete().eq('id', addressData.id);
      return NextResponse.json(
        { error: 'Failed to create business' },
        { status: 500 }
      );
    }

    // Upload images to storage if provided
    let logoUrl: string | null = null;
    let backgroundUrl: string | null = null;

    if (businessLogo && typeof businessLogo === 'string' && businessLogo.startsWith('data:image')) {
      const fileExt = businessLogo.includes('image/png') ? 'png' : 'jpg';
      // Path should be relative to bucket root (bucket is specified in uploadBase64Image)
      // Format: businessId/logo-timestamp.ext (same pattern as profile pictures: userId/timestamp.ext)
      const filePath = `${businessData.id}/logo-${Date.now()}.${fileExt}`;
      logoUrl = await uploadBase64Image(
        serviceRoleClient,
        'business-logos',
        filePath,
        businessLogo,
        businessLogo.includes('image/png') ? 'image/png' : 'image/jpeg'
      );
    }

    if (businessBackground && typeof businessBackground === 'string' && businessBackground.startsWith('data:image')) {
      const fileExt = businessBackground.includes('image/png') ? 'png' : 'jpg';
      // Sanitize company name for filename
      const sanitizedName = businessData.business_name
        .replace(/[^a-zA-Z0-9]/g, '') // Remove special characters
        .replace(/\s+/g, '') // Remove spaces
        .substring(0, 50); // Limit length
      const fileName = sanitizedName ? `Background-${sanitizedName}.${fileExt}` : `Background-${Date.now()}.${fileExt}`;
      const filePath = `${businessData.id}/${fileName}`;
      backgroundUrl = await uploadBase64Image(
        serviceRoleClient,
        'business-backgrounds',
        filePath,
        businessBackground,
        businessBackground.includes('image/png') ? 'image/png' : 'image/jpeg'
      );
    }

    // Update business with image URLs if uploaded
    if (logoUrl || backgroundUrl) {
      const updateData: Record<string, string> = {};
      if (logoUrl) updateData.business_logo = logoUrl;
      if (backgroundUrl) updateData.business_background = backgroundUrl;

      await supabase
        .from('businesses')
        .update(updateData)
        .eq('id', businessData.id);
    }

    // Create licenses
    const licenseInserts = safeLicenses.map((license: { license: string; licenseNumber: string; trade?: string }) => ({
      business_id: businessData.id,
      license_number: license.licenseNumber,
      license_type: license.license,
      license_name: license.trade || null,
      is_active: true,
    }));

    const { error: licensesError } = await supabase
      .from('licenses')
      .insert(licenseInserts);

    if (licensesError) {
      logger.error('Error creating licenses', { endpoint: '/api/business/create' }, licensesError as Error);
      // Don't fail - licenses can be added later
      // But log the error for debugging
    }

    // Fetch complete business data with relationships
    const { data: completeBusiness, error: fetchError } = await supabase
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
      .eq('id', businessData.id)
      .single();

    if (fetchError) {
      logger.error('Error fetching complete business', { endpoint: '/api/business/create' }, fetchError as Error);
      // Return what we have
    }

    // Link this business to the user's profile (set as primary business)
    // Only update if profile doesn't already have a business_id
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('business_id')
      .eq('id', userId)
      .single();

    if (!currentProfile?.business_id) {
      const { error: linkError } = await supabase
        .from('profiles')
        .update({ business_id: businessData.id })
        .eq('id', userId);

      if (linkError) {
        logger.warn('Failed to link business to profile', { 
          endpoint: '/api/business/create',
          userId,
          businessId: businessData.id,
          error: linkError 
        });
        // Don't fail - business was created successfully, link can be updated later
      }
    }

    // Transform to ProCardData format for response
    // Use uploaded URLs if available, otherwise use completeBusiness data, otherwise use businessData
    const finalLogoUrl = logoUrl || completeBusiness?.business_logo || businessData.business_logo;
    const finalBackgroundUrl = backgroundUrl || completeBusiness?.business_background || businessData.business_background;
    
    // Notify admin that a new business was added (non-blocking)
    try {
      const adminNotifyResult = await sendNewSignupAdminNotification({
        type: 'business',
        name: businessData.business_name ?? 'Business',
        email: businessData.email ?? '',
      });
      if (!adminNotifyResult.success) {
        logger.warn('Failed to send admin new-business notification', {
          endpoint: '/api/business/create',
          businessId: businessData.id,
          error: adminNotifyResult.error,
        });
      }
    } catch (adminNotifyErr) {
      logger.error('Error sending admin new-business notification', {
        endpoint: '/api/business/create',
        businessId: businessData.id,
      }, adminNotifyErr as Error);
    }

    // Log signup event for admin notifications (persists even if business is later deleted)
    await serviceRoleClient.from('admin_notification_events').insert({
      event_type: 'signup',
      entity_type: 'contractor',
      entity_id: businessData.id,
      display_name: businessData.business_name ?? 'Business',
    }).then(({ error: evErr }) => {
      if (evErr) logger.warn('Failed to log admin notification event', { endpoint: '/api/business/create', error: evErr.message });
    });

    const businessForCard = transformBusinessToProCardData({
      id: businessData.id,
      businessName: businessData.business_name,
      businessLogo: finalLogoUrl || undefined,
      businessBackground: finalBackgroundUrl || undefined,
      slug: businessData.slug || undefined,
      companyDescription: businessData.company_description || undefined,
      licenses:
        completeBusiness?.licenses?.map(
          (l: { license_type: string | null; license_number: string | null; license_name: string | null }) => ({
            license: l.license_type || 'GENERAL',
            licenseNumber: l.license_number || '',
            trade: l.license_name || '',
          })
        ) || licenses,
      address: completeBusiness?.addresses?.street_address || streetAddress || address,
      streetAddress: completeBusiness?.addresses?.street_address || streetAddress,
      city: completeBusiness?.addresses?.city || city,
      state: completeBusiness?.addresses?.state || state,
      zipCode: completeBusiness?.addresses?.zip_code || zipCode,
      apartment: completeBusiness?.addresses?.apartment || apartment,
      email: businessData.email || undefined,
      phone: businessData.phone || undefined,
      mobilePhone: businessData.mobile_phone || undefined,
      links: normalizeLinks(businessData.links ?? links),
      userId,
    });

    return NextResponse.json(
      { business: businessForCard },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Error in POST /api/business/create', { endpoint: '/api/business/create' }, error as Error);
    return handleError(error, { endpoint: '/api/business/create' });
  }
}

// Export with authentication (role is auto-granted inside handler)
export const POST = requireAuth(handleCreateBusiness);
