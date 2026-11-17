import { NextRequest, NextResponse } from 'next/server';
import { requireContractor } from '@/lib/crm/require-contractor';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/crm/invoice-settings/display-names
 * Creates a new display-only business name for use in the Default business list.
 */
export async function POST(request: NextRequest) {
  try {
    const { error: authError, user } = await requireContractor();
    if (authError || !user) return authError;

    const body = await request.json();
    const displayName =
      typeof body.displayName === 'string'
        ? body.displayName.trim()
        : typeof body.display_name === 'string'
          ? body.display_name.trim()
          : '';

    if (!displayName) {
      return NextResponse.json({ error: 'Display name is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: row, error } = await supabase
      .from('pro_invoice_display_names')
      .insert({ owner_id: user.id, display_name: displayName })
      .select('id, display_name, created_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to create display name' }, { status: 500 });
    }

    return NextResponse.json({ displayName: row });
  } catch (err) {
    console.error('POST /api/crm/invoice-settings/display-names', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
