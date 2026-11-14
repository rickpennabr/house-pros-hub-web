import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasRole } from '@/lib/utils/roles';
import { categoryNeedsSupplier, cleanExpenseText, parseExpenseOrderFields, resolveOwnedSupplierId, supplierNamesById } from '@/lib/crm/expense-supplier';
import { safeTimeZone } from '@/lib/crm/estimate-chart';
import { buildExpenseChart, type ExpenseChart } from '@/lib/crm/list-charts';

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
    const search = (searchParams.get('search') || '').replace(/[%_,.()]/g, ' ').trim();

    const supabase = await createClient();

    if (searchParams.get('suggestions') === '1') {
      const category = (searchParams.get('category') || '').trim();
      let suggestionQuery = supabase
        .from('pro_crm_expenses')
        .select('description, note')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })
        .limit(500);
      if (category) suggestionQuery = suggestionQuery.eq('category', category);
      const { data, error: suggestionError } = await suggestionQuery;
      if (suggestionError) return NextResponse.json({ error: suggestionError.message || 'Failed to load descriptions' }, { status: 500 });
      const seen = new Set<string>();
      const descriptions: string[] = [];
      for (const row of data ?? []) {
        for (const raw of [row.description, row.note]) {
          const text = (raw ?? '').trim();
          if (!text) continue;
          const key = text.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          descriptions.push(text);
        }
      }
      descriptions.sort((a, b) => a.localeCompare(b));
      return NextResponse.json({ descriptions });
    }

    const orderColumn = VALID_SORT.includes(sortBy) ? sortBy : 'expense_date';

    let query = supabase
      .from('pro_crm_expenses')
      .select('*', { count: 'exact' })
      .eq('owner_id', user.id)
      .order(orderColumn, { ascending: sortDir === 'asc' });

    if (projectId) query = query.eq('project_id', projectId);
    if (search) query = query.or(`note.ilike.%${search}%,category.ilike.%${search}%,description.ilike.%${search}%,po_number.ilike.%${search}%`);

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data: expenses, error: fetchError, count } = await query.range(from, to);

    if (fetchError) return NextResponse.json({ error: fetchError.message || 'Failed to fetch expenses' }, { status: 500 });

    const names = await supplierNamesById(
      supabase,
      (expenses ?? []).map((row) => row.supplier_id).filter((id): id is string => Boolean(id))
    );
    const rows = (expenses ?? []).map((row) => ({
      ...row,
      supplier_name: row.supplier_id ? names.get(row.supplier_id) ?? null : null,
    }));

    let chart: ExpenseChart | null = null;
    if (searchParams.get('chart') === '1') {
      const timeZone = safeTimeZone(searchParams.get('timeZone'));
      let chartQuery = supabase
        .from('pro_crm_expenses')
        .select('amount_cents, expense_date, category')
        .eq('owner_id', user.id)
        .limit(2000);
      if (projectId) chartQuery = chartQuery.eq('project_id', projectId);
      if (search) chartQuery = chartQuery.or(`note.ilike.%${search}%,category.ilike.%${search}%,description.ilike.%${search}%,po_number.ilike.%${search}%`);
      const [{ data: chartRows, error: chartError }, { data: paymentRows, error: paymentError }] = await Promise.all([
        chartQuery,
        supabase
          .from('pro_crm_invoice_payments')
          .select('amount_cents, payment_date, voided_at')
          .eq('owner_id', user.id)
          .limit(2000),
      ]);
      if (chartError) return NextResponse.json({ error: chartError.message || 'Failed to load expense chart' }, { status: 500 });
      if (paymentError) return NextResponse.json({ error: paymentError.message || 'Failed to load payments' }, { status: 500 });
      chart = buildExpenseChart(
        (chartRows ?? []).map((row) => ({
          amountCents: row.amount_cents,
          expenseDate: row.expense_date,
          category: row.category ?? '',
        })),
        (paymentRows ?? []).map((row) => ({
          amountCents: row.amount_cents,
          paymentDate: row.payment_date,
          voided: Boolean(row.voided_at),
        })),
        { timeZone }
      );
    }

    return NextResponse.json({ expenses: rows, total: count ?? 0, page, pageSize, chart });
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
    const description = cleanExpenseText(body.description);
    const receiptUrl = typeof body.receiptUrl === 'string' ? body.receiptUrl.trim() || null : null;
    const projectId = body.projectId ?? body.project_id ?? null;

    const supabase = await createClient();
    if (projectId) {
      const { data: proj } = await supabase.from('pro_crm_projects').select('id').eq('id', projectId).eq('owner_id', user.id).single();
      if (!proj) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const requestedSupplier = body.supplierId ?? body.supplier_id ?? null;
    const supplier = categoryNeedsSupplier(category)
      ? await resolveOwnedSupplierId(supabase, user.id, requestedSupplier)
      : { id: null, error: null, status: 200 };
    if (supplier.error) return NextResponse.json({ error: supplier.error }, { status: supplier.status });
    const order = parseExpenseOrderFields(category, body);

    const { data: row, error } = await supabase
      .from('pro_crm_expenses')
      .insert({
        owner_id: user.id,
        project_id: projectId,
        amount_cents: amountCents,
        category,
        expense_date: expenseDate,
        note,
        description,
        supplier_id: supplier.id,
        po_number: order.po_number,
        quantity: order.quantity,
        unit: order.unit,
        requested_by: order.requested_by,
        ordered_by: order.ordered_by,
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
