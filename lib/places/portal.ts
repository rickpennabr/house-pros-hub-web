import { createServiceRoleClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/types/supabase';

export const PLACE_KINDS = ['house', 'business', 'building'] as const;
export const PLAN_FREQUENCIES = ['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'] as const;
export const DOCUMENT_KINDS = ['contract', 'project_pdf', 'agreement', 'other'] as const;
export const PHASE_STATUSES = ['planned', 'in_progress', 'done'] as const;

export type PlaceKind = (typeof PLACE_KINDS)[number];
export type PlanFrequency = (typeof PLAN_FREQUENCIES)[number];
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];
export type PhaseStatus = (typeof PHASE_STATUSES)[number];

type Admin = ReturnType<typeof createServiceRoleClient>;
type CustomerRow = Pick<
  Database['public']['Tables']['pro_crm_customers']['Row'],
  | 'id'
  | 'owner_id'
  | 'first_name'
  | 'last_name'
  | 'company_name'
  | 'email'
  | 'street_address'
  | 'city'
  | 'state'
  | 'zip_code'
  | 'portal_kind'
  | 'place_id'
>;

const CUSTOMER_FIELDS =
  'id, owner_id, first_name, last_name, company_name, email, street_address, city, state, zip_code, portal_kind, place_id';

export interface PortalUser {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
}

function norm(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function placeName(row: CustomerRow): string {
  const street = row.street_address?.trim();
  if (street) return street.slice(0, 120);
  const company = row.company_name?.trim();
  if (company) return company.slice(0, 120);
  const person = `${row.first_name} ${row.last_name}`.trim();
  return (person || 'My place').slice(0, 120);
}

async function ensurePlace(admin: Admin, userId: string, row: CustomerRow): Promise<string> {
  if (row.place_id) return row.place_id;

  const { data: places } = await admin
    .from('customer_places')
    .select('id, street, zip_code')
    .eq('user_id', userId);

  const street = norm(row.street_address);
  const zip = norm(row.zip_code);
  const match = (places ?? []).find((place) => {
    if (!street || !zip) return false;
    return norm(place.street) === street && norm(place.zip_code) === zip;
  });
  if (match) return match.id;

  const kind: PlaceKind = row.portal_kind ?? 'house';
  const { data: created, error } = await admin
    .from('customer_places')
    .insert({
      user_id: userId,
      kind,
      name: placeName(row),
      street: row.street_address,
      city: row.city,
      state: row.state,
      zip_code: row.zip_code,
    })
    .select('id')
    .single();
  if (error || !created) throw new Error(error?.message || 'Could not create the place');
  return created.id;
}

/**
 * Attach CRM customers that use this person's confirmed email, and give each one a place.
 */
export async function claimPortalCustomers(user: PortalUser): Promise<void> {
  const admin = createServiceRoleClient();
  const email = user.email?.trim() ?? '';
  if (email && user.email_confirmed_at) {
    const safe = email.replace(/[%_\\]/g, '');
    const { data: pending } = await admin
      .from('pro_crm_customers')
      .select(CUSTOMER_FIELDS)
      .is('portal_user_id', null)
      .ilike('email', safe);

    for (const row of pending ?? []) {
      if ((row.email ?? '').trim().toLowerCase() !== email.toLowerCase()) continue;
      const placeId = await ensurePlace(admin, user.id, row);
      await admin
        .from('pro_crm_customers')
        .update({ portal_user_id: user.id, place_id: placeId })
        .eq('id', row.id)
        .is('portal_user_id', null);
    }
  }

  const { data: unplaced } = await admin
    .from('pro_crm_customers')
    .select(CUSTOMER_FIELDS)
    .eq('portal_user_id', user.id)
    .is('place_id', null);

  for (const row of unplaced ?? []) {
    const placeId = await ensurePlace(admin, user.id, row);
    await admin.from('pro_crm_customers').update({ place_id: placeId }).eq('id', row.id);
  }
}

export async function portalBriefForUser(userId: string): Promise<string> {
  const admin = createServiceRoleClient();
  const { data: places } = await admin
    .from('customer_places')
    .select('id, kind, name, street, city, state')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (!places?.length) return '';

  const { data: customers } = await admin
    .from('pro_crm_customers')
    .select('id, place_id, owner_id')
    .eq('portal_user_id', userId);
  const customerIds = (customers ?? []).map((row) => row.id);
  if (customerIds.length === 0) {
    return places
      .map((place) => `${place.kind} "${place.name}"${place.city ? `, ${place.city}` : ''}: no work published yet.`)
      .join('\n')
      .slice(0, 3500);
  }

  const [{ data: projects }, { data: plans }, { data: docs }, { data: invoices }] = await Promise.all([
    admin
      .from('pro_crm_projects')
      .select('id, customer_id, name, status, start_date, end_date, shared')
      .in('customer_id', customerIds)
      .eq('shared', true),
    admin
      .from('pro_crm_maintenance_plans')
      .select('customer_id, name, frequency, next_visit_date, is_active')
      .in('customer_id', customerIds)
      .eq('is_active', true),
    admin
      .from('pro_crm_customer_documents')
      .select('customer_id, title, kind, visible_to_customer')
      .in('customer_id', customerIds)
      .eq('visible_to_customer', true),
    admin
      .from('pro_crm_invoices')
      .select('customer_id, invoice_number, status, amount_cents, payment_applied_cents, due_date')
      .in('customer_id', customerIds)
      .neq('status', 'draft'),
  ]);

  const projectIds = (projects ?? []).map((row) => row.id);
  const { data: phaseRows } = projectIds.length
    ? await admin
        .from('pro_crm_project_phases')
        .select('project_id, name, status, start_date, end_date, sort_order')
        .in('project_id', projectIds)
    : { data: [] as { project_id: string; name: string; status: string; start_date: string | null; end_date: string | null; sort_order: number }[] };

  const lines: string[] = [];
  for (const place of places) {
    const where = [place.street, place.city, place.state].filter(Boolean).join(', ');
    lines.push(`${place.kind} "${place.name}"${where ? ` (${where})` : ''}`);
    const ids = (customers ?? []).filter((row) => row.place_id === place.id).map((row) => row.id);
    const placeProjects = (projects ?? []).filter((row) => ids.includes(row.customer_id));
    if (placeProjects.length === 0) lines.push('  No shared project.');
    for (const project of placeProjects) {
      lines.push(`  Project "${project.name}": ${project.status}. ${project.start_date ?? 'no start'} to ${project.end_date ?? 'no end'}.`);
      const steps = (phaseRows ?? [])
        .filter((phase) => phase.project_id === project.id)
        .sort((a, b) => a.sort_order - b.sort_order);
      for (const phase of steps) {
        lines.push(`    Phase "${phase.name}": ${phase.status}. ${phase.start_date ?? 'no date'} to ${phase.end_date ?? 'no date'}.`);
      }
    }
    for (const plan of (plans ?? []).filter((row) => ids.includes(row.customer_id))) {
      lines.push(`  Maintenance "${plan.name}": ${plan.frequency}. Next visit ${plan.next_visit_date ?? 'not set'}.`);
    }
    for (const doc of (docs ?? []).filter((row) => ids.includes(row.customer_id))) {
      lines.push(`  Document "${doc.title}" (${doc.kind}). Open it on My Places.`);
    }
    for (const invoice of (invoices ?? []).filter((row) => ids.includes(row.customer_id))) {
      const balance = Math.max(0, invoice.amount_cents - invoice.payment_applied_cents) / 100;
      lines.push(
        `  Invoice ${invoice.invoice_number}: ${invoice.status}. Balance ${balance.toFixed(2)} USD. Due ${invoice.due_date ?? 'not set'}.`
      );
    }
  }

  return lines.join('\n').slice(0, 3500);
}

export interface PlaceCard {
  id: string;
  kind: PlaceKind;
  name: string;
  street: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  projectCount: number;
  maintenanceCount: number;
}

export async function listPortalPlaces(userId: string): Promise<PlaceCard[]> {
  const admin = createServiceRoleClient();
  const { data: places, error } = await admin
    .from('customer_places')
    .select('id, kind, name, street, city, state, zip_code')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);

  const { data: customers } = await admin
    .from('pro_crm_customers')
    .select('id, place_id')
    .eq('portal_user_id', userId);
  const customerIds = (customers ?? []).map((row) => row.id);

  const [{ data: projects }, { data: plans }] = customerIds.length
    ? await Promise.all([
        admin.from('pro_crm_projects').select('customer_id').in('customer_id', customerIds).eq('shared', true),
        admin.from('pro_crm_maintenance_plans').select('customer_id').in('customer_id', customerIds).eq('is_active', true),
      ])
    : [{ data: [] }, { data: [] }];

  return (places ?? []).map((place) => {
    const ids = (customers ?? []).filter((row) => row.place_id === place.id).map((row) => row.id);
    return {
      id: place.id,
      kind: place.kind,
      name: place.name,
      street: place.street,
      city: place.city,
      state: place.state,
      zipCode: place.zip_code,
      projectCount: (projects ?? []).filter((row) => ids.includes(row.customer_id)).length,
      maintenanceCount: (plans ?? []).filter((row) => ids.includes(row.customer_id)).length,
    };
  });
}

export interface PlaceBundle {
  place: PlaceCard;
  projects: Array<{
    id: string;
    name: string;
    status: string;
    startDate: string | null;
    endDate: string | null;
    proName: string;
    phases: Array<{
      id: string;
      name: string;
      status: string;
      startDate: string | null;
      endDate: string | null;
      note: string | null;
    }>;
  }>;
  maintenance: Array<{
    id: string;
    name: string;
    summary: string | null;
    frequency: PlanFrequency;
    nextVisit: string | null;
    lastVisit: string | null;
    endDate: string | null;
    amountCents: number | null;
    proName: string;
  }>;
  documents: Array<{
    id: string;
    title: string;
    kind: DocumentKind;
    fileName: string;
    projectId: string | null;
  }>;
  invoices: Array<{
    id: string;
    number: string;
    status: string;
    amountCents: number;
    appliedCents: number;
    dueDate: string | null;
    invoiceDate: string;
  }>;
  estimates: Array<{
    id: string;
    status: string;
    amountCents: number;
    dueDate: string | null;
  }>;
}

export async function loadPlaceBundle(userId: string, placeId: string): Promise<PlaceBundle | null> {
  const admin = createServiceRoleClient();
  const { data: place } = await admin
    .from('customer_places')
    .select('id, kind, name, street, city, state, zip_code')
    .eq('id', placeId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!place) return null;

  const { data: customers } = await admin
    .from('pro_crm_customers')
    .select('id, owner_id')
    .eq('portal_user_id', userId)
    .eq('place_id', placeId);
  const rows = customers ?? [];
  const customerIds = rows.map((row) => row.id);
  const ownerIds = [...new Set(rows.map((row) => row.owner_id))];
  const { data: businesses } = ownerIds.length
    ? await admin.from('businesses').select('owner_id, business_name').in('owner_id', ownerIds)
    : { data: [] as { owner_id: string; business_name: string }[] };
  const proName = (ownerId: string) =>
    (businesses ?? []).find((biz) => biz.owner_id === ownerId)?.business_name ?? 'Your pro';
  const proForCustomer = (customerId: string) => {
    const owner = rows.find((row) => row.id === customerId)?.owner_id;
    return owner ? proName(owner) : 'Your pro';
  };

  if (customerIds.length === 0) {
    return {
      place: {
        id: place.id,
        kind: place.kind,
        name: place.name,
        street: place.street,
        city: place.city,
        state: place.state,
        zipCode: place.zip_code,
        projectCount: 0,
        maintenanceCount: 0,
      },
      projects: [],
      maintenance: [],
      documents: [],
      invoices: [],
      estimates: [],
    };
  }

  const [{ data: projects }, { data: plans }, { data: docs }, { data: invoices }, { data: estimates }] = await Promise.all([
    admin
      .from('pro_crm_projects')
      .select('id, customer_id, name, status, start_date, end_date')
      .in('customer_id', customerIds)
      .eq('shared', true)
      .order('created_at', { ascending: false }),
    admin
      .from('pro_crm_maintenance_plans')
      .select('id, customer_id, name, summary, frequency, next_visit_date, last_visit_date, end_date, amount_cents')
      .in('customer_id', customerIds)
      .eq('is_active', true)
      .order('next_visit_date', { ascending: true }),
    admin
      .from('pro_crm_customer_documents')
      .select('id, title, kind, file_name, project_id')
      .in('customer_id', customerIds)
      .eq('visible_to_customer', true)
      .order('created_at', { ascending: false }),
    admin
      .from('pro_crm_invoices')
      .select('id, invoice_number, status, amount_cents, payment_applied_cents, due_date, invoice_date')
      .in('customer_id', customerIds)
      .neq('status', 'draft')
      .order('invoice_date', { ascending: false }),
    admin
      .from('pro_crm_estimates')
      .select('id, status, amount_cents, due_date')
      .in('customer_id', customerIds)
      .neq('status', 'draft')
      .order('created_at', { ascending: false }),
  ]);

  const projectIds = (projects ?? []).map((row) => row.id);
  const { data: phases } = projectIds.length
    ? await admin
        .from('pro_crm_project_phases')
        .select('id, project_id, name, status, start_date, end_date, customer_note, sort_order')
        .in('project_id', projectIds)
        .order('sort_order', { ascending: true })
    : { data: [] as Database['public']['Tables']['pro_crm_project_phases']['Row'][] };

  return {
    place: {
      id: place.id,
      kind: place.kind,
      name: place.name,
      street: place.street,
      city: place.city,
      state: place.state,
      zipCode: place.zip_code,
      projectCount: projects?.length ?? 0,
      maintenanceCount: plans?.length ?? 0,
    },
    projects: (projects ?? []).map((project) => ({
      id: project.id,
      name: project.name,
      status: project.status,
      startDate: project.start_date,
      endDate: project.end_date,
      proName: proForCustomer(project.customer_id),
      phases: (phases ?? [])
        .filter((phase) => phase.project_id === project.id)
        .map((phase) => ({
          id: phase.id,
          name: phase.name,
          status: phase.status,
          startDate: phase.start_date,
          endDate: phase.end_date,
          note: phase.customer_note,
        })),
    })),
    maintenance: (plans ?? []).map((plan) => ({
      id: plan.id,
      name: plan.name,
      summary: plan.summary,
      frequency: plan.frequency,
      nextVisit: plan.next_visit_date,
      lastVisit: plan.last_visit_date,
      endDate: plan.end_date,
      amountCents: plan.amount_cents,
      proName: proForCustomer(plan.customer_id),
    })),
    documents: (docs ?? []).map((doc) => ({
      id: doc.id,
      title: doc.title,
      kind: doc.kind,
      fileName: doc.file_name,
      projectId: doc.project_id,
    })),
    invoices: (invoices ?? []).map((invoice) => ({
      id: invoice.id,
      number: invoice.invoice_number,
      status: invoice.status,
      amountCents: invoice.amount_cents,
      appliedCents: invoice.payment_applied_cents,
      dueDate: invoice.due_date,
      invoiceDate: invoice.invoice_date,
    })),
    estimates: (estimates ?? []).map((estimate) => ({
      id: estimate.id,
      status: estimate.status,
      amountCents: estimate.amount_cents,
      dueDate: estimate.due_date,
    })),
  };
}
