import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/auth/logout
 * Logout endpoint using Supabase
 * 
 * Signs out the user and clears the session
 */
export async function POST() {
  try {
    const supabase = await createClient();
    
    const { error } = await supabase.auth.signOut();

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Failed to sign out' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: 'Logged out successfully' },
      { status: 200 }
    );
  } catch (error) {
    // Log error server-side (in production, use proper logging service)
    if (process.env.NODE_ENV === 'development') {
      console.error('Logout error:', error);
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
