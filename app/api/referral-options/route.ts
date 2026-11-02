import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

/**
 * GET /api/referral-options
 * Extra "How did you hear about us?" choices added by an admin. Public.
 */
export async function GET() {
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from('referral_options')
      .select('id, label, asks_for_name, sort_order')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205') {
        return NextResponse.json({ options: [] });
      }
      console.error('GET /api/referral-options error:', error);
      return NextResponse.json({ error: 'Failed to load referral options' }, { status: 500 });
    }

    return NextResponse.json({
      options: (data ?? []).map((row) => ({
        id: row.id,
        label: row.label,
        asksForName: row.asks_for_name,
        sortOrder: row.sort_order,
      })),
    });
  } catch (error) {
    console.error('GET /api/referral-options error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
