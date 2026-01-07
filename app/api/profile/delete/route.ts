import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { requireAuth, AuthenticatedRequest } from '@/lib/middleware/auth';
import { handleError } from '@/lib/utils/errorHandler';
import { logger } from '@/lib/utils/logger';

/**
 * DELETE /api/profile/delete
 * Delete user account and all associated data
 * 
 * This endpoint performs a soft delete by:
 * 1. Deactivating all user roles
 * 2. Soft deleting all businesses (is_active = false)
 * 3. Anonymizing profile data (subject to legal retention requirements)
 * 4. Deleting the auth user (cascades to related data via foreign keys)
 * 
 * Note: Some data may be retained for legal/compliance purposes as stated in Privacy Policy
 */
async function handleDeleteAccount(request: AuthenticatedRequest) {
  try {
    const userId = request.userId;
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const supabase = await createClient();
    const serviceRoleClient = createServiceRoleClient();

    // Verify user exists
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // 1. Deactivate all user roles
    const { error: rolesError } = await serviceRoleClient
      .from('user_roles')
      .update({
        is_active: false,
        deactivated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (rolesError) {
      logger.error('Error deactivating user roles', { endpoint: '/api/profile/delete', userId }, rolesError as Error);
      // Continue with deletion even if role deactivation fails
    }

    // 2. Soft delete all businesses owned by user
    const { error: businessesError } = await serviceRoleClient
      .from('businesses')
      .update({ is_active: false })
      .eq('owner_id', userId);

    if (businessesError) {
      logger.error('Error soft deleting businesses', { endpoint: '/api/profile/delete', userId }, businessesError as Error);
      // Continue with deletion even if business deletion fails
    }

    // 3. Anonymize profile data (keep record for legal compliance but remove PII)
    // Note: We keep the profile record but remove identifying information
    // This complies with "subject to our legal obligations to retain certain data"
    const { error: profileError } = await serviceRoleClient
      .from('profiles')
      .update({
        first_name: '[Deleted]',
        last_name: '[Deleted]',
        phone: null,
        street_address: null,
        apartment: null,
        city: null,
        state: null,
        zip_code: null,
        gate_code: null,
        address_note: null,
        business_id: null,
        company_role: null,
        company_role_other: null,
        user_picture: null,
        referral: null,
        referral_other: null,
      })
      .eq('id', userId);

    if (profileError) {
      logger.error('Error anonymizing profile', { endpoint: '/api/profile/delete', userId }, profileError as Error);
      // Continue with auth deletion even if profile anonymization fails
    }

    // 4. Delete the auth user (this will cascade delete related data via foreign keys)
    // Note: Supabase handles cascading deletes for profiles, user_roles, etc.
    const { error: deleteError } = await serviceRoleClient.auth.admin.deleteUser(userId);

    if (deleteError) {
      logger.error('Error deleting auth user', { endpoint: '/api/profile/delete', userId }, deleteError as Error);
      return NextResponse.json(
        { error: 'Failed to delete account. Please contact support.' },
        { status: 500 }
      );
    }

    logger.info('User account deleted successfully', { endpoint: '/api/profile/delete', userId });

    return NextResponse.json({
      message: 'Account deleted successfully',
    });
  } catch (error) {
    logger.error('Error in DELETE /api/profile/delete', { endpoint: '/api/profile/delete' }, error as Error);
    return handleError(error, { endpoint: '/api/profile/delete' });
  }
}

export async function DELETE(request: NextRequest) {
  return requireAuth(handleDeleteAccount)(request);
}

