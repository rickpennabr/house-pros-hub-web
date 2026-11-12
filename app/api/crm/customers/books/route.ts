import { NextResponse } from 'next/server';
import { requireContractor } from '@/lib/crm/require-contractor';
import { summarizeBooks } from '@/lib/crm/contact-books';

/**
 * GET /api/crm/customers/books
 * Estimates still open, unpaid invoices, overdue balances, and payments from the last 30 days.
 */
export async function GET() {
  try {
    const { error: authError, user, supabase } = await requireContractor();
    if (authError || !user) return authError;

    const today = new Date().toISOString().slice(0, 10);
    const [invoicesResult, estimatesResult, paymentsResult] = await Promise.all([
      supabase
        .from('pro_crm_invoices')
        .select('status, amount_cents, payment_applied_cents')
        .eq('owner_id', user.id)
        .limit(2000),
      supabase
        .from('pro_crm_estimates')
        .select('status, amount_cents')
        .eq('owner_id', user.id)
        .limit(2000),
      supabase
        .from('pro_crm_invoice_payments')
        .select('amount_cents, payment_date, voided_at')
        .eq('owner_id', user.id)
        .limit(2000),
    ]);

    const error = invoicesResult.error || estimatesResult.error || paymentsResult.error;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const summary = summarizeBooks(
      (invoicesResult.data ?? []).map((row) => ({
        status: row.status,
        amountCents: row.amount_cents,
        paidCents: row.payment_applied_cents,
      })),
      (estimatesResult.data ?? []).map((row) => ({
        status: row.status,
        amountCents: row.amount_cents,
      })),
      (paymentsResult.data ?? []).map((row) => ({
        amountCents: row.amount_cents,
        paymentDate: row.payment_date,
        voided: Boolean(row.voided_at),
      })),
      today
    );

    return NextResponse.json(summary);
  } catch (err) {
    console.error('GET /api/crm/customers/books', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
