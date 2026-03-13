import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import type { AuthError } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { ADMIN_EMAIL } from '@/lib/constants/admin';
import { getUserRoles } from '@/lib/utils/roles';
import type { UserRole } from '@/lib/utils/roles';

const AUTH_ME_TIMEOUT_MS = 5000;

/**
 * Return 200 with no user when not authenticated so the client can set user null
 * without triggering a failed request (401) in the console.
 * Optionally clear auth cookies when they are stale/invalid.
 */
async function notAuthenticatedResponse(clearCookies = false): Promise<NextResponse> {
  const res = NextResponse.json(
    { user: null, isAdmin: false, roles: [] },
    { status: 200 }
  );
  if (clearCookies) {
    const cookieStore = await cookies();
    for (const c of cookieStore.getAll()) {
      if (c.name.includes('auth') || c.name.startsWith('sb-')) {
        res.cookies.set(c.name, '', { path: '/', maxAge: 0 });
      }
    }
  }
  return res;
}

/**
 * GET /api/auth/me
 * Get current user endpoint using Supabase
 *
 * Returns the current authenticated user's data.
 * Uses a timeout to avoid hanging on stale/invalid cookies (e.g. after sign-out).
 */
export async function GET() {
  try {
    const supabase = await createClient();

    // Timeout so stale cookies never cause a long hang (e.g. refresh token invalid)
    const getUserPromise = supabase.auth.getUser();
    const timeoutPromise = new Promise<Awaited<ReturnType<typeof supabase.auth.getUser>>>((resolve) =>
      setTimeout(
        () =>
          resolve({
            data: { user: null },
            error: {
              message: 'timeout',
              code: 'timeout',
              status: 408,
              __isAuthError: true,
              name: 'AuthError',
            } as unknown as AuthError,
          }),
        AUTH_ME_TIMEOUT_MS
      )
    );
    const {
      data: { user },
      error: userError,
    } = await Promise.race([getUserPromise, timeoutPromise]);

    if (userError || !user) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[GET /api/auth/me] not authenticated:', userError?.message ?? 'no user');
      }
      // Do not clear cookies here: the reset-password page may be in the process of setting
      // the session from the URL hash; clearing cookies would remove the session before the
      // client has a chance to use it.
      return notAuthenticatedResponse(false);
    }

    // Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      // PGRST116 is "not found" - profile might not exist yet
      console.error('Error fetching profile:', profileError);
    }

    // Fetch business name and logo if business_id exists
    let companyName: string | null = null;
    let businessLogo: string | null = null;
    if (profile?.business_id) {
      const { data: business } = await supabase
        .from('businesses')
        .select('business_name, business_logo')
        .eq('id', profile.business_id)
        .single();
      companyName = business?.business_name || null;
      businessLogo = business?.business_logo ?? null;
    }

    // Return user data
    const userData = {
      id: user.id,
      email: user.email,
      firstName: profile?.first_name || user.user_metadata?.firstName || '',
      lastName: profile?.last_name || user.user_metadata?.lastName || '',
      phone: profile?.phone || user.user_metadata?.phone || null,
      referral: profile?.referral || user.user_metadata?.referral || null,
      referralOther: profile?.referral_other || user.user_metadata?.referralOther || null,
      streetAddress: profile?.street_address || user.user_metadata?.streetAddress || null,
      apartment: profile?.apartment || user.user_metadata?.apartment || null,
      city: profile?.city || user.user_metadata?.city || null,
      state: profile?.state || user.user_metadata?.state || null,
      zipCode: profile?.zip_code || user.user_metadata?.zipCode || null,
      gateCode: profile?.gate_code || user.user_metadata?.gateCode || null,
      addressNote: profile?.address_note || user.user_metadata?.addressNote || null,
      businessId: profile?.business_id || user.user_metadata?.businessId || null,
      businessLogo: businessLogo ?? user.user_metadata?.businessLogo ?? null,
      companyName: companyName || user.user_metadata?.companyName || null,
      companyRole: profile?.company_role || user.user_metadata?.companyRole || null,
      companyRoleOther: profile?.company_role_other || user.user_metadata?.companyRoleOther || null,
      userPicture: profile?.user_picture || user.user_metadata?.userPicture || null,
      preferredLocale: profile?.preferred_locale || user.user_metadata?.preferredLocale || null,
    };

    const isAdmin =
      !!user.email &&
      user.email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();

    const roles: UserRole[] = await getUserRoles(user.id);

    return NextResponse.json(
      { user: userData, isAdmin, roles },
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
