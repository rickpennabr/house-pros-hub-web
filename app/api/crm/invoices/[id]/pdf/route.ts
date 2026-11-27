import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { userCanAccessCrm } from '@/lib/crm/require-contractor';
import { applyCompanyDisplay } from '@/lib/invoices/companyDisplay';
import { applyInvoiceBrand } from '@/lib/invoices/invoice-brand';
import { getDefaultCompanyForInvoice } from '@/lib/invoices/defaultCompany';
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer';
import React from 'react';
import { InvoicePdfDocument } from '@/components/invoices/InvoicePdfDocument';
import type { InvoiceLineItem, InvoiceTemplateInvoice, InvoiceTemplateCustomer, InvoiceTemplateBusiness } from '@/components/invoices/InvoiceTemplate';
import { resolveInvoiceDueDate } from '@/lib/invoices/invoiceDueOnReceipt';
import { getOrCreateInvoicePayLink, invoiceTakesPayLink, payLinkQrDataUrl } from '@/lib/invoices/payLink';
import { getPublicSiteUrlForEmail } from '@/lib/utils/publicSiteUrl';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await createClient();
    const {
      data: { user },
      error: authError,
    } = await session.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Invoice ID required' }, { status: 400 });

    const supabase = createServiceRoleClient();
    const { data: row, error } = await supabase.from('pro_crm_invoices').select('*').eq('id', id).single();
    if (error || !row) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    const isOwner = (await userCanAccessCrm(user.id)) && row.owner_id === user.id;
    let isCustomer = false;
    if (!isOwner && row.status !== 'draft') {
      const { data: customer } = await supabase
        .from('pro_crm_customers')
        .select('portal_user_id')
        .eq('id', row.customer_id)
        .maybeSingle();
      isCustomer = customer?.portal_user_id === user.id;
    }
    if (!isOwner && !isCustomer) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    const ownerId = row.owner_id;

    const { data: customer } = await supabase
      .from('pro_crm_customers')
      .select('first_name, last_name, display_name, company_name, billing_address_street_1, billing_address_street_2, billing_address_city, billing_address_state, billing_address_zip_code, billing_address_country, street_address, city, state, zip_code')
      .eq('id', row.customer_id)
      .single();

    let business: InvoiceTemplateBusiness = {
      business_name: 'My Business',
      address: null,
    };
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
            const a = addr as { street_address?: string; apartment?: string; city?: string; state?: string; zip_code?: string };
            const parts = [a.street_address, a.apartment, [a.city, a.state, a.zip_code].filter(Boolean).join(', ')].filter(Boolean);
            address = parts.join('\n');
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
          website: links?.website ?? undefined,
          address,
          company_tagline: (invSettings as { company_tagline?: string } | null)?.company_tagline ?? null,
        };
      }
    }
    if (business.business_name === 'My Business') {
      const defaultCompany = await getDefaultCompanyForInvoice(supabase, ownerId);
      if (defaultCompany) {
        business = {
          business_name: defaultCompany.business_name,
          business_logo: defaultCompany.business_logo,
          email: defaultCompany.email,
          phone: defaultCompany.phone,
          website: defaultCompany.website,
          address: defaultCompany.address,
          company_tagline: defaultCompany.company_tagline ?? null,
        };
      }
    }
    const brand = await applyInvoiceBrand(supabase, ownerId, business);
    applyCompanyDisplay(business as unknown as Record<string, unknown>, row.company_display);

    const themeColorHex = brand.themeColorHex;

    const invoiceData: InvoiceTemplateInvoice = {
      invoice_number: row.invoice_number,
      amount_cents: row.amount_cents,
      payment_applied_cents: row.payment_applied_cents,
      line_items: Array.isArray(row.line_items) ? (row.line_items as unknown as InvoiceLineItem[]) : null,
      status: row.status,
      invoice_date: row.invoice_date,
      due_date: resolveInvoiceDueDate(row.invoice_date, row.due_date, row.payment_terms),
      payment_terms: row.payment_terms,
      po_number: (row as { po_number?: string | null }).po_number ?? null,
      note: row.note,
    };

    const customerData: InvoiceTemplateCustomer = customer
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
      : { first_name: '', last_name: '', billing_address: null };

    // Pay link + QR like a QuickBooks invoice. A failure here should not block the PDF.
    let payUrl: string | null = null;
    let payQrDataUrl: string | null = null;
    if (invoiceTakesPayLink(row.status, row.amount_cents, row.payment_applied_cents)) {
      try {
        const link = await getOrCreateInvoicePayLink(supabase, id, getPublicSiteUrlForEmail(request));
        if (link) {
          payUrl = link.url;
          payQrDataUrl = await payLinkQrDataUrl(link.url);
        }
      } catch (payErr) {
        console.error('invoice pdf: pay link', payErr);
      }
    }

    const pdf = await renderToBuffer(
      React.createElement(InvoicePdfDocument, {
        invoice: invoiceData,
        customer: customerData,
        business,
        themeColor: themeColorHex,
        payUrl,
        payQrDataUrl,
      }) as React.ReactElement<DocumentProps>
    );

    const filename = `invoice-${row.invoice_number}.pdf`;
    return new NextResponse(pdf as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('GET /api/crm/invoices/[id]/pdf', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
