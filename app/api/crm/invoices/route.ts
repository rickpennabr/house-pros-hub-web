import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasRole } from '@/lib/utils/roles';
import { sanitizeCompanyDisplay } from '@/lib/invoices/companyDisplay';
import { getNextInvoiceNumber } from '@/lib/crm/invoice-number';
import { PRO_INVOICE_STATUSES, type PaymentMethod, type ProInvoiceStatus } from '@/lib/crm/invoice-books';
import { contactCanBeInvoiced } from '@/lib/crm/contact-role';
import { contactDisplayName } from '@/lib/crm/contact-name';
import { syncBilledExpenses } from '@/lib/crm/job-costs';
import { parsePaidNow, settleInvoicePaidInFull } from '@/lib/crm/invoice-payments';
import { buildProgressInvoice, contractBilledCents } from '@/lib/crm/progress-billing';
import { getPublicSiteUrlForEmail } from '@/lib/utils/publicSiteUrl';
import type { Json } from '@/lib/types/supabase';

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
    const search = (searchParams.get('search') || '').replace(/[%_,.()]/g, ' ').trim();

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

    if (search) {
      const { data: matchingCustomers } = await supabase
        .from('pro_crm_customers')
        .select('id')
        .eq('owner_id', user.id)
        .or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,display_name.ilike.%${search}%,company_name.ilike.%${search}%`);
      const ids = (matchingCustomers ?? []).map((customer) => customer.id);
      const parts = [`invoice_number.ilike.%${search}%`];
      if (ids.length > 0) parts.push(`customer_id.in.(${ids.join(',')})`);
      query = query.or(parts.join(','));
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data: invoices, error: fetchError, count } = await query.range(from, to);

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message || 'Failed to fetch invoices' }, { status: 500 });
    }

    const list = invoices ?? [];
    const customerIds = [...new Set(list.map((i) => i.customer_id))];
    const customerMap = new Map<string, {
      first_name: string;
      last_name: string;
      display_name: string | null;
      company_name: string | null;
      street_address: string | null;
      apartment: string | null;
      city: string | null;
      state: string | null;
      zip_code: string | null;
      billing_address_street_1: string | null;
      billing_address_street_2: string | null;
      billing_address_city: string | null;
      billing_address_state: string | null;
      billing_address_zip_code: string | null;
    }>();
    if (customerIds.length > 0) {
      const { data: customers } = await supabase
        .from('pro_crm_customers')
        .select('id, first_name, last_name, display_name, company_name, street_address, apartment, city, state, zip_code, billing_address_street_1, billing_address_street_2, billing_address_city, billing_address_state, billing_address_zip_code')
        .in('id', customerIds);
      customers?.forEach((c) => customerMap.set(c.id, c));
    }

    const withCustomers = list.map((inv) => {
      const c = customerMap.get(inv.customer_id);
      const home = [c?.street_address, c?.apartment, c?.city, c?.state, c?.zip_code]
        .map((part) => part?.trim() ?? '')
        .filter(Boolean)
        .join(', ');
      const billing = [
        c?.billing_address_street_1,
        c?.billing_address_street_2,
        c?.billing_address_city,
        c?.billing_address_state,
        c?.billing_address_zip_code,
      ]
        .map((part) => part?.trim() ?? '')
        .filter(Boolean)
        .join(', ');
      return {
        ...inv,
        customerFirstName: c?.first_name ?? null,
        customerLastName: c?.last_name ?? null,
        customerDisplayName: c ? contactDisplayName(c) : null,
        customerAddress: home || billing,
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
    const paidNow = parsePaidNow(body);
    if ('error' in paidNow) return NextResponse.json({ error: paidNow.error }, { status: 400 });

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
      const { data: priorInvoices, error: priorError } = await supabase
        .from('pro_crm_invoices')
        .select('status, amount_cents')
        .eq('owner_id', user.id)
        .eq('estimate_id', estimateId);
      if (priorError) return NextResponse.json({ error: priorError.message }, { status: 500 });

      const requestedRaw = body.amountCents;
      const requestedCents =
        requestedRaw == null || requestedRaw === ''
          ? null
          : Math.round(typeof requestedRaw === 'number' ? requestedRaw : Number(requestedRaw));
      const progress = buildProgressInvoice({
        contractCents: estimate.amount_cents,
        billedCents: contractBilledCents(priorInvoices ?? []),
        requestedCents,
        lineItems: estimate.line_items,
        note: estimate.note,
      });
      if ('error' in progress) {
        const status = progress.error === 'This estimate is fully billed' ? 409 : 400;
        return NextResponse.json({ error: progress.error }, { status });
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
          amount_cents: progress.amountCents,
          payment_applied_cents: 0,
          line_items: (progress.lineItems ?? null) as Json,
          status: 'draft',
          invoice_date: invoiceDate,
          due_date: invoiceDate,
          payment_terms: null,
          note: progress.note,
          converted_from_estimate_at: new Date().toISOString(),
          converted_from_estimate_by: user.id,
        })
        .select('id, display_id, invoice_number, created_at')
        .single();

      if (error) {
        const message = error.message.includes('idx_pro_crm_invoices_owner_estimate_unique')
          ? 'Run the progress billing database update before invoicing this estimate again.'
          : error.message || 'Failed to create invoice';
        return NextResponse.json({ error: message }, { status: 500 });
      }
      const finished = await finishNewInvoice(supabase, user.id, row.id, progress.lineItems, paidNow.paidNow ? paidNow.method : null, request);
      if (finished.error) return NextResponse.json({ error: finished.error }, { status: finished.status });
      return NextResponse.json({ id: row.id, display_id: row.display_id, invoice_number: row.invoice_number, created_at: row.created_at, receipt: finished.receipt ?? null }, { status: 201 });
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
    if (!(await contactCanBeInvoiced(supabase, customerId))) {
      return NextResponse.json({ error: 'This contact cannot be invoiced. Add a role that can be invoiced.' }, { status: 400 });
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
    const finished = await finishNewInvoice(supabase, user.id, row.id, lineItems, paidNow.paidNow ? paidNow.method : null, request);
    if (finished.error) return NextResponse.json({ error: finished.error }, { status: finished.status });
    return NextResponse.json({ id: row.id, display_id: row.display_id, invoice_number: row.invoice_number, created_at: row.created_at, receipt: finished.receipt ?? null }, { status: 201 });
  } catch (err) {
    console.error('POST /api/crm/invoices', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function finishNewInvoice(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string,
  invoiceId: string,
  lineItems: unknown,
  method: PaymentMethod | null,
  request: NextRequest
): Promise<{ error?: string; status: number; receipt?: string | null }> {
  const synced = await syncBilledExpenses(supabase, ownerId, invoiceId, lineItems);
  if (synced.error) {
    await supabase.from('pro_crm_invoices').delete().eq('id', invoiceId).eq('owner_id', ownerId);
    return { error: synced.error, status: 400 };
  }
  if (!method) return { status: 201 };
  const settled = await settleInvoicePaidInFull(supabase, ownerId, invoiceId, method, {
    baseUrl: getPublicSiteUrlForEmail(request),
    locale: request.headers.get('x-next-intl-locale') || 'en',
  });
  if ('error' in settled && settled.error) {
    await supabase.from('pro_crm_invoices').delete().eq('id', invoiceId).eq('owner_id', ownerId);
    return { error: settled.error, status: 400 };
  }
  return { status: 201, receipt: 'receipt' in settled ? settled.receipt : null };
}
