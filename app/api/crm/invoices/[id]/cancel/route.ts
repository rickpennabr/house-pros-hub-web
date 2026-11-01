import { NextRequest, NextResponse } from 'next/server';
import { requireContractor } from '@/lib/crm/require-contractor';
import { activePaidCents, canCancelInvoice } from '@/lib/crm/invoice-books';

/**
 * POST /api/crm/invoices/[id]/cancel
 * Cancels an invoice that has no active payments.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError, user, supabase } = await requireContractor();
    if (authError || !user) return authError;

    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Invoice ID required' }, { status: 400 });

    const { data: invoice, error } = await supabase
      .from('pro_crm_invoices')
      .select('id, status')
      .eq('id', id)
      .eq('owner_id', user.id)
      .single();
    if (error || !invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    const { data: payments, error: paymentsError } = await supabase
      .from('pro_crm_invoice_payments')
      .select('amount_cents, voided_at')
      .eq('invoice_id', id);
    if (paymentsError) return NextResponse.json({ error: paymentsError.message }, { status: 500 });

    const active = (payments ?? []).filter((payment) => !payment.voided_at);
    if (!canCancelInvoice(invoice.status, active.length) || activePaidCents(payments ?? []) > 0) {
      return NextResponse.json(
        { error: 'Void the payments before cancelling this invoice' },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from('pro_crm_invoices')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .eq('owner_id', user.id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    await supabase.from('pro_crm_document_events').insert({
      owner_id: user.id,
      invoice_id: id,
      actor_id: user.id,
      action: 'cancelled',
      payload: {},
    });

    return NextResponse.json({ ok: true, status: 'cancelled' });
  } catch (err) {
    console.error('POST /api/crm/invoices/[id]/cancel', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
