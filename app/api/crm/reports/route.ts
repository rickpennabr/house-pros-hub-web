import { NextRequest, NextResponse } from 'next/server';
import { requireContractor } from '@/lib/crm/require-contractor';
import { agingBucket, todayDateKey, type AgingBucket } from '@/lib/crm/invoice-books';

function emptyAging(): Record<AgingBucket, number> {
  return { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, days90plus: 0 };
}

/**
 * GET /api/crm/reports?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Aging is as of today. Sales and cash use the date range.
 */
export async function GET(request: NextRequest) {
  try {
    const { error: authError, user, supabase } = await requireContractor();
    if (authError || !user) return authError;

    const { searchParams } = new URL(request.url);
    const today = todayDateKey();
    const from = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get('from') || '')
      ? (searchParams.get('from') as string)
      : `${today.slice(0, 4)}-01-01`;
    const to = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get('to') || '')
      ? (searchParams.get('to') as string)
      : today;

    const { data: invoices, error: invoiceError } = await supabase
      .from('pro_crm_invoices')
      .select('id, customer_id, invoice_number, amount_cents, payment_applied_cents, status, due_date, invoice_date')
      .eq('owner_id', user.id)
      .limit(1000);
    if (invoiceError) return NextResponse.json({ error: invoiceError.message }, { status: 500 });

    const { data: payments, error: paymentError } = await supabase
      .from('pro_crm_invoice_payments')
      .select('amount_cents, payment_date, voided_at')
      .eq('owner_id', user.id)
      .limit(2000);
    if (paymentError) return NextResponse.json({ error: paymentError.message }, { status: 500 });

    const { data: expenses, error: expenseError } = await supabase
      .from('pro_crm_expenses')
      .select('amount_cents, expense_date')
      .eq('owner_id', user.id)
      .gte('expense_date', from)
      .lte('expense_date', to)
      .limit(2000);
    if (expenseError) return NextResponse.json({ error: expenseError.message }, { status: 500 });

    const aging = emptyAging();
    const sales = new Map<string, number>();
    let outstandingCents = 0;

    for (const invoice of invoices ?? []) {
      if (invoice.status === 'cancelled' || invoice.status === 'draft') continue;
      const balance = Math.max(0, invoice.amount_cents - invoice.payment_applied_cents);
      if (balance > 0) {
        outstandingCents += balance;
        const bucket = agingBucket(invoice.due_date, today);
        aging[bucket] += balance;
      }
      if (invoice.invoice_date >= from && invoice.invoice_date <= to) {
        sales.set(invoice.customer_id, (sales.get(invoice.customer_id) ?? 0) + invoice.amount_cents);
      }
    }

    const customerIds = [...sales.keys()];
    const names = new Map<string, string>();
    if (customerIds.length > 0) {
      const { data: customers } = await supabase
        .from('pro_crm_customers')
        .select('id, first_name, last_name, display_name, company_name')
        .in('id', customerIds);
      for (const customer of customers ?? []) {
        const name =
          customer.display_name?.trim() ||
          customer.company_name?.trim() ||
          [customer.first_name, customer.last_name].filter(Boolean).join(' ') ||
          'Customer';
        names.set(customer.id, name);
      }
    }

    const salesByCustomer = [...sales.entries()]
      .map(([customerId, totalCents]) => ({
        customerId,
        name: names.get(customerId) ?? 'Customer',
        totalCents,
      }))
      .sort((a, b) => b.totalCents - a.totalCents);

    const collectedCents = (payments ?? []).reduce((sum, payment) => {
      if (payment.voided_at) return sum;
      if (payment.payment_date < from || payment.payment_date > to) return sum;
      return sum + payment.amount_cents;
    }, 0);
    const expenseCents = (expenses ?? []).reduce((sum, expense) => sum + expense.amount_cents, 0);

    return NextResponse.json({
      from,
      to,
      today,
      outstandingCents,
      aging,
      salesByCustomer,
      cash: {
        collectedCents,
        expenseCents,
        resultCents: collectedCents - expenseCents,
      },
    });
  } catch (err) {
    console.error('GET /api/crm/reports', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
