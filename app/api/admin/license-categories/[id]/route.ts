import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { ADMIN_EMAIL } from '@/lib/constants/admin';

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

/**
 * PATCH /api/admin/license-categories/[id]
 * Update a license category.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  try {
    const body = await request.json();
    const updates: Record<string, unknown> = {};
    if (typeof body.code === 'string') updates.code = body.code.trim().toUpperCase();
    if (typeof body.name === 'string') updates.name = body.name.trim();
    if (body.description !== undefined) updates.description = typeof body.description === 'string' ? body.description.trim() || null : null;
    if (typeof body.requires_contractor_license === 'boolean') updates.requires_contractor_license = body.requires_contractor_license;
    if (typeof body.sort_order === 'number') updates.sort_order = body.sort_order;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from('license_categories')
      .update(updates)
      .eq('id', id)
      .select('id, code, name, description, requires_contractor_license, sort_order, created_at, updated_at')
      .single();

    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'A category with this code already exists' }, { status: 400 });
      if (error.code === 'PGRST116') return NextResponse.json({ error: 'Category not found' }, { status: 404 });
      console.error('PATCH /api/admin/license-categories error:', error);
      return NextResponse.json({ error: 'Failed to update category' }, { status: 500 });
    }

    return NextResponse.json({ category: data });
  } catch (e) {
    console.error('PATCH /api/admin/license-categories error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/license-categories/[id]
 * Delete a license category.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  try {
    const supabase = createServiceRoleClient();
    const { error } = await supabase.from('license_categories').delete().eq('id', id);

    if (error) {
      if (error.code === 'PGRST116') return NextResponse.json({ error: 'Category not found' }, { status: 404 });
      console.error('DELETE /api/admin/license-categories error:', error);
      return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('DELETE /api/admin/license-categories error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
