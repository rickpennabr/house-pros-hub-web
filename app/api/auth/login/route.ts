import { NextRequest, NextResponse } from 'next/server';
import { isValidEmail, isValidPassword } from '@/lib/validation';

/**
 * POST /api/auth/login
 * Login endpoint
 * 
 * In production, this will:
 * - Validate email/password against database
 * - Generate JWT token
 * - Set httpOnly cookie with token
 * - Return user data
 * 
 * For now, returns mock response
 */
export async function POST(request: NextRequest) {
  try {
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
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Mock response (replace with actual authentication in production)
    // In production:
    // 1. Query database for user by email
    // 2. Verify password hash (bcrypt)
    // 3. Generate JWT token
    // 4. Set httpOnly cookie:
    //    cookies().set('auth_token', token, {
    //      httpOnly: true,
    //      secure: process.env.NODE_ENV === 'production',
    //      sameSite: 'lax',
    //      maxAge: 60 * 60 * 24 * 7 // 7 days
    //    });
    // 5. Return user data (without password)

    const mockUser = {
      id: 'user_123',
      email,
      firstName: 'Test',
      lastName: 'User',
    };

    return NextResponse.json(
      { user: mockUser },
      { status: 200 }
    );
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

