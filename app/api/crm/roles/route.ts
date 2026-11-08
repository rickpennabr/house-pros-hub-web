import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasRole } from '@/lib/utils/roles';
import { listContactRoles, slugifyRoleName } from '@/lib/crm/contact-role';

async function requireContractor() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null, supabase };
  }
  const isContractor = await hasRole(user.id, 'contractor');
  if (!isContractor) {
    return {
      error: NextResponse.json({ error: 'Forbidden - Contractor access required' }, { status: 403 }),
      user: null,
      supabase,
    };
  }
  return { error: null, user, supabase };
}

/**
 * GET /api/crm/roles
 * System contact roles plus roles this contractor added.
 */
export async function GET() {
  try {
    const { error: authError, user, supabase } = await requireContractor();
    if (authError || !user) return authError!;
    const roles = await listContactRoles(supabase, user.id);
    return NextResponse.json({ roles });
  } catch (err) {
    console.error('GET /api/crm/roles', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/crm/roles
 * Add a contact role for this contractor. Built-in names cannot be duplicated.
 */
export async function POST(request: NextRequest) {
  try {
    const { error: authError, user, supabase } = await requireContractor();
    if (authError || !user) return authError!;

    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (name.length < 2 || name.length > 40) {
      return NextResponse.json({ error: 'Role name must be 2 to 40 characters' }, { status: 400 });
    }
    const slug = slugifyRoleName(name);
    if (!slug) {
      return NextResponse.json({ error: 'Role name needs a letter or number' }, { status: 400 });
    }

    const existing = await listContactRoles(supabase, user.id);
    if (existing.some((role) => role.slug === slug || role.name.toLowerCase() === name.toLowerCase())) {
      return NextResponse.json({ error: 'That role already exists' }, { status: 409 });
    }

    const canInvoice = body.canInvoice === true || body.can_invoice === true;
    const { data, error } = await supabase
      .from('pro_crm_roles')
      .insert({
        owner_id: user.id,
        slug,
        name,
        can_invoice: canInvoice,
        is_system: false,
        sort_order: 100,
      })
      .select('id, name, slug, can_invoice, is_system')
      .single();
    if (error || !data) {
      return NextResponse.json({ error: error?.message || 'Failed to add role' }, { status: 500 });
    }
    return NextResponse.json({ role: data }, { status: 201 });
  } catch (err) {
    console.error('POST /api/crm/roles', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
