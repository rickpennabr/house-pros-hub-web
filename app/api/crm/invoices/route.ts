import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasRole } from '@/lib/utils/roles';
import { sanitizeCompanyDisplay } from '@/lib/invoices/companyDisplay';
import { getNextInvoiceNumber } from '@/lib/crm/invoice-number';
import { PRO_INVOICE_STATUSES, type ProInvoiceStatus } from '@/lib/crm/invoice-books';

async function requireContractor() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null };
  }
  const isContractor = await hasRole(user.id, 'contractor');
  if (!isContractor) {
    return {
      error: NextResponse.json({ error: 'Forbidden - Contractor access required' }, { status: 403 }),
      user: null,
    };
  }
  return { error: null, user };
}

const VALID_SORT = ['created_at', 'updated_at', 'status', 'invoice_date', 'due_date', 'amount_cents', 'invoice_number'] as const;

export async function GET(request: NextRequest) {
  try {
    const { error: authError, user } = await requireContractor();
    if (authError || !user) return authError;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '25', 10)));
    const sortBy = (searchParams.get('sortBy') || 'created_at') as (typeof VALID_SORT)[number];
    const sortDir = (searchParams.get('sortDir') || 'desc') as 'asc' | 'desc';
    const statusFilter = searchParams.get('status') || '';

    const supabase = await createClient();
    const orderColumn = VALID_SORT.includes(sortBy) ? sortBy : 'created_at';

    let query = supabase
      .from('pro_crm_invoices')
      .select('*', { count: 'exact' })
      .eq('owner_id', user.id)
      .order(orderColumn, { ascending: sortDir === 'asc' });

    if (statusFilter && (PRO_INVOICE_STATUSES as readonly string[]).includes(statusFilter)) {
      query = query.eq('status', statusFilter as ProInvoiceStatus);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data: invoices, error: fetchError, count } = await query.range(from, to);

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message || 'Failed to fetch invoices' }, { status: 500 });
    }

    const list = invoices ?? [];
    const customerIds = [...new Set(list.map((i) => i.customer_id))];
    const customerMap = new Map<string, { first_name: string; last_name: string }>();
    if (customerIds.length > 0) {
      const { data: customers } = await supabase
        .from('pro_crm_customers')
        .select('id, first_name, last_name')
        .in('id', customerIds);
      customers?.forEach((c) => customerMap.set(c.id, { first_name: c.first_name, last_name: c.last_name }));
    }

    const withCustomers = list.map((inv) => {
      const c = customerMap.get(inv.customer_id);
      return {
        ...inv,
        customerFirstName: c?.first_name ?? null,
        customerLastName: c?.last_name ?? null,
      };
    });

    return NextResponse.json({ invoices: withCustomers, total: count ?? 0, page, pageSize });
  } catch (err) {
    console.error('GET /api/crm/invoices', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { error: authError, user } = await requireContractor();
    if (authError || !user) return authError;

    const body = await request.json();
    const supabase = await createClient();

    if (body.estimateId != null) {
      const estimateId = String(body.estimateId);
      const { data: estimate, error: estErr } = await supabase
        .from('pro_crm_estimates')
        .select('*')
        .eq('id', estimateId)
        .eq('owner_id', user.id)
        .single();

      if (estErr || !estimate) {
        return NextResponse.json({ error: 'Estimate not found' }, { status: 404 });
      }
      const { data: existingInvoice } = await supabase
        .from('pro_crm_invoices')
        .select('id')
        .eq('owner_id', user.id)
        .eq('estimate_id', estimateId)
        .limit(1)
        .maybeSingle();
      if (existingInvoice) {
        return NextResponse.json({ error: 'This estimate was already converted to an invoice' }, { status: 409 });
      }

      const invoiceNumber = await getNextInvoiceNumber(supabase, user.id);
      const { data: settings } = await supabase
        .from('pro_invoice_settings')
        .select('default_business_id')
        .eq('owner_id', user.id)
        .single();

      const businessId = (settings as { default_business_id?: string } | null)?.default_business_id ?? null;

      const invoiceDate = new Date().toISOString().slice(0, 10);

      const { data: row, error } = await supabase
        .from('pro_crm_invoices')
        .insert({
          owner_id: user.id,
          customer_id: estimate.customer_id,
          estimate_id: estimateId,
          business_id: businessId || null,
          invoice_number: invoiceNumber,
          amount_cents: estimate.amount_cents,
          payment_applied_cents: 0,
          line_items: estimate.line_items,
          status: 'draft',
          invoice_date: invoiceDate,
          due_date: invoiceDate,
          payment_terms: null,
          note: estimate.note,
          converted_from_estimate_at: new Date().toISOString(),
          converted_from_estimate_by: user.id,
        })
        .select('id, display_id, invoice_number, created_at')
        .single();

      if (error) {
        return NextResponse.json({ error: error.message || 'Failed to create invoice' }, { status: 500 });
      }
      return NextResponse.json({ id: row.id, display_id: row.display_id, invoice_number: row.invoice_number, created_at: row.created_at }, { status: 201 });
    }

    const customerId = body.customerId ?? body.customer_id;
    if (!customerId || typeof customerId !== 'string') {
      return NextResponse.json({ error: 'Customer is required' }, { status: 400 });
    }

    const { data: customer } = await supabase
      .from('pro_crm_customers')
      .select('id')
      .eq('id', customerId)
      .eq('owner_id', user.id)
      .single();
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const invoiceNumber = await getNextInvoiceNumber(supabase, user.id);
    const { data: settings } = await supabase
      .from('pro_invoice_settings')
      .select('default_business_id')
      .eq('owner_id', user.id)
      .single();
    const businessId = (settings as { default_business_id?: string } | null)?.default_business_id ?? null;

    const amountCents = typeof body.amountCents === 'number' ? body.amountCents : Math.round(parseFloat(String(body.amountCents || 0)) * 100) || 0;
    const lineItems = body.lineItems ?? body.line_items ?? null;
    const invoiceDate = body.invoiceDate ?? body.invoice_date ?? new Date().toISOString().slice(0, 10);
    const dueDateRaw = body.dueDate ?? body.due_date;
    const dueDate =
      typeof dueDateRaw === 'string' && dueDateRaw.trim() !== ''
        ? dueDateRaw.trim().slice(0, 10)
        : invoiceDate;
    const paymentTerms = body.paymentTerms ?? body.payment_terms ?? null;
    const note = typeof body.note === 'string' ? body.note.trim() || null : null;
    const companyDisplay = sanitizeCompanyDisplay(body.companyDisplay);

    const { data: row, error } = await supabase
      .from('pro_crm_invoices')
      .insert({
        owner_id: user.id,
        customer_id: customerId,
        estimate_id: null,
        business_id: businessId || null,
        invoice_number: invoiceNumber,
        amount_cents: amountCents,
        payment_applied_cents: 0,
        line_items: lineItems,
        status: 'draft',
        invoice_date: invoiceDate,
        due_date: dueDate,
        payment_terms: paymentTerms,
        note,
        company_display: companyDisplay,
      })
      .select('id, display_id, invoice_number, created_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to create invoice' }, { status: 500 });
    }
    return NextResponse.json({ id: row.id, display_id: row.display_id, invoice_number: row.invoice_number, created_at: row.created_at }, { status: 201 });
  } catch (err) {
    console.error('POST /api/crm/invoices', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
