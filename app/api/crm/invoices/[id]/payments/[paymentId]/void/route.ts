import { NextRequest, NextResponse } from 'next/server';
import { requireContractor } from '@/lib/crm/require-contractor';
import { voidInvoicePayment } from '@/lib/crm/invoice-payments';

/**
 * POST /api/crm/invoices/[id]/payments/[paymentId]/void
 * Voids a payment and recalculates the invoice balance and status.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  try {
    const { error: authError, user, supabase } = await requireContractor();
    if (authError || !user) return authError;

    const { id, paymentId } = await params;
    if (!id || !paymentId) return NextResponse.json({ error: 'Payment ID required' }, { status: 400 });

    const result = await voidInvoicePayment(supabase, user.id, id, paymentId);
    if ('error' in result && result.error) {
      const status = result.error === 'Invoice not found' || result.error === 'Payment not found' ? 404 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error('POST /api/crm/invoices/[id]/payments/[paymentId]/void', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
