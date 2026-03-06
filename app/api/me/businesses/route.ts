import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

/**
 * GET /api/me/businesses
 * Returns business IDs owned by the current user (for contractor presence heartbeat).
 * Requires auth.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const service = createServiceRoleClient();
    const { data: rows } = await service
      .from('businesses')
      .select('id')
      .eq('owner_id', user.id)
      .eq('is_active', true);

    const businessIds = (rows ?? []).map((r) => (r as { id: string }).id);
    return NextResponse.json({ businessIds }, { status: 200 });
  } catch (e) {
    console.error('GET /api/me/businesses error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
