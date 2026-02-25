import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { ADMIN_EMAIL } from '@/lib/constants/admin';
import type { Business } from '@/lib/types/supabase';

export type AdminBusinessRow = Business;

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      user: null,
    };
  }
  if (user.email?.toLowerCase().trim() !== ADMIN_EMAIL.toLowerCase().trim()) {
    return {
      error: NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      ),
      user: null,
    };
  }
  return { error: null, user };
}

/**
 * GET /api/admin/businesses
 * List businesses with pagination, sort, and search. Admin only.
 * Query: page, pageSize, sortBy, sortDir, search
 */
export async function GET(request: NextRequest) {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('pageSize') || '25', 10))
    );
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortDir = (searchParams.get('sortDir') || 'desc') as 'asc' | 'desc';
    const search = (searchParams.get('search') || '').trim();

    const service = createServiceRoleClient();

    const validSortColumns = [
      'created_at',
      'updated_at',
      'business_name',
      'email',
      'is_active',
      'is_verified',
    ];
    const orderColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at';

    let query = service
      .from('businesses')
      .select('*', { count: 'exact' })
      .order(orderColumn, { ascending: sortDir === 'asc' });

    if (search) {
      const safe = search.replace(/[%,"\\]/g, '').trim();
      if (safe) {
        const term = `%${safe}%`;
        query = query.or(`business_name.ilike.${term},email.ilike.${term}`);
      }
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data: businesses, error: listError, count } = await query.range(from, to);

    if (listError) {
      return NextResponse.json(
        { error: 'Failed to fetch businesses' },
        { status: 500 }
      );
    }

    const total = count ?? 0;

    return NextResponse.json({
      businesses: (businesses ?? []) as AdminBusinessRow[],
      total,
      page,
      pageSize,
    });
  } catch (error) {
    console.error('GET /api/admin/businesses', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
