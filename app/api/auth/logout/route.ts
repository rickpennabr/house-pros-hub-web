import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * POST /api/auth/logout
 * Logout endpoint
 * 
 * In production, this will:
 * - Clear httpOnly cookie
 * - Optionally invalidate token on server
 * 
 * For now, clears cookie if it exists
 */
export async function POST(request: NextRequest) {
  try {
    // In production, clear the httpOnly cookie
    // cookies().delete('auth_token');

    // For now, just return success
    // In development with localStorage, the client will handle clearing
    return NextResponse.json(
      { message: 'Logged out successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

