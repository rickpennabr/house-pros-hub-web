import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';
import { logger } from '@/lib/utils/logger';

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
    const { error } = await supabase
      .from('csrf_tokens')
      .delete()
      .lt('expires_at', now);

    if (error) {
      logger.error('Error cleaning up expired CSRF tokens', { endpoint: 'csrf-cleanup' }, error as Error);
    }
  } catch (error) {
    logger.error('Exception during CSRF token cleanup', { endpoint: 'csrf-cleanup' }, error as Error);
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

  logger.debug('Getting CSRF token', {
    expiresAt: expiresAt.toISOString(),
  });

  try {
    // Clean up expired tokens first
    await cleanupExpiredTokens(supabase);

    // Check for existing valid token
    const { data: existingTokens, error: fetchError } = await supabase
      .from('csrf_tokens')
      .select('token, expires_at')
      .eq('user_id', userId)
      .gt('expires_at', now.toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    if (fetchError) {
      logger.error('Error fetching existing CSRF token', { endpoint: 'csrf-get-token' }, fetchError as Error);
      // Continue to generate new token
    } else if (existingTokens && existingTokens.length > 0) {
      const existingToken = existingTokens[0] as { token: string; expires_at: string };
      logger.debug('Returning existing CSRF token');
      return existingToken.token;
    }

    // Generate new token
    const token = generateCsrfToken();

    // Delete any old tokens for this user (cleanup)
    await supabase
      .from('csrf_tokens')
      .delete()
      .eq('user_id', userId);

    // Insert new token
    const { error: insertError } = await supabase
      .from('csrf_tokens')
      .insert({
        user_id: userId,
        token,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      logger.error('Error inserting CSRF token', { endpoint: 'csrf-get-token' }, insertError as Error);
      throw new Error('Failed to store CSRF token');
    }

    logger.debug('Generated new CSRF token', {
      tokenLength: token.length,
      expiresAt: expiresAt.toISOString(),
    });

    return token;
  } catch (error) {
    logger.error('Error in getCsrfToken', { endpoint: 'csrf-get-token' }, error as Error);
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

  logger.debug('Validating CSRF token', {
    tokenLength: token?.length,
  });

  try {
    // Clean up expired tokens first
    await cleanupExpiredTokens(supabase);

    // Look up token in database
    const { data: storedTokens, error: fetchError } = await supabase
      .from('csrf_tokens')
      .select('token, expires_at')
      .eq('user_id', userId)
      .eq('token', token)
      .gt('expires_at', now)
      .limit(1);

    if (fetchError) {
      logger.error('Error fetching CSRF token for validation', { endpoint: 'csrf-validate' }, fetchError as Error);
      return false;
    }

    if (!storedTokens || storedTokens.length === 0) {
      logger.warn('No stored CSRF token found', { endpoint: 'csrf-validate' });
      return false;
    }

    const storedToken = storedTokens[0] as { token: string; expires_at: string };

    // Double-check expiration (shouldn't be needed due to query, but safety check)
    if (new Date(storedToken.expires_at) < new Date(now)) {
      logger.warn('CSRF token expired', {
        endpoint: 'csrf-validate',
        expiresAt: storedToken.expires_at,
      });
      return false;
    }

    // Use constant-time comparison to prevent timing attacks
    const storedBuffer = Buffer.from(storedToken.token);
    const tokenBuffer = Buffer.from(token);
    
    if (storedBuffer.length !== tokenBuffer.length) {
      logger.warn('CSRF token length mismatch', {
        endpoint: 'csrf-validate',
        storedLength: storedBuffer.length,
        receivedLength: tokenBuffer.length,
      });
      return false;
    }
    
    const isValid = crypto.timingSafeEqual(storedBuffer, tokenBuffer);
    
    logger.debug('CSRF token validation result', {
      isValid,
    });

    return isValid;
  } catch (error) {
    logger.error('Error in validateCsrfToken', { endpoint: 'csrf-validate' }, error as Error);
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
  
  logger.debug('Checking CSRF token', {
    method,
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

  logger.debug('CSRF token extraction', {
    hasHeaderToken: !!headerToken,
    hasBodyToken: !!bodyToken,
    hasToken: !!token,
    tokenSource: headerToken ? 'header' : bodyToken ? 'body' : 'none',
  });

  if (!token) {
    logger.warn('No CSRF token found in request', {
      endpoint: request.nextUrl.pathname,
      method,
    });
    
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
    logger.warn('CSRF token validation failed', {
      endpoint: request.nextUrl.pathname,
      method,
    });
    
    // In development, include diagnostic information
    const supabase = await createClient();
    let diagnosticInfo: Record<string, unknown> = {};
    
    if (process.env.NODE_ENV === 'development') {
      try {
        const { data: userTokens } = await supabase
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

  logger.debug('CSRF token validation successful', {
    endpoint: request.nextUrl.pathname,
  });
  return null;
}

/**
 * Get CSRF token endpoint handler
 * This should be called by the client to get a CSRF token
 */
export async function getCsrfTokenHandler(request: NextRequest): Promise<NextResponse> {
  try {
    logger.debug('CSRF token handler called');
    
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    logger.debug('User lookup for CSRF token', {
      hasUser: !!user,
      userError: userError?.message,
    });

    if (!user) {
      logger.warn('No user found in session for CSRF token request', {
        endpoint: '/api/csrf-token',
      });
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const token = await getCsrfToken(user.id);

    logger.debug('CSRF token generated successfully', {
      tokenLength: token.length,
    });

    return NextResponse.json({ csrfToken: token });
  } catch (error) {
    logger.error('Error in getCsrfTokenHandler', { endpoint: '/api/csrf-token' }, error as Error);
    return NextResponse.json(
      { error: 'Failed to generate CSRF token' },
      { status: 500 }
    );
  }
}
