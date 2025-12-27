import { NextRequest, NextResponse } from 'next/server';
import { getCsrfTokenHandler } from '@/lib/middleware/csrf';

/**
 * GET /api/csrf-token
 * Get CSRF token for authenticated user
 * 
 * This endpoint should be called by the client to obtain a CSRF token
 * for use in state-changing operations (POST, PUT, PATCH, DELETE)
 */
export async function GET(request: NextRequest) {
  return getCsrfTokenHandler(request);
}

