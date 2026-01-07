import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { requireAuth, AuthenticatedRequest } from '@/lib/middleware/auth';
import { profileUpdateSchema } from '@/lib/schemas/profile';
import { handleError } from '@/lib/utils/errorHandler';
import { logger } from '@/lib/utils/logger';
import { deleteProfilePicture } from '@/lib/utils/storage';
import { sanitizeText } from '@/lib/utils/sanitize';

/**
 * PUT /api/profile
 * Update user profile
 * 
 * Updates user profile information including:
 * - Basic info (firstName, lastName, email)
 * - Contact info (phone)
 * - Address information
 * - Company information
 * - Profile picture
 */
async function handleUpdateProfile(request: AuthenticatedRequest) {
  try {
    const userId = request.userId;
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = request._body || await request.json();
    const validationResult = profileUpdateSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const updates = validationResult.data;
    const supabase = await createClient();
    const serviceRoleClient = createServiceRoleClient();

    // Get current profile to check for old profile picture
    const { data: currentProfile, error: fetchError } = await serviceRoleClient
      .from('profiles')
      .select('user_picture')
      .eq('id', userId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      logger.error('Error fetching current profile', { endpoint: '/api/profile' }, fetchError as Error);
    }

    // Handle email update (requires auth.updateUser)
    if (updates.email) {
      const { error: emailError } = await supabase.auth.updateUser({
        email: updates.email.trim().toLowerCase(),
        data: {
          firstName: updates.firstName || undefined,
          lastName: updates.lastName || undefined,
          email: updates.email.trim().toLowerCase(),
        },
      });

      if (emailError) {
        return NextResponse.json(
          { error: emailError.message || 'Failed to update email' },
          { status: 400 }
        );
      }
    } else if (updates.firstName || updates.lastName) {
      // Update metadata without changing email
      const { error: metadataError } = await supabase.auth.updateUser({
        data: {
          firstName: updates.firstName || undefined,
          lastName: updates.lastName || undefined,
        },
      });

      if (metadataError) {
        logger.warn('Error updating user metadata', { error: metadataError });
        // Don't fail - metadata update is not critical
      }
    }

    // Capture previous image URL for safe swap flow (delete after DB update succeeds)
    const oldUserPicture = currentProfile?.user_picture || null;

    // Build profile update object
    const profileUpdate: Record<string, unknown> = {};

    if (updates.firstName !== undefined) {
      profileUpdate.first_name = updates.firstName;
    }
    if (updates.lastName !== undefined) {
      profileUpdate.last_name = updates.lastName;
    }
    if (updates.phone !== undefined) {
      profileUpdate.phone = updates.phone || null;
    }
    if (updates.referral !== undefined) {
      profileUpdate.referral = updates.referral || null;
    }
    if (updates.referralOther !== undefined) {
      profileUpdate.referral_other = updates.referralOther || null;
    }
    if (updates.streetAddress !== undefined) {
      profileUpdate.street_address = updates.streetAddress || null;
    }
    if (updates.apartment !== undefined) {
      profileUpdate.apartment = updates.apartment || null;
    }
    if (updates.city !== undefined) {
      profileUpdate.city = updates.city || null;
    }
    if (updates.state !== undefined) {
      profileUpdate.state = updates.state || null;
    }
    if (updates.zipCode !== undefined) {
      profileUpdate.zip_code = updates.zipCode || null;
    }
    if (updates.gateCode !== undefined) {
      profileUpdate.gate_code = updates.gateCode || null;
    }
    if (updates.addressNote !== undefined) {
      profileUpdate.address_note = updates.addressNote || null;
    }
    if (updates.businessId !== undefined) {
      profileUpdate.business_id = updates.businessId || null;
    }
    if (updates.companyRole !== undefined) {
      profileUpdate.company_role = updates.companyRole || null;
    }
    if (updates.companyRoleOther !== undefined) {
      profileUpdate.company_role_other = updates.companyRoleOther ? sanitizeText(updates.companyRoleOther) || null : null;
    }
    if (updates.userPicture !== undefined) {
      profileUpdate.user_picture = updates.userPicture || null;
    }
    if (updates.preferredLocale !== undefined) {
      profileUpdate.preferred_locale = updates.preferredLocale || null;
    }

    // Update profile in database using service role client to bypass RLS
    const { data: updatedProfile, error: profileError } = await serviceRoleClient
      .from('profiles')
      .update(profileUpdate)
      .eq('id', userId)
      .select()
      .single();

    if (profileError) {
      logger.error('Error updating profile', { endpoint: '/api/profile' }, profileError as Error);
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      );
    }

    // Fetch business name if business_id exists
    let companyName: string | null = null;
    if (updatedProfile.business_id) {
      const { data: business } = await serviceRoleClient
        .from('businesses')
        .select('business_name')
        .eq('id', updatedProfile.business_id)
        .single();
      companyName = business?.business_name || null;
    }

    // Return updated profile data immediately
    const response = NextResponse.json({
      profile: {
        id: updatedProfile.id,
        firstName: updatedProfile.first_name,
        lastName: updatedProfile.last_name,
        email: updates.email || request.user?.email,
        phone: updatedProfile.phone,
        referral: updatedProfile.referral,
        referralOther: updatedProfile.referral_other,
        streetAddress: updatedProfile.street_address,
        apartment: updatedProfile.apartment,
        city: updatedProfile.city,
        state: updatedProfile.state,
        zipCode: updatedProfile.zip_code,
        gateCode: updatedProfile.gate_code,
        addressNote: updatedProfile.address_note,
        businessId: updatedProfile.business_id,
        companyName: companyName,
        companyRole: updatedProfile.company_role,
        companyRoleOther: updatedProfile.company_role_other,
        userPicture: updatedProfile.user_picture,
        preferredLocale: updatedProfile.preferred_locale,
      },
    });

    // Delete old profile picture in the background (non-blocking)
    // This prevents the API response from being delayed by the deletion
    if (updates.userPicture && oldUserPicture && updates.userPicture !== oldUserPicture) {
      // Don't await - let it run in the background
      deleteProfilePicture(oldUserPicture)
        .then((deleted) => {
          if (!deleted) {
            logger.warn('Failed to delete old profile picture (post-update)', { url: oldUserPicture });
          }
        })
        .catch((error) => {
          logger.warn('Error deleting old profile picture (post-update)', { error });
        });
    }

    return response;
  } catch (error) {
    logger.error('Error in PUT /api/profile', { endpoint: '/api/profile' }, error as Error);
    return handleError(error, { endpoint: '/api/profile' });
  }
}

export async function PUT(request: NextRequest) {
  return requireAuth(handleUpdateProfile)(request);
}

