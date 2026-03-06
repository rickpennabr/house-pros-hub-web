import { NextRequest, NextResponse } from 'next/server';
import { isValidPassword } from '@/lib/validation';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';

/**
 * POST /api/auth/reset-password
 * Reset password endpoint using Supabase
 * 
 * Resets the user's password. The user must be authenticated via the reset token
 * (Supabase automatically creates a session when the user clicks the reset link).
 * After successful reset, the user remains signed in.
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[Reset Password API] POST received');
    // Check rate limit for auth endpoints
    const rateLimitResponse = await checkRateLimit(request, 'auth');
    if (rateLimitResponse) {
      console.log('[Reset Password API] rate limited');
      return rateLimitResponse;
    }

    const body = await request.json();
    const { password } = body;

    // Validate input
    if (!password) {
      console.log('[Reset Password API] missing password');
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      );
    }

    // Validate password strength
    if (!isValidPassword(password)) {
      console.log('[Reset Password API] invalid password strength');
      return NextResponse.json(
        { error: 'Password must be at least 8 characters and contain uppercase, lowercase, and number' },
        { status: 400 }
      );
    }

    // Create Supabase client
    const supabase = await createClient();

    // Verify user (validates with Supabase Auth server; do not use getSession() for auth)
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    console.log('[Reset Password API] getUser', { userId: user?.id ?? null, userError: userError?.message ?? null });

    if (userError || !user) {
      console.log('[Reset Password API] unauthorized (no user or error)');
      return NextResponse.json(
        { error: 'Invalid or expired reset token. Please request a new password reset.' },
        { status: 401 }
      );
    }

    // Update password - user is already authenticated via the reset token
    const { data: updateData, error: updateError } = await supabase.auth.updateUser({
      password: password,
    });
    console.log('[Reset Password API] updateUser', { success: !updateError, error: updateError?.message ?? null });

    if (updateError) {
      // Check if it's a token-related error
      if (updateError.message.includes('token') || 
          updateError.message.includes('expired') ||
          updateError.message.includes('invalid') ||
          updateError.message.includes('session')) {
        return NextResponse.json(
          { error: 'Invalid or expired reset token. Please request a new password reset.' },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: updateError.message || 'Failed to reset password' },
        { status: 400 }
      );
    }

    if (!updateData.user) {
      return NextResponse.json(
        { error: 'Failed to reset password' },
        { status: 500 }
      );
    }

    // Verify session is still valid after password update
    const { data: { user: refreshedUser }, error: refreshedError } = await supabase.auth.getUser();

    if (refreshedError || !refreshedUser) {
      return NextResponse.json(
        { error: 'Password was reset but session could not be refreshed. Please sign in manually.' },
        { status: 500 }
      );
    }

    // Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', updateData.user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Error fetching profile:', profileError);
    }

    // Return user data
    const userData = {
      id: updateData.user.id,
      email: updateData.user.email,
      firstName: profile?.first_name || updateData.user.user_metadata?.firstName || '',
      lastName: profile?.last_name || updateData.user.user_metadata?.lastName || '',
    };

    console.log('[Reset Password API] success', { userId: userData.id });
    return NextResponse.json(
      { 
        user: userData,
        message: 'Password reset successfully. You have been signed in.' 
      },
      { status: 200 }
    );
  } catch (error) {
    // Log error server-side (in production, use proper logging service)
    console.error('[Reset Password API] Unhandled error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

