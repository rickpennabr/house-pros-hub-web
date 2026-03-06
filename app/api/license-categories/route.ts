import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

/**
 * GET /api/license-categories
 * Returns all license categories (public). Used by signup/business forms to build license type options.
 */
export async function GET() {
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from('license_categories')
      .select('id, code, name, description, requires_contractor_license, sort_order')
      .order('sort_order', { ascending: true });

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json({ categories: [] }, { status: 200 });
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
        requires_contractor_license: (row as { requires_contractor_license: boolean }).requires_contractor_license,
        sort_order: (row as { sort_order: number }).sort_order,
      })),
    });
  } catch (e) {
    console.error('GET /api/license-categories error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
