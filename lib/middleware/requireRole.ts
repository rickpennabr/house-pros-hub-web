import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthenticatedRequest } from './auth';
import { hasAnyRole, UserRole } from '@/lib/utils/roles';
import { logger } from '@/lib/utils/logger';

/**
 * Middleware to require specific role(s) for API routes
 * 
 * Wraps requireAuth and adds role verification.
 * User must have at least one of the specified roles.
 * 
 * @param roles - Array of roles that are allowed
 * @param handler - The handler function to execute if role check passes
 * @returns NextResponse
 * 
 * @example
 * export async function POST(request: NextRequest) {
 *   return requireRole(['contractor'], async (req: AuthenticatedRequest) => {
 *     // Handler logic
 *   })(request);
 * }
 */
export function requireRole(
  roles: UserRole[],
  handler: (request: AuthenticatedRequest) => Promise<NextResponse>
) {
  return requireAuth(async (request: AuthenticatedRequest) => {
    const userId = request.userId;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if user has at least one of the required roles
    const hasRole = await hasAnyRole(userId, roles);

    if (!hasRole) {
      logger.warn('Role check failed', {
        userId,
        requiredRoles: roles,
        endpoint: request.nextUrl.pathname,
      });

      return NextResponse.json(
        { 
          error: 'Insufficient permissions',
          message: `This action requires one of the following roles: ${roles.join(', ')}`,
        },
        { status: 403 }
      );
    }

    // User has required role, proceed with handler
    return handler(request);
  });
}

/**
 * Middleware to optionally check role (doesn't fail if no auth, but checks role if auth exists)
 * Useful for endpoints that work differently based on role but don't require authentication
 */
export function optionalRole(
  roles: UserRole[],
  handler: (request: AuthenticatedRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    // Try to get authenticated request
    const supabase = await (await import('@/lib/supabase/server')).createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      // No auth, proceed without role check
      const authenticatedRequest = request as AuthenticatedRequest;
      authenticatedRequest._body = {};
      return handler(authenticatedRequest);
    }

    // User is authenticated, check role
    const hasRole = await hasAnyRole(user.id, roles);

    if (!hasRole) {
      return NextResponse.json(
        { 
          error: 'Insufficient permissions',
          message: `This action requires one of the following roles: ${roles.join(', ')}`,
        },
        { status: 403 }
      );
    }

    const authenticatedRequest = request as AuthenticatedRequest;
    authenticatedRequest.userId = user.id;
    authenticatedRequest.user = {
      id: user.id,
      email: user.email || '',
    };
    
    try {
      authenticatedRequest._body = await request.json();
    } catch {
      authenticatedRequest._body = {};
    }

    return handler(authenticatedRequest);
  };
}

