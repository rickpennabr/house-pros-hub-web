import { NextRequest, NextResponse } from 'next/server';
import { requireContractor } from '@/lib/crm/require-contractor';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/crm/expenses/unbilled?customerId=&invoiceId=
 * Project costs for this customer that are not on another invoice.
 * Costs already on `invoiceId` are included so the editor can keep them checked.
 */
export async function GET(request: NextRequest) {
  try {
    const { error: authError, user, supabase } = await requireContractor();
    if (authError || !user) return authError;

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId') || '';
    const invoiceId = searchParams.get('invoiceId') || '';
    if (!UUID.test(customerId)) return NextResponse.json({ error: 'Customer is required' }, { status: 400 });
    if (invoiceId && !UUID.test(invoiceId)) return NextResponse.json({ error: 'Invoice is invalid' }, { status: 400 });

    const { data: projects, error: projectError } = await supabase
      .from('pro_crm_projects')
      .select('id, name')
      .eq('owner_id', user.id)
      .eq('customer_id', customerId);
    if (projectError) return NextResponse.json({ error: projectError.message }, { status: 500 });

    const projectIds = (projects ?? []).map((project) => project.id);
    if (projectIds.length === 0) return NextResponse.json({ expenses: [] });

    let query = supabase
      .from('pro_crm_expenses')
      .select('id, amount_cents, category, description, note, expense_date, po_number, quantity, unit, project_id, billed_invoice_id')
      .eq('owner_id', user.id)
      .in('project_id', projectIds)
      .order('expense_date', { ascending: false });
    query = invoiceId
      ? query.or(`billed_invoice_id.is.null,billed_invoice_id.eq.${invoiceId}`)
      : query.is('billed_invoice_id', null);

    const { data, error } = await query.limit(200);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const names = new Map((projects ?? []).map((project) => [project.id, project.name]));
    return NextResponse.json({
      expenses: (data ?? []).map((row) => ({
        id: row.id,
        amountCents: row.amount_cents,
        category: row.category,
        description: row.description,
        note: row.note,
        expenseDate: row.expense_date,
        poNumber: row.po_number,
        quantity: row.quantity,
        unit: row.unit,
        projectName: row.project_id ? names.get(row.project_id) ?? null : null,
        billedHere: Boolean(invoiceId) && row.billed_invoice_id === invoiceId,
      })),
    });
  } catch (err) {
    console.error('GET /api/crm/expenses/unbilled', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
