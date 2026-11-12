import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasRole } from '@/lib/utils/roles';
import { applyCompanyDisplay, sanitizeCompanyDisplay } from '@/lib/invoices/companyDisplay';
import { getDefaultCompanyForInvoice } from '@/lib/invoices/defaultCompany';
import { resolveInvoiceDueDate } from '@/lib/invoices/invoiceDueOnReceipt';
import { syncBilledExpenses } from '@/lib/crm/job-costs';
import { parsePaidNow, settleInvoicePaidInFull } from '@/lib/crm/invoice-payments';
import { getPublicSiteUrlForEmail } from '@/lib/utils/publicSiteUrl';

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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError, user } = await requireContractor();
    if (authError || !user) return authError;

    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Invoice ID required' }, { status: 400 });

    const supabase = await createClient();
    const { data: row, error } = await supabase
      .from('pro_crm_invoices')
      .select('*')
      .eq('id', id)
      .eq('owner_id', user.id)
      .single();

    if (error || !row) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    const { data: customer } = await supabase
      .from('pro_crm_customers')
      .select('id, first_name, last_name, display_name, company_name, email, billing_address_street_1, billing_address_street_2, billing_address_city, billing_address_state, billing_address_zip_code, billing_address_country, street_address, city, state, zip_code')
      .eq('id', row.customer_id)
      .single();

    let business: {
      id: string;
      business_name: string;
      business_logo: string | null;
      email: string | null;
      phone: string | null;
      address: string | null;
      company_tagline?: string | null;
      website?: string;
    } | null = null;
    const businessId = row.business_id;
    if (businessId) {
      const { data: biz } = await supabase
        .from('businesses')
        .select('id, business_name, business_logo, email, phone, business_address_id, links')
        .eq('id', businessId)
        .single();
      if (biz) {
        let address: string | null = null;
        if (biz.business_address_id) {
          const { data: addr } = await supabase
            .from('addresses')
            .select('street_address, apartment, city, state, zip_code')
            .eq('id', biz.business_address_id)
            .single();
          if (addr) {
            const parts = [
              (addr as { street_address?: string }).street_address,
              (addr as { apartment?: string }).apartment,
              [(addr as { city?: string }).city, (addr as { state?: string }).state, (addr as { zip_code?: string }).zip_code].filter(Boolean).join(', '),
            ].filter(Boolean);
            address = parts.join('\n');
          }
        }
        const { data: invSettings } = await supabase
          .from('pro_invoice_settings')
          .select('company_tagline')
          .eq('owner_id', user.id)
          .single();
        const links = biz.links as { website?: string } | null | undefined;
        business = {
          id: biz.id,
          business_name: biz.business_name,
          business_logo: biz.business_logo,
          email: biz.email,
          phone: biz.phone,
          address,
          company_tagline: (invSettings as { company_tagline?: string } | null)?.company_tagline ?? null,
          website: links?.website ?? undefined,
        };
      }
    }
    if (!business) {
      business = await getDefaultCompanyForInvoice(supabase, user.id);
    }
    if (!business) {
      business = {
        id: '',
        business_name: 'My Business',
        business_logo: null,
        email: null,
        phone: null,
        address: null,
        company_tagline: null,
        website: undefined,
      };
    }
    applyCompanyDisplay(business as unknown as Record<string, unknown>, row.company_display);

    const { data: invSettings } = await supabase
      .from('pro_invoice_settings')
      .select('theme_color_hex')
      .eq('owner_id', user.id)
      .single();
    const themeColorHex = (invSettings as { theme_color_hex?: string } | null)?.theme_color_hex ?? '#000000';

    const { data: paymentRows } = await supabase
      .from('pro_crm_invoice_payments')
      .select('id, amount_cents, payment_date, method, reference, note, voided_at, created_at')
      .eq('invoice_id', id)
      .order('payment_date', { ascending: false });

    const { data: eventRows } = await supabase
      .from('pro_crm_document_events')
      .select('id, action, payload, created_at')
      .eq('invoice_id', id)
      .order('created_at', { ascending: false })
      .limit(20);

    const { data: attachmentRows } = await supabase
      .from('pro_crm_invoice_attachments')
      .select('id, file_name, file_path, file_size_bytes, content_type, created_at')
      .eq('invoice_id', id)
      .order('created_at', { ascending: true });
    const attachments = (attachmentRows ?? []).map((a) => {
      const { data: { publicUrl } } = supabase.storage.from('invoice-attachments').getPublicUrl(a.file_path);
      return {
        id: a.id,
        fileName: a.file_name,
        url: publicUrl,
        fileSizeBytes: a.file_size_bytes,
        contentType: a.content_type,
        createdAt: a.created_at,
      };
    });

    return NextResponse.json({
      id: row.id,
      invoiceNumber: row.invoice_number,
      amountCents: row.amount_cents,
      paymentAppliedCents: row.payment_applied_cents,
      lineItems: row.line_items,
      status: row.status,
      invoiceDate: row.invoice_date,
      dueDate: resolveInvoiceDueDate(row.invoice_date, row.due_date, row.payment_terms),
      paymentTerms: row.payment_terms,
      note: row.note,
      customerId: row.customer_id,
      estimateId: row.estimate_id,
      businessId: row.business_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      themeColorHex,
      customerEmail: (customer as { email?: string | null } | null)?.email ?? null,
      customer: customer
        ? {
            first_name: customer.first_name,
            last_name: customer.last_name,
            display_name: (customer as { display_name?: string | null }).display_name ?? null,
            company_name: customer.company_name,
            billing_address: [
              customer.billing_address_street_1,
              customer.billing_address_street_2,
              [customer.billing_address_city, customer.billing_address_state, customer.billing_address_zip_code].filter(Boolean).join(', '),
              customer.billing_address_country,
            ]
              .filter(Boolean)
              .join('\n') || null,
            street_address: customer.street_address,
            city: customer.city,
            state: customer.state,
            zip_code: customer.zip_code,
          }
        : null,
      business: business ?? null,
      companyDisplay: row.company_display ?? null,
      attachments,
      payments: paymentRows ?? [],
      events: eventRows ?? [],
    });
  } catch (err) {
    console.error('GET /api/crm/invoices/[id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError, user } = await requireContractor();
    if (authError || !user) return authError;

    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Invoice ID required' }, { status: 400 });

    const body = await request.json();
    const updates: Record<string, unknown> = {};
    if (body.amountCents !== undefined) updates.amount_cents = typeof body.amountCents === 'number' ? body.amountCents : Math.round(parseFloat(String(body.amountCents)) * 100) || 0;
    if (body.lineItems !== undefined) updates.line_items = body.lineItems;
    if (body.status === 'paid' || body.status === 'partial') {
      return NextResponse.json({ error: 'Record a payment to change this status' }, { status: 400 });
    }
    if (body.status === 'cancelled') {
      return NextResponse.json({ error: 'Cancel the invoice when it has no payments' }, { status: 400 });
    }
    if (body.status === 'draft' || body.status === 'sent' || body.status === 'overdue') updates.status = body.status;
    if (body.invoiceDate !== undefined) updates.invoice_date = body.invoiceDate || new Date().toISOString().slice(0, 10);
    if (body.dueDate !== undefined) updates.due_date = body.dueDate || null;
    if (body.paymentTerms !== undefined) updates.payment_terms = body.paymentTerms === null || body.paymentTerms === '' ? null : String(body.paymentTerms);
    if (body.note !== undefined) updates.note = typeof body.note === 'string' ? body.note.trim() || null : null;
    if (body.customerId !== undefined) {
      const supabase = await createClient();
      const { data: customer } = await supabase
        .from('pro_crm_customers')
        .select('id')
        .eq('id', body.customerId)
        .eq('owner_id', user.id)
        .single();
      if (customer) updates.customer_id = body.customerId;
    }
    if (body.businessId !== undefined) updates.business_id = body.businessId || null;
    if (body.companyDisplay !== undefined) updates.company_display = sanitizeCompanyDisplay(body.companyDisplay);

    const supabase = await createClient();
    const paidNow = parsePaidNow(body);
    if ('error' in paidNow) return NextResponse.json({ error: paidNow.error }, { status: 400 });

    const { error } = await supabase
      .from('pro_crm_invoices')
      .update(updates)
      .eq('id', id)
      .eq('owner_id', user.id);

    if (error) return NextResponse.json({ error: error.message || 'Failed to update invoice' }, { status: 500 });

    if (body.lineItems !== undefined) {
      const synced = await syncBilledExpenses(supabase, user.id, id, body.lineItems);
      if (synced.error) return NextResponse.json({ error: synced.error }, { status: 400 });
    }

    if (paidNow.paidNow) {
      const settled = await settleInvoicePaidInFull(supabase, user.id, id, paidNow.method, {
        baseUrl: getPublicSiteUrlForEmail(request),
        locale: request.headers.get('x-next-intl-locale') || 'en',
      });
      if ('error' in settled && settled.error) return NextResponse.json({ error: settled.error }, { status: 400 });
      return NextResponse.json({ ok: true, receipt: 'receipt' in settled ? settled.receipt : null });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/crm/invoices/[id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError, user } = await requireContractor();
    if (authError || !user) return authError;

    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Invoice ID required' }, { status: 400 });

    const supabase = await createClient();
    const { data: row } = await supabase
      .from('pro_crm_invoices')
      .select('status, payment_applied_cents')
      .eq('id', id)
      .eq('owner_id', user.id)
      .single();
    if (row && (row.status !== 'draft' || row.payment_applied_cents > 0)) {
      return NextResponse.json({ error: 'Only draft invoices with no payments can be deleted' }, { status: 400 });
    }

    const { error } = await supabase
      .from('pro_crm_invoices')
      .delete()
      .eq('id', id)
      .eq('owner_id', user.id);

    if (error) return NextResponse.json({ error: error.message || 'Failed to delete invoice' }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/crm/invoices/[id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
