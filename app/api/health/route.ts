import { NextResponse } from 'next/server';

/**
 * GET /api/health
 * Health check endpoint for monitoring
 * 
 * Returns application status and basic information
 */
export async function GET() {
  try {
    // Basic health check - can be extended to check database, external services, etc.
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.NEXT_PUBLIC_APP_VERSION || process.env.VERCEL_GIT_COMMIT_SHA || 'unknown',
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
      },
      { status: 500 }
    );
  }
}

