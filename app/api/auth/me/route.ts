import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ADMIN_EMAIL } from '@/lib/constants/admin';
import { getUserRoles } from '@/lib/utils/roles';
import type { UserRole } from '@/lib/utils/roles';

/**
 * GET /api/auth/me
 * Get current user endpoint using Supabase
 * 
 * Returns the current authenticated user's data
 */
export async function GET() {
  try {
    const supabase = await createClient();
    
    // Get current session
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session || !session.user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      // PGRST116 is "not found" - profile might not exist yet
      console.error('Error fetching profile:', profileError);
    }

    // Fetch business name if business_id exists
    let companyName: string | null = null;
    if (profile?.business_id) {
      const { data: business } = await supabase
        .from('businesses')
        .select('business_name')
        .eq('id', profile.business_id)
        .single();
      companyName = business?.business_name || null;
    }

    // Return user data
    const user = {
      id: session.user.id,
      email: session.user.email,
      firstName: profile?.first_name || session.user.user_metadata?.firstName || '',
      lastName: profile?.last_name || session.user.user_metadata?.lastName || '',
      phone: profile?.phone || session.user.user_metadata?.phone || null,
      referral: profile?.referral || session.user.user_metadata?.referral || null,
      referralOther: profile?.referral_other || session.user.user_metadata?.referralOther || null,
      streetAddress: profile?.street_address || session.user.user_metadata?.streetAddress || null,
      apartment: profile?.apartment || session.user.user_metadata?.apartment || null,
      city: profile?.city || session.user.user_metadata?.city || null,
      state: profile?.state || session.user.user_metadata?.state || null,
      zipCode: profile?.zip_code || session.user.user_metadata?.zipCode || null,
      gateCode: profile?.gate_code || session.user.user_metadata?.gateCode || null,
      addressNote: profile?.address_note || session.user.user_metadata?.addressNote || null,
      businessId: profile?.business_id || session.user.user_metadata?.businessId || null,
      companyName: companyName || session.user.user_metadata?.companyName || null,
      companyRole: profile?.company_role || session.user.user_metadata?.companyRole || null,
      companyRoleOther: profile?.company_role_other || session.user.user_metadata?.companyRoleOther || null,
      userPicture: profile?.user_picture || session.user.user_metadata?.userPicture || null,
      preferredLocale: profile?.preferred_locale || session.user.user_metadata?.preferredLocale || null,
    };

    const isAdmin =
      !!session.user.email &&
      session.user.email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();

    const roles: UserRole[] = await getUserRoles(session.user.id);

    return NextResponse.json(
      { user, isAdmin, roles },
      { status: 200 }
    );
  } catch (error) {
    // Log error server-side (in production, use proper logging service)
    if (process.env.NODE_ENV === 'development') {
      console.error('Get user error:', error);
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
