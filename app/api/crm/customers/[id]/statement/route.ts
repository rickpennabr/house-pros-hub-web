import { NextRequest, NextResponse } from 'next/server';
import { requireContractor } from '@/lib/crm/require-contractor';
import { contactDisplayName } from '@/lib/crm/contact-name';
import { sendStatementEmail } from '@/lib/services/emailService';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/supabase';

type Client = SupabaseClient<Database>;

const OPEN_STATUSES = ['sent', 'partial', 'paid', 'overdue'] as const;

async function loadStatement(supabase: Client, ownerId: string, customerId: string) {
  const { data: customer, error } = await supabase
    .from('pro_crm_customers')
    .select('id, email, first_name, last_name, display_name, company_name')
    .eq('id', customerId)
    .eq('owner_id', ownerId)
    .single();
  if (error || !customer) return { error: 'Customer not found' as const, status: 404 as const };

  const { data: invoices, error: invoiceError } = await supabase
    .from('pro_crm_invoices')
    .select('id, invoice_number, invoice_date, due_date, amount_cents, payment_applied_cents, status')
    .eq('owner_id', ownerId)
    .eq('customer_id', customerId)
    .in('status', [...OPEN_STATUSES])
    .order('due_date', { ascending: true });
  if (invoiceError) return { error: invoiceError.message, status: 500 as const };

  const lines = (invoices ?? [])
    .map((invoice) => ({
      id: invoice.id,
      invoiceNumber: invoice.invoice_number,
      invoiceDate: invoice.invoice_date,
      dueDate: invoice.due_date,
      amountCents: invoice.amount_cents,
      paidCents: invoice.payment_applied_cents,
      balanceCents: Math.max(0, invoice.amount_cents - invoice.payment_applied_cents),
      status: invoice.status,
    }))
    .filter((invoice) => invoice.balanceCents > 0);

  const { data: business } = await supabase
    .from('businesses')
    .select('business_name')
    .eq('owner_id', ownerId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  return {
    customerName: contactDisplayName(customer),
    email: customer.email,
    businessName: business?.business_name ?? 'Us',
    invoices: lines,
    totalCents: lines.reduce((sum, invoice) => sum + invoice.balanceCents, 0),
  };
}

/**
 * GET /api/crm/customers/[id]/statement
 * Open invoice balances for one customer.
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
    const statement = await loadStatement(supabase, user.id, id);
    if ('error' in statement) return NextResponse.json({ error: statement.error }, { status: statement.status });
    return NextResponse.json(statement);
  } catch (err) {
    console.error('GET /api/crm/customers/[id]/statement', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/crm/customers/[id]/statement
 * Emails the open balances to the customer.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError, user, supabase } = await requireContractor();
    if (authError || !user) return authError;
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Customer ID required' }, { status: 400 });
    const statement = await loadStatement(supabase, user.id, id);
    if ('error' in statement) return NextResponse.json({ error: statement.error }, { status: statement.status });
    if (!statement.email) return NextResponse.json({ error: 'This contact has no email address' }, { status: 400 });
    if (statement.invoices.length === 0) return NextResponse.json({ error: 'This contact has no open invoices' }, { status: 400 });

    const result = await sendStatementEmail(
      {
        businessName: statement.businessName,
        customerName: statement.customerName,
        totalCents: statement.totalCents,
        lines: statement.invoices.map((invoice) => ({
          invoiceNumber: invoice.invoiceNumber,
          dueDate: invoice.dueDate,
          balanceCents: invoice.balanceCents,
        })),
      },
      statement.email
    );
    if (!result.success) return NextResponse.json({ error: result.error || 'Could not send the statement' }, { status: 500 });
    return NextResponse.json({ ok: true, sentTo: statement.email });
  } catch (err) {
    console.error('POST /api/crm/customers/[id]/statement', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
