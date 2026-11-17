import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

/**
 * GET /api/license-categories
 * Public list for signup/business forms.
 * Optional ?role=contractor|realtor filters Nevada license types by account role.
 */
export async function GET(request: NextRequest) {
  try {
    const roleParam = request.nextUrl.searchParams.get('role')?.trim().toLowerCase();
    const role = roleParam === 'realtor' || roleParam === 'contractor' ? roleParam : null;

    const supabase = createServiceRoleClient();
    let query = supabase
      .from('license_categories')
      .select('id, code, name, description, requires_contractor_license, sort_order, role')
      .order('sort_order', { ascending: true });

    if (role) {
      query = query.eq('role', role);
    }

    const { data, error } = await query;

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json({ categories: [] }, { status: 200 });
      }
      // Older DBs without role column still work for the unfiltered list.
      if (String(error.message || '').includes('role')) {
        const fallback = await supabase
          .from('license_categories')
          .select('id, code, name, description, requires_contractor_license, sort_order')
          .order('sort_order', { ascending: true });
        if (fallback.error) {
          console.error('GET /api/license-categories error:', fallback.error);
          return NextResponse.json({ error: 'Failed to load categories' }, { status: 500 });
        }
        return NextResponse.json({
          categories: (fallback.data ?? []).map((row) => ({
            id: row.id,
            code: row.code,
            name: row.name,
            description: row.description ?? undefined,
            requires_contractor_license: row.requires_contractor_license,
            sort_order: row.sort_order,
            role: 'contractor' as const,
          })),
        });
      }
      console.error('GET /api/license-categories error:', error);
      return NextResponse.json({ error: 'Failed to load categories' }, { status: 500 });
    }

    return NextResponse.json({
      categories: (data ?? []).map((row) => ({
        id: (row as { id: string }).id,
        code: (row as { code: string }).code,
        name: (row as { name: string }).name,
        description: (row as { description: string | null }).description ?? undefined,
        requires_contractor_license: (row as { requires_contractor_license: boolean })
          .requires_contractor_license,
        sort_order: (row as { sort_order: number }).sort_order,
        role: ((row as { role?: string }).role as 'contractor' | 'realtor' | undefined) ?? 'contractor',
      })),
    });
  } catch (e) {
    console.error('GET /api/license-categories error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
