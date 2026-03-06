import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasRole } from '@/lib/utils/roles';

async function requireContractor() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null };
  const isContractor = await hasRole(user.id, 'contractor');
  if (!isContractor) return { error: NextResponse.json({ error: 'Forbidden - Contractor access required' }, { status: 403 }), user: null };
  return { error: null, user };
}

const VALID_SORT = ['created_at', 'expense_date', 'amount_cents', 'category'] as const;

export async function GET(request: NextRequest) {
  try {
    const { error: authError, user } = await requireContractor();
    if (authError || !user) return authError!;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '25', 10)));
    const sortBy = (searchParams.get('sortBy') || 'expense_date') as (typeof VALID_SORT)[number];
    const sortDir = (searchParams.get('sortDir') || 'desc') as 'asc' | 'desc';
    const projectId = searchParams.get('projectId') || '';

    const supabase = await createClient();
    const orderColumn = VALID_SORT.includes(sortBy) ? sortBy : 'expense_date';

    let query = supabase
      .from('pro_crm_expenses')
      .select('*', { count: 'exact' })
      .eq('owner_id', user.id)
      .order(orderColumn, { ascending: sortDir === 'asc' });

    if (projectId) query = query.eq('project_id', projectId);

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data: expenses, error: fetchError, count } = await query.range(from, to);

    if (fetchError) return NextResponse.json({ error: fetchError.message || 'Failed to fetch expenses' }, { status: 500 });

    return NextResponse.json({ expenses: expenses ?? [], total: count ?? 0, page, pageSize });
  } catch (err) {
    console.error('GET /api/crm/expenses', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { error: authError, user } = await requireContractor();
    if (authError || !user) return authError!;

    const body = await request.json();
    const amountCents = typeof body.amountCents === 'number' ? body.amountCents : Math.round(parseFloat(String(body.amountCents || 0)) * 100) || 0;
    const category = typeof body.category === 'string' ? body.category.trim() || 'other' : 'other';
    const expenseDate = body.expenseDate ?? body.expense_date ?? new Date().toISOString().slice(0, 10);
    const note = typeof body.note === 'string' ? body.note.trim() || null : null;
    const receiptUrl = typeof body.receiptUrl === 'string' ? body.receiptUrl.trim() || null : null;
    const projectId = body.projectId ?? body.project_id ?? null;

    const supabase = await createClient();
    if (projectId) {
      const { data: proj } = await supabase.from('pro_crm_projects').select('id').eq('id', projectId).eq('owner_id', user.id).single();
      if (!proj) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const { data: row, error } = await supabase
      .from('pro_crm_expenses')
      .insert({
        owner_id: user.id,
        project_id: projectId,
        amount_cents: amountCents,
        category,
        expense_date: expenseDate,
        note,
        receipt_url: receiptUrl,
      })
      .select('id, created_at')
      .single();

    if (error) return NextResponse.json({ error: error.message || 'Failed to create expense' }, { status: 500 });
    return NextResponse.json({ id: row.id, created_at: row.created_at }, { status: 201 });
  } catch (err) {
    console.error('POST /api/crm/expenses', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
