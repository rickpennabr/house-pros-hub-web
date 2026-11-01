import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasRole } from '@/lib/utils/roles';

async function requireContractor() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null };
  }
  const isContractor = await hasRole(user.id, 'contractor');
  if (!isContractor) {
    return {
      error: NextResponse.json({ error: 'Forbidden - Contractor access required' }, { status: 403 }),
      user: null,
    };
  }
  return { error: null, user };
}

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
