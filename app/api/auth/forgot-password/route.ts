import { NextRequest, NextResponse } from 'next/server';
import { isValidEmail } from '@/lib/validation';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';

/**
 * POST /api/auth/forgot-password
 * Request password reset endpoint using Supabase
 * 
 * Sends a password reset email to the user. For security,
 * always returns success even if email doesn't exist.
 */
export async function POST(request: NextRequest) {
  try {
    // Check rate limit for auth endpoints
    const rateLimitResponse = await checkRateLimit(request, 'auth');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = await request.json();
    const { email } = body;

    // Validate input
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
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

    // Normalize email
    const normalizedEmail = email.trim().toLowerCase();

    // Get locale from request headers or default to 'en'
    const locale = request.headers.get('x-locale') || 'en';
    
    // Build redirect URL for password reset
    // Supabase will append the token as a hash fragment
    // Extract origin from request URL
    const requestUrl = new URL(request.url);
    const origin = requestUrl.origin;
    const redirectUrl = `${origin}/${locale}/reset-password`;

    // Request password reset from Supabase
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: redirectUrl,
    });

    // Always return success for security (don't reveal if email exists)
    // Log error server-side for debugging
    if (error) {
      console.error('[Forgot Password API] Error requesting password reset:', error);
      // Still return success to prevent email enumeration
    }

    return NextResponse.json(
      { 
        message: 'If an account exists with this email, you will receive a password reset link shortly.' 
      },
      { status: 200 }
    );
  } catch (error) {
    // Log error server-side (in production, use proper logging service)
    console.error('[Forgot Password API] Unhandled error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

