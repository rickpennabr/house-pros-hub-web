import { NextRequest, NextResponse } from 'next/server';
import { requireContractor } from '@/lib/crm/require-contractor';
import type { CrmDb } from '@/lib/crm/crm-scope';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { deny } from '@/lib/places/session';
import { listContactProperties, type ContactProperty } from '@/lib/places/contact-places';
import { mailStreetKey } from '@/lib/address/unit';

/**
 * GET /api/crm/portal/property?customerId=…&placeId=…
 * Everything this pro did on one of the customer's properties: estimates, invoices and the
 * payments on them, maintenance agreements and visits, projects, and files.
 *
 * Estimates, invoices and maintenance agreements name their property (NULL is the contact's
 * default). Visits follow their agreement; projects use their own property, else the estimate they came from; files
 * follow their project. Anything with no property of its own goes on the default house.
 * Without placeId (or when the contact has no linked properties) the default house is used.
 */
type ProjectRow = {
  id: string;
  estimate_id: string | null;
  place_id: string | null;
  name: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  shared: boolean | null;
};

export async function GET(request: NextRequest) {
  try {
    const { error, user, supabase } = await requireContractor();
    if (error || !user || !supabase) return deny(error);

    const params = request.nextUrl.searchParams;
    const customerId = params.get('customerId') || '';
    if (!customerId) return NextResponse.json({ error: 'Customer is required.' }, { status: 400 });

    const { data: contact } = await supabase
      .from('pro_crm_customers')
      .select('id, place_id, email, portal_user_id, street_address')
      .eq('id', customerId)
      .eq('owner_id', user.id)
      .maybeSingle();
    if (!contact) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

    const properties: ContactProperty[] = await listContactProperties(createServiceRoleClient(), contact.id);
    const defaultProperty = properties.find((row) => row.isDefault) ?? properties[0] ?? null;
    const requested = params.get('placeId') || '';
    const property = properties.find((row) => row.id === requested) ?? defaultProperty;
    if (requested && property?.id !== requested) {
      return NextResponse.json({ error: "That property is not one of this customer's properties." }, { status: 400 });
    }
    // With no linked properties the contact's own address is the only house: everything is on it.
    const isDefault = !property || property.id === defaultProperty?.id;
    const onPlace = (placeId: string | null | undefined) => (placeId ? placeId === property?.id : isDefault);

    const [estimatesRes, invoicesRes, plansRes, visitsRes, projectsFirst, docsRes] = await Promise.all([
      supabase
        .from('pro_crm_estimates')
        .select('id, display_id, place_id, amount_cents, status, agreement_kind, job_area, created_at, updated_at, signed_at, signer_name')
        .eq('owner_id', user.id)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false }),
      supabase
        .from('pro_crm_invoices')
        .select('id, display_id, invoice_number, place_id, estimate_id, amount_cents, payment_applied_cents, status, invoice_date, due_date, created_at')
        .eq('owner_id', user.id)
        .eq('customer_id', customerId)
        .order('invoice_date', { ascending: false }),
      supabase
        .from('pro_crm_maintenance_plans')
        .select('id, place_id, name, frequency, next_visit_date, last_visit_date, end_date, is_active, amount_cents, created_at')
        .eq('owner_id', user.id)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false }),
      // Table added in 138_maintenance_visits; untyped until supabase.ts is regenerated.
      (supabase as CrmDb)
        .from('pro_crm_maintenance_visits')
        .select('id, maintenance_plan_id, status, started_at, ended_at, labor_seconds, duration_seconds, generated_description')
        .eq('owner_id', user.id)
        .eq('customer_id', customerId)
        .neq('status', 'cancelled')
        .order('started_at', { ascending: false })
        .limit(500),
      supabase
        .from('pro_crm_projects')
        .select('id, estimate_id, place_id, name, status, start_date, end_date, shared')
        .eq('owner_id', user.id)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false }),
      supabase
        .from('pro_crm_customer_documents')
        .select('id, project_id, kind, title, file_name, created_at, visible_to_customer')
        .eq('owner_id', user.id)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false }),
    ]);
    // Before migration 146, projects have no place_id: read them without it (default property).
    let projectsRes: { data: ProjectRow[] | null; error: { message: string } | null } = projectsFirst;
    if (projectsFirst.error && /place_id/.test(projectsFirst.error.message)) {
      const retry = await supabase
        .from('pro_crm_projects')
        .select('id, estimate_id, name, status, start_date, end_date, shared')
        .eq('owner_id', user.id)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });
      projectsRes = { data: (retry.data ?? []).map((row) => ({ ...row, place_id: null })), error: retry.error };
    }
    const failed = [estimatesRes, invoicesRes, plansRes, visitsRes, projectsRes, docsRes].find((res) => res.error);
    if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 });

    const allEstimates = estimatesRes.data ?? [];
    const estimatePlace = new Map(allEstimates.map((row) => [row.id, row.place_id]));
    const estimates = allEstimates.filter((row) => onPlace(row.place_id));
    const invoices = (invoicesRes.data ?? []).filter((row) => onPlace(row.place_id));

    const allPlans = plansRes.data ?? [];
    const plans = allPlans.filter((row) => onPlace(row.place_id));
    const planIds = new Set(allPlans.map((row) => row.id));
    const visitRows = (visitsRes.data ?? []) as Array<{
      id: string;
      maintenance_plan_id: string | null;
      status: string;
      started_at: string;
      ended_at: string | null;
      labor_seconds: number | null;
      duration_seconds: number | null;
      generated_description: string | null;
    }>;
    const visits = visitRows.filter((row) =>
      row.maintenance_plan_id && planIds.has(row.maintenance_plan_id)
        ? plans.some((plan) => plan.id === row.maintenance_plan_id)
        : isDefault
    );

    const projectOnPlace = (row: { estimate_id: string | null; place_id: string | null }) =>
      row.place_id
        ? onPlace(row.place_id)
        : row.estimate_id && estimatePlace.has(row.estimate_id) ? onPlace(estimatePlace.get(row.estimate_id)) : isDefault;
    const allProjects = projectsRes.data ?? [];
    const projects = allProjects.filter(projectOnPlace);
    const projectIds = new Set(projects.map((row) => row.id));
    const knownProjects = new Set(allProjects.map((row) => row.id));
    const documents = (docsRes.data ?? []).filter((row) =>
      row.project_id && knownProjects.has(row.project_id) ? projectIds.has(row.project_id) : isDefault
    );

    const invoiceIds = invoices.map((row) => row.id);
    const { data: paymentRows, error: paymentsError } = invoiceIds.length
      ? await supabase
          .from('pro_crm_invoice_payments')
          .select('id, invoice_id, amount_cents, payment_date, method, reference, voided_at')
          .eq('owner_id', user.id)
          .in('invoice_id', invoiceIds)
          .order('payment_date', { ascending: false })
      : { data: [], error: null };
    if (paymentsError) return NextResponse.json({ error: paymentsError.message }, { status: 500 });
    const payments = (paymentRows ?? []).filter((row) => !row.voided_at);

    // Invoice activity log: sends, re-sends, reminders (manual and automatic), voids and cancels.
    const { data: eventRows } = invoiceIds.length
      ? await supabase
          .from('pro_crm_document_events')
          .select('id, invoice_id, action, payload, created_at')
          .eq('owner_id', user.id)
          .in('invoice_id', invoiceIds)
          .order('created_at', { ascending: true })
      : { data: [] };
    const invoiceEvents = eventRows ?? [];

    // Estimate sends, link views and statements (migration 166; empty before it).
    const estimateIds = new Set(estimates.map((row) => row.id));
    const invoiceIdSet = new Set(invoiceIds);
    const { data: activityRows } = await (supabase as unknown as CrmDb)
      .from('pro_crm_activity' as never)
      .select('id, kind, estimate_id, invoice_id, detail, occurred_at')
      .eq('owner_id', user.id)
      .eq('customer_id', contact.id)
      .order('occurred_at', { ascending: true })
      .then((res: { data: unknown }) => res, () => ({ data: null }));
    const activity = ((activityRows ?? []) as Array<{
      id: string;
      kind: string;
      estimate_id: string | null;
      invoice_id: string | null;
      detail: string | null;
      occurred_at: string;
    }>).filter((row) =>
      row.estimate_id ? estimateIds.has(row.estimate_id) : row.invoice_id ? invoiceIdSet.has(row.invoice_id) : isDefault
    );

    // Appointments booked with the pro: matched to the contact by account or email, to the property by street.
    const { data: ownBusinesses } = await supabase.from('businesses').select('id').eq('owner_id', user.id);
    const businessIds = (ownBusinesses ?? []).map((row) => row.id);
    const contactEmail = contact.email?.trim().toLowerCase() ?? '';
    const bookingFilters = [
      contact.portal_user_id ? `customer_user_id.eq.${contact.portal_user_id}` : null,
      contactEmail && !/[,()]/.test(contactEmail) ? `guest_email.ilike.${contactEmail}` : null,
    ].filter(Boolean);
    const { data: bookingRows } =
      businessIds.length && bookingFilters.length
        ? await createServiceRoleClient()
            .from('pro_estimate_bookings')
            .select('id, service_name, status, slot_start_at, visit_street, created_at, updated_at')
            .in('business_id', businessIds)
            .or(bookingFilters.join(','))
        : { data: [] };
    const propertyStreet = mailStreetKey(property?.street ?? contact.street_address ?? null);
    const bookings = (bookingRows ?? []).filter((row) => {
      const visit = mailStreetKey(row.visit_street);
      return visit && propertyStreet ? visit === propertyStreet : isDefault;
    });

    const billed = invoices.filter((row) => row.status !== 'cancelled' && row.status !== 'draft');
    const invoicedCents = billed.reduce((sum, row) => sum + row.amount_cents, 0);
    const paidCents = billed.reduce((sum, row) => sum + row.payment_applied_cents, 0);

    return NextResponse.json({
      properties,
      property,
      totals: {
        invoicedCents,
        paidCents,
        balanceCents: Math.max(0, invoicedCents - paidCents),
        visits: visits.filter((row) => row.status === 'completed').length,
        laborSeconds: visits.reduce((sum, row) => sum + (row.labor_seconds ?? row.duration_seconds ?? 0), 0),
      },
      estimates,
      invoices,
      payments,
      invoiceEvents,
      activity,
      bookings,
      plans,
      visits,
      projects,
      documents,
    });
  } catch (err) {
    console.error('GET /api/crm/portal/property', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
