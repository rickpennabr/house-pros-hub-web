import { NextResponse } from 'next/server';
import { requireContractor } from '@/lib/crm/require-contractor';
import { contractBilledCents, contractRemainingCents } from '@/lib/crm/progress-billing';

/**
 * GET /api/crm/estimates/[id]/billing
 * Contract total, what invoices already hold, and what is still open.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError, user, supabase } = await requireContractor();
    if (authError || !user) return authError;

    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Estimate ID required' }, { status: 400 });

    const { data: estimate, error } = await supabase
      .from('pro_crm_estimates')
      .select('id, display_id, amount_cents, customer_id')
      .eq('id', id)
      .eq('owner_id', user.id)
      .single();
    if (error || !estimate) return NextResponse.json({ error: 'Estimate not found' }, { status: 404 });

    const { data: invoices, error: invoiceError } = await supabase
      .from('pro_crm_invoices')
      .select('id, invoice_number, amount_cents, status')
      .eq('owner_id', user.id)
      .eq('estimate_id', id)
      .order('created_at', { ascending: true });
    if (invoiceError) return NextResponse.json({ error: invoiceError.message }, { status: 500 });

    const billedCents = contractBilledCents(invoices ?? []);
    return NextResponse.json({
      estimateId: estimate.id,
      displayId: estimate.display_id,
      customerId: estimate.customer_id,
      contractCents: estimate.amount_cents,
      billedCents,
      remainingCents: contractRemainingCents(estimate.amount_cents, billedCents),
      invoices: invoices ?? [],
    });
  } catch (err) {
    console.error('GET /api/crm/estimates/[id]/billing', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
