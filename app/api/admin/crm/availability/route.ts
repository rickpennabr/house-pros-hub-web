import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { ADMIN_EMAIL } from '@/lib/constants/admin';

/**
 * GET /api/admin/crm/availability?from=ISO&to=ISO
 * Admin-only: get a copy of all contractors' availability in the given range.
 */
async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null };
  if (user.email?.toLowerCase().trim() !== ADMIN_EMAIL.toLowerCase().trim()) {
    return { error: NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 }), user: null };
  }
  return { error: null, user: user };
}

export async function GET(request: NextRequest) {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    const from = fromParam ? new Date(fromParam) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const to = toParam ? new Date(toParam) : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59);

    const service = createServiceRoleClient();
    const { data: rows, error } = await service
      .from('pro_crm_availability')
      .select('id, owner_id, type, start_at, end_at, note, created_at')
      .gte('end_at', from.toISOString())
      .lte('start_at', to.toISOString())
      .order('start_at', { ascending: true });

    if (error) return NextResponse.json({ error: error.message || 'Failed to fetch' }, { status: 500 });

    return NextResponse.json({ availability: rows ?? [] });
  } catch (err) {
    console.error('GET /api/admin/crm/availability', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
