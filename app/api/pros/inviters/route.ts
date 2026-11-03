import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { listProInviters } from '@/lib/pros/inviters';

export const dynamic = 'force-dynamic';

/**
 * GET /api/pros/inviters
 * Public list of pros for the signup "Who invited you?" field.
 * Each label is "First Last - Business Name" when the pro has a business.
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await checkRateLimit(request, 'general');
    if (rateLimitResponse) return rateLimitResponse;

    const inviters = await listProInviters(createServiceRoleClient());
    return NextResponse.json(
      { inviters },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      },
    );
  } catch (error) {
    console.error('GET /api/pros/inviters error:', error);
    return NextResponse.json({ error: 'Failed to load pros' }, { status: 500 });
  }
}
