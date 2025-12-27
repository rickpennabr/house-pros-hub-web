import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth, AuthenticatedRequest } from '@/lib/middleware/auth';
import { getUserRoles, addRole, removeRole, UserRole } from '@/lib/utils/roles';
import { handleError } from '@/lib/utils/errorHandler';
import { logger } from '@/lib/utils/logger';
import { z } from 'zod';

/**
 * Schema for role management requests
 */
const roleSchema = z.object({
  role: z.enum(['customer', 'contractor'], {
    message: 'Role must be either "customer" or "contractor"',
  }),
});

/**
 * GET /api/profile/roles
 * Get user's active roles
 */
async function handleGetRoles(request: AuthenticatedRequest) {
  try {
    const userId = request.userId;
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const roles = await getUserRoles(userId);

    return NextResponse.json({
      roles,
    });
  } catch (error) {
    logger.error('Error in GET /api/profile/roles', { endpoint: '/api/profile/roles' }, error as Error);
    return handleError(error, { endpoint: '/api/profile/roles' });
  }
}

/**
 * POST /api/profile/roles
 * Add a role to the user
 * Body: { role: 'customer' | 'contractor' }
 */
async function handleAddRole(request: AuthenticatedRequest) {
  try {
    const userId = request.userId;
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = request._body || await request.json();
    const validationResult = roleSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { role } = validationResult.data;

    // Add the role
    const success = await addRole(userId, role);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to add role' },
        { status: 500 }
      );
    }

    // Return updated roles list
    const roles = await getUserRoles(userId);

    return NextResponse.json({
      message: 'Role added successfully',
      roles,
    }, { status: 201 });
  } catch (error) {
    logger.error('Error in POST /api/profile/roles', { endpoint: '/api/profile/roles' }, error as Error);
    return handleError(error, { endpoint: '/api/profile/roles' });
  }
}

/**
 * DELETE /api/profile/roles
 * Remove a role from the user (deactivate)
 * Body: { role: 'customer' | 'contractor' }
 */
async function handleRemoveRole(request: AuthenticatedRequest) {
  try {
    const userId = request.userId;
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = request._body || await request.json();
    const validationResult = roleSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { role } = validationResult.data;

    // Check if user has at least one other active role
    // Users should not be able to remove their last role
    const currentRoles = await getUserRoles(userId);
    if (currentRoles.length <= 1 && currentRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Cannot remove last remaining role' },
        { status: 400 }
      );
    }

    // Remove the role
    const success = await removeRole(userId, role);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to remove role' },
        { status: 500 }
      );
    }

    // Return updated roles list
    const roles = await getUserRoles(userId);

    return NextResponse.json({
      message: 'Role removed successfully',
      roles,
    });
  } catch (error) {
    logger.error('Error in DELETE /api/profile/roles', { endpoint: '/api/profile/roles' }, error as Error);
    return handleError(error, { endpoint: '/api/profile/roles' });
  }
}

export async function GET(request: NextRequest) {
  return requireAuth(handleGetRoles)(request);
}

export async function POST(request: NextRequest) {
  return requireAuth(handleAddRole)(request);
}

export async function DELETE(request: NextRequest) {
  return requireAuth(handleRemoveRole)(request);
}

