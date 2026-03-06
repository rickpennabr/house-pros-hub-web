import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { ADMIN_EMAIL } from '@/lib/constants/admin';

export interface LicenseCategoryRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  requires_contractor_license: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

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
 * GET /api/admin/license-categories
 * List all license categories (admin).
 */
export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from('license_categories')
      .select('id, code, name, description, requires_contractor_license, sort_order, created_at, updated_at')
      .order('sort_order', { ascending: true });

    if (error) {
      if (error.code === '42P01') return NextResponse.json({ categories: [] });
      console.error('GET /api/admin/license-categories error:', error);
      return NextResponse.json({ error: 'Failed to load categories' }, { status: 500 });
    }

    return NextResponse.json({
      categories: (data ?? []) as LicenseCategoryRow[],
    });
  } catch (e) {
    console.error('GET /api/admin/license-categories error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/admin/license-categories
 * Create a new license category.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim() || null : null;
    const requires_contractor_license = typeof body.requires_contractor_license === 'boolean' ? body.requires_contractor_license : true;
    const sort_order = typeof body.sort_order === 'number' ? body.sort_order : 0;

    if (!code || !name) {
      return NextResponse.json({ error: 'code and name are required' }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from('license_categories')
      .insert({
        code,
        name,
        description,
        requires_contractor_license,
        sort_order,
      })
      .select('id, code, name, description, requires_contractor_license, sort_order, created_at, updated_at')
      .single();

    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'A category with this code already exists' }, { status: 400 });
      console.error('POST /api/admin/license-categories error:', error);
      return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
    }

    return NextResponse.json({ category: data });
  } catch (e) {
    console.error('POST /api/admin/license-categories error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
