import { NextRequest, NextResponse } from 'next/server';
import { requireContractor } from '@/lib/crm/require-contractor';
import { PAYMENT_METHODS, todayDateKey, type PaymentMethod } from '@/lib/crm/invoice-books';
import { recordInvoicePayment } from '@/lib/crm/invoice-payments';

/**
 * POST /api/crm/invoices/[id]/payments
 * Records a payment against the balance and updates invoice status.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError, user, supabase } = await requireContractor();
    if (authError || !user) return authError;

    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Invoice ID required' }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const amountCents =
      typeof body.amountCents === 'number'
        ? Math.round(body.amountCents)
        : Math.round(parseFloat(String(body.amount ?? body.amountCents ?? '')) * 100);
    const method = String(body.method ?? 'other') as PaymentMethod;
    if (!PAYMENT_METHODS.includes(method)) {
      return NextResponse.json({ error: 'Choose a payment method' }, { status: 400 });
    }
    const paymentDate =
      typeof body.paymentDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.paymentDate)
        ? body.paymentDate
        : todayDateKey();
    const reference = typeof body.reference === 'string' ? body.reference.trim() || null : null;
    const note = typeof body.note === 'string' ? body.note.trim() || null : null;

    const result = await recordInvoicePayment(supabase, user.id, id, {
      amountCents,
      paymentDate,
      method,
      reference,
      note,
    });
    if ('error' in result && result.error) {
      const status = result.error === 'Invoice not found' ? 404 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error('POST /api/crm/invoices/[id]/payments', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
