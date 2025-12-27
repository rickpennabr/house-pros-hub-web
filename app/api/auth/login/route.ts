import { NextRequest, NextResponse } from 'next/server';
import { isValidEmail, isValidPassword } from '@/lib/validation';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';

/**
 * POST /api/auth/login
 * Login endpoint using Supabase
 * 
 * Note: With Supabase, authentication is primarily handled client-side.
 * This endpoint can be used for server-side login if needed, but typically
 * the client will call supabase.auth.signInWithPassword() directly.
 */
export async function POST(request: NextRequest) {
  try {
    // Check rate limit for auth endpoints
    const rateLimitResponse = await checkRateLimit(request, 'auth');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = await request.json();
    const { email, password } = body;

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate password
    if (!isValidPassword(password)) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters and contain uppercase, lowercase, and number' },
        { status: 400 }
      );
    }

    // Sign in with Supabase
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Invalid email or password' },
        { status: 401 }
      );
    }

    if (!data.session || !data.user) {
      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: 500 }
      );
    }

    // Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      // PGRST116 is "not found" - profile might not exist yet, which is acceptable
      // Log other errors for debugging
      console.error('Error fetching profile:', profileError);
    }

    // Return user data (without sensitive information)
    const user = {
      id: data.user.id,
      email: data.user.email,
      firstName: profile?.first_name || data.user.user_metadata?.firstName || '',
      lastName: profile?.last_name || data.user.user_metadata?.lastName || '',
    };

    return NextResponse.json(
      { user },
      { status: 200 }
    );
  } catch (error) {
    // Log error server-side (in production, use proper logging service)
    if (process.env.NODE_ENV === 'development') {
      console.error('Login error:', error);
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
