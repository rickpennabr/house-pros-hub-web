import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, getRateLimitType } from '@/lib/middleware/rateLimit';
import { checkCsrfToken } from '@/lib/middleware/csrf';
import { logger } from '@/lib/utils/logger';

/**
 * Authentication middleware for API routes
 * 
 * Verifies Supabase session and attaches user info to request
 */
export interface AuthenticatedRequest extends NextRequest {
  userId?: string;
  user?: {
    id: string;
    email: string;
  };
  _body?: unknown; // Cache parsed body to avoid re-reading
}

/**
 * Middleware to check if user is authenticated
 * Returns 401 if not authenticated
 * 
 * Note: This middleware reads the request body, so handlers should use request._body
 * instead of reading the body again.
 */
export function requireAuth(
  handler: (request: AuthenticatedRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      // Check rate limit first
      const rateLimitType = getRateLimitType(request.nextUrl.pathname);
      const rateLimitResponse = await checkRateLimit(request, rateLimitType);
      if (rateLimitResponse) {
        return rateLimitResponse;
      }

      const supabase = await createClient();
      
      // Get user from Supabase (authenticates with server, more secure than getSession)
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      // Development-only debug logging (no sensitive data in production)
      logger.debug('User authentication attempt', {
        hasUser: !!user,
        path: request.nextUrl.pathname,
        method: request.method,
      });

      if (userError || !user) {
        logger.warn('Authentication failed', {
          path: request.nextUrl.pathname,
          method: request.method,
          error: userError?.message,
        });
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }

      // Check rate limit again with user ID for more accurate limiting
      const userRateLimitResponse = await checkRateLimit(
        request,
        rateLimitType,
        user.id
      );
      if (userRateLimitResponse) {
        return userRateLimitResponse;
      }

      // Parse body once and cache it (before CSRF check so we can pass it)
      let body: unknown = {};
      try {
        body = await request.json();
      } catch {
        // Body might be empty or already parsed
      }

      // Check CSRF token for state-changing operations (pass parsed body to avoid re-reading)
      logger.debug('Checking CSRF token', {
        method: request.method,
        path: request.nextUrl.pathname,
      });

      const csrfResponse = await checkCsrfToken(request, user.id, body);
      if (csrfResponse) {
        return csrfResponse;
      }

      // Attach user info and cached body to request
      const authenticatedRequest = request as AuthenticatedRequest;
      authenticatedRequest.userId = user.id;
      authenticatedRequest.user = {
        id: user.id,
        email: user.email || '',
      };
      authenticatedRequest._body = body;
      
      return handler(authenticatedRequest);
    } catch {
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      );
    }
  };
}

/**
 * Optional auth middleware - doesn't fail if no auth, but attaches user if present
 */
export function optionalAuth(
  handler: (request: AuthenticatedRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      // Check rate limit first
      const rateLimitType = getRateLimitType(request.nextUrl.pathname);
      const rateLimitResponse = await checkRateLimit(request, rateLimitType);
      if (rateLimitResponse) {
        return rateLimitResponse;
      }

      const supabase = await createClient();
      
      // Get user from Supabase (authenticates with server, more secure than getSession)
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Check rate limit with user ID if authenticated
      if (user) {
        const userRateLimitResponse = await checkRateLimit(
          request,
          rateLimitType,
          user.id
        );
        if (userRateLimitResponse) {
          return userRateLimitResponse;
        }
      }

      // Parse body once and cache it
      let body: unknown = {};
      try {
        body = await request.json();
      } catch {
        // Body might be empty or already parsed
      }

      const authenticatedRequest = request as AuthenticatedRequest;
      
      if (user) {
        authenticatedRequest.userId = user.id;
        authenticatedRequest.user = {
          id: user.id,
          email: user.email || '',
        };
      }
      
      authenticatedRequest._body = body;
      
      return handler(authenticatedRequest);
    } catch {
      // Continue without auth
      const authenticatedRequest = request as AuthenticatedRequest;
      authenticatedRequest._body = {};
      return handler(authenticatedRequest);
    }
  };
}
