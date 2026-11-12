import { NextRequest, NextResponse } from 'next/server';
import { requireContractor } from '@/lib/crm/require-contractor';
import { buildContactActivity } from '@/lib/crm/contact-books';

/**
 * GET /api/crm/customers/[id]/activity
 * Open balance, overdue balance, and the contact's estimates, invoices, and payments.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError, user, supabase } = await requireContractor();
    if (authError || !user) return authError;
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Customer ID required' }, { status: 400 });

    const { data: customer, error: customerError } = await supabase
      .from('pro_crm_customers')
      .select('id')
      .eq('id', id)
      .eq('owner_id', user.id)
      .maybeSingle();
    if (customerError) return NextResponse.json({ error: customerError.message }, { status: 500 });
    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

    const [invoicesResult, estimatesResult] = await Promise.all([
      supabase
        .from('pro_crm_invoices')
        .select('id, invoice_number, display_id, status, amount_cents, payment_applied_cents, invoice_date')
        .eq('owner_id', user.id)
        .eq('customer_id', id)
        .order('invoice_date', { ascending: false })
        .limit(40),
      supabase
        .from('pro_crm_estimates')
        .select('id, display_id, status, amount_cents, created_at')
        .eq('owner_id', user.id)
        .eq('customer_id', id)
        .order('created_at', { ascending: false })
        .limit(40),
    ]);
    if (invoicesResult.error) return NextResponse.json({ error: invoicesResult.error.message }, { status: 500 });
    if (estimatesResult.error) return NextResponse.json({ error: estimatesResult.error.message }, { status: 500 });

    const invoices = invoicesResult.data ?? [];
    const invoiceIds = invoices.map((row) => row.id);
    const paymentsResult = invoiceIds.length
      ? await supabase
          .from('pro_crm_invoice_payments')
          .select('id, invoice_id, amount_cents, payment_date, method')
          .eq('owner_id', user.id)
          .in('invoice_id', invoiceIds)
          .is('voided_at', null)
          .order('payment_date', { ascending: false })
          .limit(40)
      : { data: [], error: null };
    if (paymentsResult.error) return NextResponse.json({ error: paymentsResult.error.message }, { status: 500 });

    const numberByInvoice = new Map(invoices.map((row) => [row.id, row.invoice_number || row.display_id]));
    const activity = buildContactActivity({
      invoices: invoices.map((row) => ({
        id: row.id,
        number: row.invoice_number || row.display_id,
        status: row.status,
        amountCents: row.amount_cents,
        paidCents: row.payment_applied_cents,
        date: row.invoice_date,
      })),
      estimates: (estimatesResult.data ?? []).map((row) => ({
        id: row.id,
        number: row.display_id,
        status: row.status,
        amountCents: row.amount_cents,
        date: row.created_at,
      })),
      payments: (paymentsResult.data ?? []).map((row) => ({
        id: row.id,
        invoiceId: row.invoice_id,
        invoiceNumber: numberByInvoice.get(row.invoice_id) || 'Invoice',
        amountCents: row.amount_cents,
        date: row.payment_date,
        method: row.method,
      })),
    });

    return NextResponse.json(activity);
  } catch (err) {
    console.error('GET /api/crm/customers/[id]/activity', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
