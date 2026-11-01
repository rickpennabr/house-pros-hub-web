import { NextRequest, NextResponse } from 'next/server';
import type { Json } from '@/lib/types/supabase';
import { requireContractor } from '@/lib/crm/require-contractor';
import { RECURRING_FREQUENCIES, type RecurringFrequency } from '@/lib/crm/invoice-books';

function isDateKey(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * GET /api/crm/invoices/recurring
 * POST clones a schedule from an existing invoice, or from the posted fields.
 */
export async function GET() {
  try {
    const { error: authError, user, supabase } = await requireContractor();
    if (authError || !user) return authError;

    const { data, error } = await supabase
      .from('pro_crm_recurring_invoices')
      .select('id, customer_id, frequency, next_run_date, end_date, is_active, amount_cents, payment_terms, note, created_at')
      .eq('owner_id', user.id)
      .order('next_run_date', { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const customerIds = [...new Set((data ?? []).map((row) => row.customer_id))];
    const names = new Map<string, string>();
    if (customerIds.length > 0) {
      const { data: customers } = await supabase
        .from('pro_crm_customers')
        .select('id, first_name, last_name, display_name')
        .in('id', customerIds);
      for (const customer of customers ?? []) {
        names.set(
          customer.id,
          customer.display_name?.trim() || [customer.first_name, customer.last_name].filter(Boolean).join(' ') || 'Customer'
        );
      }
    }

    return NextResponse.json({
      schedules: (data ?? []).map((row) => ({
        ...row,
        customerName: names.get(row.customer_id) ?? 'Customer',
      })),
    });
  } catch (err) {
    console.error('GET /api/crm/invoices/recurring', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { error: authError, user, supabase } = await requireContractor();
    if (authError || !user) return authError;

    const body = await request.json().catch(() => ({}));
    const frequency = String(body.frequency ?? 'monthly') as RecurringFrequency;
    if (!RECURRING_FREQUENCIES.includes(frequency)) {
      return NextResponse.json({ error: 'Choose how often this invoice repeats' }, { status: 400 });
    }
    if (!isDateKey(body.nextRunDate)) {
      return NextResponse.json({ error: 'Choose the next invoice date' }, { status: 400 });
    }
    const endDate = body.endDate == null || body.endDate === '' ? null : body.endDate;
    if (endDate != null && !isDateKey(endDate)) {
      return NextResponse.json({ error: 'End date is not valid' }, { status: 400 });
    }
    if (endDate && endDate < body.nextRunDate) {
      return NextResponse.json({ error: 'End date is before the next invoice' }, { status: 400 });
    }

    let customerId = typeof body.customerId === 'string' ? body.customerId : '';
    let businessId: string | null = typeof body.businessId === 'string' ? body.businessId : null;
    let amountCents = typeof body.amountCents === 'number' ? Math.round(body.amountCents) : 0;
    let lineItems: Json | null = (body.lineItems ?? null) as Json | null;
    let paymentTerms: string | null = typeof body.paymentTerms === 'string' ? body.paymentTerms : null;
    let note: string | null = typeof body.note === 'string' ? body.note.trim() || null : null;

    if (typeof body.invoiceId === 'string' && body.invoiceId) {
      const { data: invoice, error } = await supabase
        .from('pro_crm_invoices')
        .select('customer_id, business_id, amount_cents, line_items, payment_terms, note, status')
        .eq('id', body.invoiceId)
        .eq('owner_id', user.id)
        .single();
      if (error || !invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
      if (invoice.status === 'cancelled') {
        return NextResponse.json({ error: 'A cancelled invoice cannot repeat' }, { status: 400 });
      }
      customerId = invoice.customer_id;
      businessId = invoice.business_id;
      amountCents = invoice.amount_cents;
      lineItems = invoice.line_items;
      paymentTerms = invoice.payment_terms;
      note = invoice.note;
    }

    if (!customerId) return NextResponse.json({ error: 'Customer is required' }, { status: 400 });
    const { data: customer } = await supabase
      .from('pro_crm_customers')
      .select('id')
      .eq('id', customerId)
      .eq('owner_id', user.id)
      .single();
    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

    const { data: row, error } = await supabase
      .from('pro_crm_recurring_invoices')
      .insert({
        owner_id: user.id,
        customer_id: customerId,
        business_id: businessId,
        frequency,
        next_run_date: body.nextRunDate,
        end_date: endDate,
        is_active: true,
        amount_cents: amountCents,
        line_items: lineItems,
        payment_terms: paymentTerms,
        note,
      })
      .select('id')
      .single();
    if (error || !row) return NextResponse.json({ error: error?.message || 'Could not save the schedule' }, { status: 500 });
    return NextResponse.json({ id: row.id }, { status: 201 });
  } catch (err) {
    console.error('POST /api/crm/invoices/recurring', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
