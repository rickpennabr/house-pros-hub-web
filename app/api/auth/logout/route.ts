import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function expireAuthCookies(response: NextResponse, cookieNames: string[]) {
  for (const name of cookieNames) {
    if (!name.startsWith('sb-') && !name.includes('-auth-token')) continue;
    response.cookies.set(name, '', {
      path: '/',
      maxAge: 0,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
  }
}

/**
 * POST /api/auth/logout
 * Revoke the Supabase session and expire auth cookies on this response.
 * The browser client alone cannot always delete cookies that middleware rewrote.
 */
export async function POST() {
  const cookieStore = await cookies();
  const authCookieNames = cookieStore.getAll().map((cookie) => cookie.name);

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      const response = NextResponse.json(
        { error: error.message || 'Failed to sign out' },
        { status: 500 }
      );
      expireAuthCookies(response, authCookieNames);
      return response;
    }

    const response = NextResponse.json(
      { message: 'Logged out successfully' },
      { status: 200 }
    );
    expireAuthCookies(response, authCookieNames);
    return response;
  } catch (error) {
    // Log error server-side (in production, use proper logging service)
    if (process.env.NODE_ENV === 'development') {
      console.error('Logout error:', error);
    }
    const response = NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
    expireAuthCookies(response, authCookieNames);
    return response;
  }
}
