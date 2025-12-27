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
    // Check rate limit for auth endpoints
    const rateLimitResponse = await checkRateLimit(request, 'auth');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = await request.json();
    const { password } = body;

    // Validate input
    if (!password) {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      );
    }

    // Validate password strength
    if (!isValidPassword(password)) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters and contain uppercase, lowercase, and number' },
        { status: 400 }
      );
    }

    // Create Supabase client
    const supabase = await createClient();

    // Check if user has a valid session (created by Supabase when clicking reset link)
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session || !session.user) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token. Please request a new password reset.' },
        { status: 401 }
      );
    }

    // Update password - user is already authenticated via the reset token
    const { data: updateData, error: updateError } = await supabase.auth.updateUser({
      password: password,
    });

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

    // Get the updated session
    const { data: { session: updatedSession }, error: updatedSessionError } = await supabase.auth.getSession();

    if (updatedSessionError || !updatedSession) {
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
    const user = {
      id: updateData.user.id,
      email: updateData.user.email,
      firstName: profile?.first_name || updateData.user.user_metadata?.firstName || '',
      lastName: profile?.last_name || updateData.user.user_metadata?.lastName || '',
    };

    return NextResponse.json(
      { 
        user,
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

