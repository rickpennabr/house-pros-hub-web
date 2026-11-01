import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { applyCompanyDisplay } from '@/lib/invoices/companyDisplay';
import { resolveInvoiceDueDate } from '@/lib/invoices/invoiceDueOnReceipt';

/**
 * GET /api/invoices/public?token=uuid
 * Returns invoice data for public view. No auth. Token must be valid and not expired.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

    const supabase = createServiceRoleClient();
    const { data: tokenRow, error: tokenErr } = await supabase
      .from('pro_invoice_view_tokens')
      .select('invoice_id, expires_at')
      .eq('token', token)
      .single();

    if (tokenErr || !tokenRow) return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 });
    if (new Date(tokenRow.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This link has expired' }, { status: 404 });
    }

    const invoiceId = tokenRow.invoice_id;
    const { data: row, error } = await supabase
      .from('pro_crm_invoices')
      .select('*')
      .eq('id', invoiceId)
      .single();

    if (error || !row) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    const ownerId = row.owner_id;
    const { data: customer } = await supabase
      .from('pro_crm_customers')
      .select('first_name, last_name, display_name, company_name, billing_address_street_1, billing_address_street_2, billing_address_city, billing_address_state, billing_address_zip_code, billing_address_country, street_address, city, state, zip_code')
      .eq('id', row.customer_id)
      .single();

    let business: { business_name: string; business_logo: string | null; email: string | null; phone: string | null; address: string | null; company_tagline?: string | null; website?: string } = {
      business_name: 'My Business',
      business_logo: null,
      email: null,
      phone: null,
      address: null,
    };
    const businessId = row.business_id;
    if (businessId) {
      const { data: biz } = await supabase
        .from('businesses')
        .select('business_name, business_logo, email, phone, business_address_id, links')
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
            const a = addr as { street_address?: string; apartment?: string; city?: string; state?: string; zip_code?: string };
            address = [a.street_address, a.apartment, [a.city, a.state, a.zip_code].filter(Boolean).join(', ')].filter(Boolean).join('\n');
          }
        }
        const { data: invSettings } = await supabase
          .from('pro_invoice_settings')
          .select('company_tagline')
          .eq('owner_id', ownerId)
          .single();
        const links = biz.links as { website?: string } | null | undefined;
        business = {
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
    if (business.business_name === 'My Business') {
      const { data: firstBiz } = await supabase
        .from('businesses')
        .select('business_name, business_logo, email, phone, business_address_id, links')
        .eq('owner_id', ownerId)
        .eq('is_active', true)
        .limit(1)
        .single();
      if (firstBiz) {
        let address: string | null = null;
        if (firstBiz.business_address_id) {
          const { data: addr } = await supabase
            .from('addresses')
            .select('street_address, apartment, city, state, zip_code')
            .eq('id', firstBiz.business_address_id)
            .single();
          if (addr) {
            const a = addr as { street_address?: string; apartment?: string; city?: string; state?: string; zip_code?: string };
            address = [a.street_address, a.apartment, [a.city, a.state, a.zip_code].filter(Boolean).join(', ')].filter(Boolean).join('\n');
          }
        }
        const { data: invSettings } = await supabase
          .from('pro_invoice_settings')
          .select('company_tagline')
          .eq('owner_id', ownerId)
          .single();
        const linksFirst = firstBiz.links as { website?: string } | null | undefined;
        business = {
          business_name: firstBiz.business_name,
          business_logo: firstBiz.business_logo,
          email: firstBiz.email,
          phone: firstBiz.phone,
          address,
          company_tagline: (invSettings as { company_tagline?: string } | null)?.company_tagline ?? null,
          website: linksFirst?.website ?? undefined,
        };
      }
    }
    applyCompanyDisplay(business as unknown as Record<string, unknown>, row.company_display);

    const { data: invSettings } = await supabase
      .from('pro_invoice_settings')
      .select('theme_color_hex')
      .eq('owner_id', ownerId)
      .single();
    const themeColorHex = (invSettings as { theme_color_hex?: string } | null)?.theme_color_hex ?? '#000000';

    return NextResponse.json({
      invoiceNumber: row.invoice_number,
      amountCents: row.amount_cents,
      paymentAppliedCents: row.payment_applied_cents,
      lineItems: row.line_items,
      status: row.status,
      invoiceDate: row.invoice_date,
      dueDate: resolveInvoiceDueDate(row.invoice_date, row.due_date, row.payment_terms),
      paymentTerms: row.payment_terms,
      note: row.note,
      themeColorHex,
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
      business,
    });
  } catch (err) {
    console.error('GET /api/invoices/public', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
