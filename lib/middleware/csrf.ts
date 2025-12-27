import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

/**
 * CSRF token expiration time (1 hour)
 */
const CSRF_TOKEN_EXPIRY = 60 * 60 * 1000; // 1 hour in milliseconds

/**
 * Generate a secure random CSRF token
 */
function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Clean up expired tokens from database
 * This is called periodically and on token operations
 */
async function cleanupExpiredTokens(supabase: Awaited<ReturnType<typeof createClient>>): Promise<void> {
  try {
    const now = new Date().toISOString();
    // @ts-ignore - csrf_tokens table exists but not in types yet (run migration first)
    const { error } = await (supabase as any)
      .from('csrf_tokens')
      .delete()
      .lt('expires_at', now);

    if (error) {
      console.error('[CSRF] Error cleaning up expired tokens:', error);
    }
  } catch (error) {
    console.error('[CSRF] Exception during token cleanup:', error);
  }
}

/**
 * Get CSRF token for a user session
 * Uses Supabase database for persistent storage across hot reloads
 * 
 * @param userId - User ID
 * @returns CSRF token
 */
export async function getCsrfToken(userId: string): Promise<string> {
  const supabase = await createClient();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CSRF_TOKEN_EXPIRY);

  console.log('[CSRF] getCsrfToken called:', {
    userId,
    expiresAt: expiresAt.toISOString(),
  });

  try {
    // Clean up expired tokens first
    await cleanupExpiredTokens(supabase);

    // Check for existing valid token
    // @ts-ignore - csrf_tokens table exists but not in types yet (run migration first)
    const { data: existingTokens, error: fetchError } = await (supabase as any)
      .from('csrf_tokens')
      .select('token, expires_at')
      .eq('user_id', userId)
      .gt('expires_at', now.toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    if (fetchError) {
      console.error('[CSRF] Error fetching existing token:', fetchError);
      // Continue to generate new token
    } else if (existingTokens && existingTokens.length > 0) {
      const existingToken = existingTokens[0] as { token: string; expires_at: string };
      console.log('[CSRF] Returning existing token for userId:', userId);
      return existingToken.token;
    }

    // Generate new token
    const token = generateCsrfToken();

    // Delete any old tokens for this user (cleanup)
    // @ts-ignore - csrf_tokens table exists but not in types yet (run migration first)
    await (supabase as any)
      .from('csrf_tokens')
      .delete()
      .eq('user_id', userId);

    // Insert new token
    // @ts-ignore - csrf_tokens table exists but not in types yet (run migration first)
    const { error: insertError } = await (supabase as any)
      .from('csrf_tokens')
      .insert({
        user_id: userId,
        token,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error('[CSRF] Error inserting token:', insertError);
      throw new Error('Failed to store CSRF token');
    }

    console.log('[CSRF] Generated new token:', {
      userId,
      tokenLength: token.length,
      tokenPrefix: token.substring(0, 10) + '...',
      expiresAt: expiresAt.toISOString(),
    });

    return token;
  } catch (error) {
    console.error('[CSRF] Error in getCsrfToken:', error);
    throw error;
  }
}

/**
 * Validate CSRF token
 * Uses Supabase database for token lookup
 * 
 * @param userId - User ID
 * @param token - Token to validate
 * @returns true if token is valid
 */
export async function validateCsrfToken(userId: string, token: string): Promise<boolean> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  console.log('[CSRF] validateCsrfToken called:', {
    userId,
    tokenLength: token?.length,
    tokenPrefix: token ? token.substring(0, 10) + '...' : 'null',
  });

  try {
    // Clean up expired tokens first
    await cleanupExpiredTokens(supabase);

    // Look up token in database
    // @ts-ignore - csrf_tokens table exists but not in types yet (run migration first)
    const { data: storedTokens, error: fetchError } = await (supabase as any)
      .from('csrf_tokens')
      .select('token, expires_at')
      .eq('user_id', userId)
      .eq('token', token)
      .gt('expires_at', now)
      .limit(1);

    if (fetchError) {
      console.error('[CSRF] Error fetching token:', fetchError);
      return false;
    }

    if (!storedTokens || storedTokens.length === 0) {
      console.error('[CSRF] No stored token found for userId:', userId);
      return false;
    }

    const storedToken = storedTokens[0] as { token: string; expires_at: string };

    // Double-check expiration (shouldn't be needed due to query, but safety check)
    if (new Date(storedToken.expires_at) < new Date(now)) {
      console.error('[CSRF] Token expired:', {
        userId,
        expiresAt: storedToken.expires_at,
        now,
      });
      return false;
    }

    // Use constant-time comparison to prevent timing attacks
    const storedBuffer = Buffer.from(storedToken.token);
    const tokenBuffer = Buffer.from(token);
    
    if (storedBuffer.length !== tokenBuffer.length) {
      console.error('[CSRF] Token length mismatch:', {
        userId,
        storedLength: storedBuffer.length,
        receivedLength: tokenBuffer.length,
      });
      return false;
    }
    
    const isValid = crypto.timingSafeEqual(storedBuffer, tokenBuffer);
    
    console.log('[CSRF] Token validation result:', {
      userId,
      isValid,
      storedTokenPrefix: storedToken.token.substring(0, 10) + '...',
      receivedTokenPrefix: token.substring(0, 10) + '...',
    });

    return isValid;
  } catch (error) {
    console.error('[CSRF] Error in validateCsrfToken:', error);
    return false;
  }
}

/**
 * CSRF protection middleware for state-changing operations
 * 
 * @param request - Next.js request
 * @param userId - Authenticated user ID
 * @param parsedBody - Optional pre-parsed request body (to avoid reading body twice)
 * @returns NextResponse with 403 if CSRF token is invalid, null if valid
 */
export async function checkCsrfToken(
  request: NextRequest,
  userId: string,
  parsedBody?: unknown
): Promise<NextResponse | null> {
  const method = request.method;
  
  console.log('[CSRF] checkCsrfToken called:', {
    method,
    userId,
    url: request.url,
    hasParsedBody: !!parsedBody,
  });

  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return null;
  }

  // Get token from header (preferred) or body
  const headerToken = request.headers.get('X-CSRF-Token');
  let bodyToken: string | null = null;

  // Use provided parsed body if available, otherwise try to parse
  if (parsedBody && typeof parsedBody === 'object' && parsedBody !== null) {
    const body = parsedBody as Record<string, unknown>;
    bodyToken = (body.csrfToken || body._csrf || null) as string | null;
  } else {
    // Only read body if not already provided
    try {
      const body = await request.json();
      if (body && typeof body === 'object') {
        bodyToken = (body.csrfToken || body._csrf || null) as string | null;
      }
    } catch {
      // Body might be empty or not JSON
    }
  }

  const token = headerToken || bodyToken;

  console.log('[CSRF] Token extraction:', {
    userId,
    hasHeaderToken: !!headerToken,
    hasBodyToken: !!bodyToken,
    hasToken: !!token,
    tokenSource: headerToken ? 'header' : bodyToken ? 'body' : 'none',
    tokenPrefix: token ? token.substring(0, 10) + '...' : 'null',
  });

  if (!token) {
    console.error('[CSRF] No token found in request');
    
    // In development, include diagnostic information
    const diagnosticInfo = process.env.NODE_ENV === 'development' ? {
      userId,
      hasHeaderToken: !!headerToken,
      hasBodyToken: !!bodyToken,
      hasParsedBody: !!parsedBody,
    } : {};
    
    return NextResponse.json(
      { 
        error: 'CSRF token is required',
        ...diagnosticInfo,
      },
      { status: 403 }
    );
  }

  const isValid = await validateCsrfToken(userId, token);
  
  if (!isValid) {
    console.error('[CSRF] Token validation failed for userId:', userId);
    
    // In development, include diagnostic information
    const supabase = await createClient();
    let diagnosticInfo: Record<string, unknown> = {};
    
    if (process.env.NODE_ENV === 'development') {
      try {
        // @ts-ignore - csrf_tokens table exists but not in types yet (run migration first)
        const { data: userTokens } = await (supabase as any)
          .from('csrf_tokens')
          .select('user_id')
          .eq('user_id', userId);
        
        diagnosticInfo = {
          userId,
          hasTokenForUser: (userTokens?.length ?? 0) > 0,
          tokenPrefix: token.substring(0, 10) + '...',
        };
      } catch (error) {
        diagnosticInfo = {
          userId,
          error: 'Failed to fetch diagnostic info',
        };
      }
    }
    
    return NextResponse.json(
      { 
        error: 'Invalid CSRF token',
        ...diagnosticInfo,
      },
      { status: 403 }
    );
  }

  console.log('[CSRF] Token validation successful for userId:', userId);
  return null;
}

/**
 * Get CSRF token endpoint handler
 * This should be called by the client to get a CSRF token
 */
export async function getCsrfTokenHandler(request: NextRequest): Promise<NextResponse> {
  try {
    console.log('[CSRF] getCsrfTokenHandler called');
    
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    console.log('[CSRF] User lookup:', {
      hasUser: !!user,
      userId: user?.id,
      userError: userError?.message,
    });

    if (!user) {
      console.error('[CSRF] No user found in session');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const token = await getCsrfToken(user.id);

    console.log('[CSRF] Token generated successfully:', {
      userId: user.id,
      tokenLength: token.length,
    });

    return NextResponse.json({ csrfToken: token });
  } catch (error) {
    console.error('[CSRF] Error in getCsrfTokenHandler:', error);
    return NextResponse.json(
      { error: 'Failed to generate CSRF token' },
      { status: 500 }
    );
  }
}
