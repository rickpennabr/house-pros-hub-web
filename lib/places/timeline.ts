import { createServiceRoleClient } from '@/lib/supabase/server';

export const PLACE_EVENT_KINDS = [
  'place_entered',
  'pro_linked',
  'estimate_received',
  'estimate_approved',
  'estimate_declined',
  'invoice_received',
  'invoice_paid',
  'document_received',
  'project_shared',
  'maintenance_started',
  'maintenance_stopped',
] as const;

export type PlaceEventKind = (typeof PLACE_EVENT_KINDS)[number];

export interface PlaceTimelineEvent {
  id: string;
  kind: PlaceEventKind;
  occurredAt: string;
  title: string;
  detail: string | null;
  proName: string | null;
  jobArea: string | null;
  amountCents: number | null;
  estimateId: string | null;
  invoiceId: string | null;
  documentId: string | null;
  projectId: string | null;
}

export interface RecordPlaceEventInput {
  placeId: string;
  kind: PlaceEventKind;
  title: string;
  detail?: string | null;
  occurredAt?: string | null;
  proName?: string | null;
  ownerId?: string | null;
  customerId?: string | null;
  estimateId?: string | null;
  invoiceId?: string | null;
  documentId?: string | null;
  projectId?: string | null;
  jobArea?: string | null;
  amountCents?: number | null;
}

type Admin = ReturnType<typeof createServiceRoleClient>;

function cleanArea(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 80);
}

async function businessName(admin: Admin, ownerId: string | null | undefined): Promise<string | null> {
  if (!ownerId) return null;
  const { data } = await admin
    .from('businesses')
    .select('business_name')
    .eq('owner_id', ownerId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  return data?.business_name?.trim() || null;
}

/**
 * Append one timeline row. Duplicate unique keys are ignored so send/claim/sync stay safe.
 */
export async function recordPlaceEvent(input: RecordPlaceEventInput): Promise<void> {
  const placeId = input.placeId?.trim();
  const title = input.title?.trim();
  if (!placeId || !title) return;

  const admin = createServiceRoleClient();
  const { error } = await admin.from('customer_place_events').insert({
    place_id: placeId,
    kind: input.kind,
    title: title.slice(0, 200),
    detail: input.detail?.trim()?.slice(0, 500) || null,
    occurred_at: input.occurredAt || new Date().toISOString(),
    pro_name: input.proName?.trim()?.slice(0, 160) || null,
    owner_id: input.ownerId || null,
    customer_id: input.customerId || null,
    estimate_id: input.estimateId || null,
    invoice_id: input.invoiceId || null,
    document_id: input.documentId || null,
    project_id: input.projectId || null,
    job_area: cleanArea(input.jobArea),
    amount_cents: typeof input.amountCents === 'number' ? input.amountCents : null,
  });

  if (error && error.code !== '23505') {
    console.error('[recordPlaceEvent]', input.kind, error.message);
  }
}

export async function recordPlaceEntered(placeId: string, name: string, occurredAt?: string | null): Promise<void> {
  await recordPlaceEvent({
    placeId,
    kind: 'place_entered',
    title: 'Place added',
    detail: name.trim().slice(0, 200) || 'My place',
    occurredAt: occurredAt ?? undefined,
  });
}

/**
 * Resolve the My Place for a CRM customer and record an event there.
 * Returns the place id when linked; null when the contact is not on a place yet.
 */
export async function recordCustomerPlaceEvent(
  customerId: string,
  input: Omit<RecordPlaceEventInput, 'placeId' | 'customerId'> & { placeId?: string }
): Promise<string | null> {
  const admin = createServiceRoleClient();
  const { data: customer } = await admin
    .from('pro_crm_customers')
    .select('id, place_id, owner_id')
    .eq('id', customerId)
    .maybeSingle();
  if (!customer?.place_id) return null;

  const proName = input.proName ?? (await businessName(admin, customer.owner_id));
  await recordPlaceEvent({
    ...input,
    placeId: customer.place_id,
    customerId: customer.id,
    ownerId: input.ownerId ?? customer.owner_id,
    proName,
  });
  return customer.place_id;
}

export async function recordEstimateReceived(params: {
  customerId: string;
  estimateId: string;
  estimateNumber: string;
  amountCents: number;
  jobArea?: string | null;
  ownerId?: string | null;
  occurredAt?: string | null;
}): Promise<void> {
  const area = cleanArea(params.jobArea);
  await recordCustomerPlaceEvent(params.customerId, {
    kind: 'estimate_received',
    title: area ? `Estimate received · ${area}` : 'Estimate received',
    detail: `#${params.estimateNumber}`,
    estimateId: params.estimateId,
    amountCents: params.amountCents,
    jobArea: area,
    ownerId: params.ownerId,
    occurredAt: params.occurredAt,
  });
}

export async function recordEstimateApproved(params: {
  customerId: string;
  estimateId: string;
  estimateNumber: string;
  amountCents: number;
  jobArea?: string | null;
  ownerId?: string | null;
}): Promise<void> {
  const area = cleanArea(params.jobArea);
  await recordCustomerPlaceEvent(params.customerId, {
    kind: 'estimate_approved',
    title: area ? `Estimate approved · ${area}` : 'Estimate approved',
    detail: `#${params.estimateNumber}`,
    estimateId: params.estimateId,
    amountCents: params.amountCents,
    jobArea: area,
    ownerId: params.ownerId,
  });
}

export async function recordInvoiceReceived(params: {
  customerId: string;
  invoiceId: string;
  invoiceNumber: string;
  amountCents: number;
  ownerId?: string | null;
  occurredAt?: string | null;
}): Promise<void> {
  await recordCustomerPlaceEvent(params.customerId, {
    kind: 'invoice_received',
    title: 'Invoice received',
    detail: params.invoiceNumber,
    invoiceId: params.invoiceId,
    amountCents: params.amountCents,
    ownerId: params.ownerId,
    occurredAt: params.occurredAt,
  });
}

export async function recordInvoicePaid(params: {
  customerId: string;
  invoiceId: string;
  invoiceNumber: string;
  amountCents: number;
  ownerId?: string | null;
}): Promise<void> {
  await recordCustomerPlaceEvent(params.customerId, {
    kind: 'invoice_paid',
    title: 'Invoice paid',
    detail: params.invoiceNumber,
    invoiceId: params.invoiceId,
    amountCents: params.amountCents,
    ownerId: params.ownerId,
  });
}

export async function recordDocumentReceived(params: {
  customerId: string;
  documentId: string;
  title: string;
  kind: string;
  ownerId?: string | null;
}): Promise<void> {
  await recordCustomerPlaceEvent(params.customerId, {
    kind: 'document_received',
    title: 'Document received',
    detail: params.title,
    documentId: params.documentId,
    ownerId: params.ownerId,
  });
}

export async function recordProLinked(params: {
  placeId: string;
  customerId: string;
  ownerId: string;
  occurredAt?: string | null;
}): Promise<void> {
  const admin = createServiceRoleClient();
  const proName = await businessName(admin, params.ownerId);
  await recordPlaceEvent({
    placeId: params.placeId,
    kind: 'pro_linked',
    title: proName ? `${proName} linked` : 'Professional linked',
    detail: 'Work from this professional will show on this place.',
    customerId: params.customerId,
    ownerId: params.ownerId,
    proName,
    occurredAt: params.occurredAt,
  });
}

/**
 * Fill timeline gaps from CRM rows already on the place (idempotent unique indexes).
 */
export async function syncPlaceTimelineFromCrm(placeId: string, customerIds: string[]): Promise<void> {
  if (!placeId || customerIds.length === 0) return;
  const admin = createServiceRoleClient();

  const { data: customers } = await admin
    .from('pro_crm_customers')
    .select('id, owner_id')
    .in('id', customerIds);
  const ownerIds = [...new Set((customers ?? []).map((row) => row.owner_id))];
  const { data: businesses } = ownerIds.length
    ? await admin.from('businesses').select('owner_id, business_name').in('owner_id', ownerIds)
    : { data: [] as { owner_id: string; business_name: string }[] };
  const proName = (ownerId: string) =>
    (businesses ?? []).find((biz) => biz.owner_id === ownerId)?.business_name ?? null;
  const ownerFor = (customerId: string) =>
    (customers ?? []).find((row) => row.id === customerId)?.owner_id ?? null;

  const [{ data: estimates }, { data: invoices }, { data: docs }] = await Promise.all([
    admin
      .from('pro_crm_estimates')
      .select('id, customer_id, owner_id, display_id, amount_cents, status, job_area, created_at, updated_at')
      .in('customer_id', customerIds)
      .neq('status', 'draft'),
    admin
      .from('pro_crm_invoices')
      .select('id, customer_id, owner_id, invoice_number, amount_cents, status, created_at, invoice_date')
      .in('customer_id', customerIds)
      .neq('status', 'draft'),
    admin
      .from('pro_crm_customer_documents')
      .select('id, customer_id, owner_id, title, kind, created_at')
      .in('customer_id', customerIds)
      .eq('visible_to_customer', true),
  ]);

  for (const estimate of estimates ?? []) {
    const number = String(estimate.display_id ?? estimate.id.slice(0, 8));
    const area = cleanArea(estimate.job_area);
    const ownerId = estimate.owner_id || ownerFor(estimate.customer_id);
    await recordPlaceEvent({
      placeId,
      kind: 'estimate_received',
      title: area ? `Estimate received · ${area}` : 'Estimate received',
      detail: `#${number}`,
      occurredAt: estimate.created_at,
      proName: ownerId ? proName(ownerId) : null,
      ownerId,
      customerId: estimate.customer_id,
      estimateId: estimate.id,
      jobArea: area,
      amountCents: estimate.amount_cents,
    });
    if (estimate.status === 'accepted') {
      await recordPlaceEvent({
        placeId,
        kind: 'estimate_approved',
        title: area ? `Estimate approved · ${area}` : 'Estimate approved',
        detail: `#${number}`,
        occurredAt: estimate.updated_at,
        proName: ownerId ? proName(ownerId) : null,
        ownerId,
        customerId: estimate.customer_id,
        estimateId: estimate.id,
        jobArea: area,
        amountCents: estimate.amount_cents,
      });
    } else if (estimate.status === 'declined') {
      await recordPlaceEvent({
        placeId,
        kind: 'estimate_declined',
        title: area ? `Estimate declined · ${area}` : 'Estimate declined',
        detail: `#${number}`,
        occurredAt: estimate.updated_at,
        proName: ownerId ? proName(ownerId) : null,
        ownerId,
        customerId: estimate.customer_id,
        estimateId: estimate.id,
        jobArea: area,
        amountCents: estimate.amount_cents,
      });
    }
  }

  for (const invoice of invoices ?? []) {
    const ownerId = invoice.owner_id || ownerFor(invoice.customer_id);
    await recordPlaceEvent({
      placeId,
      kind: 'invoice_received',
      title: 'Invoice received',
      detail: invoice.invoice_number,
      occurredAt: invoice.created_at || `${invoice.invoice_date}T12:00:00.000Z`,
      proName: ownerId ? proName(ownerId) : null,
      ownerId,
      customerId: invoice.customer_id,
      invoiceId: invoice.id,
      amountCents: invoice.amount_cents,
    });
    if (invoice.status === 'paid') {
      await recordPlaceEvent({
        placeId,
        kind: 'invoice_paid',
        title: 'Invoice paid',
        detail: invoice.invoice_number,
        occurredAt: invoice.created_at,
        proName: ownerId ? proName(ownerId) : null,
        ownerId,
        customerId: invoice.customer_id,
        invoiceId: invoice.id,
        amountCents: invoice.amount_cents,
      });
    }
  }

  for (const doc of docs ?? []) {
    const ownerId = doc.owner_id || ownerFor(doc.customer_id);
    await recordPlaceEvent({
      placeId,
      kind: 'document_received',
      title: 'Document received',
      detail: doc.title,
      occurredAt: doc.created_at,
      proName: ownerId ? proName(ownerId) : null,
      ownerId,
      customerId: doc.customer_id,
      documentId: doc.id,
    });
  }

  for (const customer of customers ?? []) {
    await recordProLinked({
      placeId,
      customerId: customer.id,
      ownerId: customer.owner_id,
    });
  }
}

export async function listPlaceTimeline(placeId: string): Promise<PlaceTimelineEvent[]> {
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from('customer_place_events')
    .select(
      'id, kind, occurred_at, title, detail, pro_name, job_area, amount_cents, estimate_id, invoice_id, document_id, project_id'
    )
    .eq('place_id', placeId)
    .order('occurred_at', { ascending: false })
    .limit(200);
  if (error) {
    console.error('[listPlaceTimeline]', error.message);
    return [];
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    kind: row.kind as PlaceEventKind,
    occurredAt: row.occurred_at,
    title: row.title,
    detail: row.detail,
    proName: row.pro_name,
    jobArea: row.job_area,
    amountCents: row.amount_cents,
    estimateId: row.estimate_id,
    invoiceId: row.invoice_id,
    documentId: row.document_id,
    projectId: row.project_id,
  }));
}
