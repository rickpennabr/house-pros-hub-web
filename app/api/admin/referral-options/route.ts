import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { ADMIN_EMAIL } from '@/lib/constants/admin';
import { REFERRAL_OPTIONS } from '@/lib/constants/referral';

const MAX_LABEL = 80;
const builtinLabels = new Set(REFERRAL_OPTIONS.map((label) => label.toLowerCase()));

async function requireAdmin() {
  const supabaseAuth = await createClient();
  const {
    data: { user },
    error,
  } = await supabaseAuth.auth.getUser();
  if (error || !user?.email) {
    return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) };
  }
  if (user.email.trim().toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { user };
}

function toOption(row: { id: string; label: string; asks_for_name: boolean; sort_order: number }) {
  return {
    id: row.id,
    label: row.label,
    asksForName: row.asks_for_name,
    sortOrder: row.sort_order,
  };
}

/**
 * GET /api/admin/referral-options
 * List admin-added referral choices.
 */
export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from('referral_options')
      .select('id, label, asks_for_name, sort_order')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205') {
        return NextResponse.json({ options: [], setupRequired: true });
      }
      console.error('GET /api/admin/referral-options error:', error);
      return NextResponse.json({ error: 'Failed to load referral options' }, { status: 500 });
    }

    return NextResponse.json({ options: (data ?? []).map(toOption) });
  } catch (error) {
    console.error('GET /api/admin/referral-options error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/admin/referral-options
 * Add a referral choice. Body: { label: string, asksForName?: boolean }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const label = typeof body.label === 'string' ? body.label.trim().replace(/\s+/g, ' ') : '';
    const asksForName = body.asksForName === true;

    if (!label) {
      return NextResponse.json({ error: 'Enter a name for the option' }, { status: 400 });
    }
    if (label.length > MAX_LABEL) {
      return NextResponse.json({ error: `Option must be ${MAX_LABEL} characters or less` }, { status: 400 });
    }
    if (builtinLabels.has(label.toLowerCase())) {
      return NextResponse.json({ error: 'That option is already on the list' }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    const { data: existing, error: existingError } = await supabase
      .from('referral_options')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1);

    if (existingError) {
      if (existingError.code === '42P01' || existingError.code === 'PGRST205') {
        return NextResponse.json({ error: 'Referral options are not set up yet' }, { status: 500 });
      }
      console.error('POST /api/admin/referral-options error:', existingError);
      return NextResponse.json({ error: 'Failed to add option' }, { status: 500 });
    }

    const sortOrder = (existing?.[0]?.sort_order ?? -1) + 1;
    const { data, error } = await supabase
      .from('referral_options')
      .insert({ label, asks_for_name: asksForName, sort_order: sortOrder })
      .select('id, label, asks_for_name, sort_order')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'That option is already on the list' }, { status: 409 });
      }
      console.error('POST /api/admin/referral-options error:', error);
      return NextResponse.json({ error: 'Failed to add option' }, { status: 500 });
    }

    return NextResponse.json({ option: toOption(data) });
  } catch (error) {
    console.error('POST /api/admin/referral-options error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
