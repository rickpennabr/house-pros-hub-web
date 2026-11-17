import { joinMailLine, mailStreetKey } from '@/lib/address/unit';
import { canChangeAppointment } from '@/lib/booking/appointmentPolicy';
import { safeTimeZone } from '@/lib/booking/dayOfReminder';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/types/supabase';
import {
  listPlaceTimeline,
  recordPlaceEntered,
  recordProLinked,
  syncPlaceAppointmentTimeline,
  syncPlaceTimelineFromCrm,
  type PlaceTimelineEvent,
} from '@/lib/places/timeline';

export const PLACE_KINDS = ['house', 'business', 'building'] as const;
export const PLAN_FREQUENCIES = [
  'weekly',
  'biweekly',
  'monthly',
  'quarterly',
  'yearly',
] as const;
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
  | 'apartment'
  | 'city'
  | 'state'
  | 'zip_code'
  | 'portal_kind'
  | 'place_id'
>;

const CUSTOMER_FIELDS =
  'id, owner_id, first_name, last_name, company_name, email, street_address, apartment, city, state, zip_code, portal_kind, place_id';

export interface PortalUser {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
}

function norm(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function zipKey(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().slice(0, 5);
}

const ZIP_RE = /^\d{5}(-\d{4})?$/;

export type PlaceAppointmentStatus = 'confirmed' | 'cancelled' | 'completed';
export type PlaceAppointmentSource = 'booking' | 'task';
export type PlaceAppointmentTaskType =
  | 'estimate_appointment'
  | 'business_meeting'
  | 'follow_up'
  | 'other';

export interface PlaceAppointment {
  id: string;
  source: PlaceAppointmentSource;
  token: string | null;
  taskType: PlaceAppointmentTaskType | null;
  serviceName: string | null;
  startAt: string;
  endAt: string;
  status: PlaceAppointmentStatus;
  timezone: string;
  proName: string;
  canChange: boolean;
  createdAt: string;
  ownerId: string | null;
  customerId: string | null;
}

function bookingMatchesPlace(
  booking: { visit_street: string | null; visit_zip: string | null },
  place: { street: string | null; zip_code: string | null },
  aloneOnAccount: boolean
): boolean {
  const bookingStreet = mailStreetKey(booking.visit_street);
  const placeStreet = mailStreetKey(place.street);
  if (bookingStreet && placeStreet) {
    if (bookingStreet !== placeStreet) return false;
    const bookingZip = zipKey(booking.visit_zip);
    const placeZip = zipKey(place.zip_code);
    if (bookingZip && placeZip && bookingZip !== placeZip) return false;
    return true;
  }
  // Older bookings without a visit address land on the only place on the account.
  return aloneOnAccount && !bookingStreet;
}

const TASK_LABEL: Record<PlaceAppointmentTaskType, string> = {
  estimate_appointment: 'Estimate appointment',
  business_meeting: 'Meeting',
  follow_up: 'Follow-up',
  other: 'Appointment',
};

async function listPlaceAppointments(
  admin: Admin,
  userId: string,
  email: string | null | undefined,
  place: { street: string | null; zip_code: string | null },
  aloneOnAccount: boolean,
  customerIds: string[]
): Promise<PlaceAppointment[]> {
  const columns =
    'id, business_id, manage_token, service_name, slot_start_at, slot_end_at, status, visit_street, visit_zip, created_at';
  const emailKey = email?.trim().toLowerCase() ?? '';
  const [byUser, byEmail, tasksResult] = await Promise.all([
    admin
      .from('pro_estimate_bookings')
      .select(columns)
      .eq('customer_user_id', userId)
      .order('slot_start_at', { ascending: false })
      .limit(40),
    emailKey
      ? admin
          .from('pro_estimate_bookings')
          .select(columns)
          .eq('guest_email', emailKey)
          .order('slot_start_at', { ascending: false })
          .limit(40)
      : Promise.resolve({ data: [] as never[], error: null }),
    customerIds.length
      ? admin
          .from('pro_crm_tasks')
          .select('id, owner_id, customer_id, task_type, other_label, start_at, end_at, created_at')
          .in('customer_id', customerIds)
          .in('task_type', ['estimate_appointment', 'follow_up', 'business_meeting', 'other'])
          .order('start_at', { ascending: false })
          .limit(40)
      : Promise.resolve({ data: [] as never[], error: null }),
  ]);
  if (byUser.error) throw new Error(byUser.error.message);
  if (byEmail.error) throw new Error(byEmail.error.message);
  if (tasksResult.error) throw new Error(tasksResult.error.message);

  const merged = new Map<string, NonNullable<typeof byUser.data>[number]>();
  for (const row of [...(byUser.data ?? []), ...(byEmail.data ?? [])]) {
    if (!bookingMatchesPlace(row, place, aloneOnAccount)) continue;
    merged.set(row.id, row);
  }

  const taskRows = tasksResult.data ?? [];
  const businessIds = [...new Set([...merged.values()].map((row) => row.business_id))];
  const ownerIds = [...new Set(taskRows.map((row) => row.owner_id))];
  const [{ data: businesses }, { data: ownerBusinesses }] = await Promise.all([
    businessIds.length
      ? admin.from('businesses').select('id, business_name, timezone, owner_id').in('id', businessIds)
      : Promise.resolve({ data: [] as { id: string; business_name: string | null; timezone: string | null; owner_id: string }[] }),
    ownerIds.length
      ? admin.from('businesses').select('owner_id, business_name, timezone').in('owner_id', ownerIds)
      : Promise.resolve({ data: [] as { owner_id: string; business_name: string | null; timezone: string | null }[] }),
  ]);

  const businessById = new Map(
    (businesses ?? []).map((biz) => [
      biz.id,
      {
        name: biz.business_name?.trim() || 'Your pro',
        timezone: safeTimeZone(biz.timezone),
        ownerId: biz.owner_id,
      },
    ])
  );
  const businessByOwner = new Map(
    (ownerBusinesses ?? []).map((biz) => [
      biz.owner_id,
      {
        name: biz.business_name?.trim() || 'Your pro',
        timezone: safeTimeZone(biz.timezone),
      },
    ])
  );

  const now = new Date();
  const fromBookings: PlaceAppointment[] = [...merged.values()].map((row) => {
    const business = businessById.get(row.business_id);
    const status: PlaceAppointmentStatus =
      row.status === 'cancelled' || row.status === 'completed' ? row.status : 'confirmed';
    return {
      id: row.id,
      source: 'booking' as const,
      token: row.manage_token,
      taskType: null,
      serviceName: row.service_name,
      startAt: row.slot_start_at,
      endAt: row.slot_end_at,
      status,
      timezone: business?.timezone ?? 'America/Los_Angeles',
      proName: business?.name ?? 'Your pro',
      canChange: canChangeAppointment(new Date(row.slot_start_at), now, status),
      createdAt: row.created_at,
      ownerId: business?.ownerId ?? null,
      customerId: null,
    };
  });

  const fromTasks: PlaceAppointment[] = taskRows.map((row) => {
    const business = businessByOwner.get(row.owner_id);
    const taskType = row.task_type as PlaceAppointmentTaskType;
    const past = Date.parse(row.end_at) < now.getTime();
    const status: PlaceAppointmentStatus = past ? 'completed' : 'confirmed';
    const label =
      taskType === 'other' && row.other_label?.trim()
        ? row.other_label.trim()
        : TASK_LABEL[taskType] || TASK_LABEL.other;
    return {
      id: row.id,
      source: 'task' as const,
      token: null,
      taskType,
      serviceName: label,
      startAt: row.start_at,
      endAt: row.end_at,
      status,
      timezone: business?.timezone ?? 'America/Los_Angeles',
      proName: business?.name ?? 'Your pro',
      canChange: false,
      createdAt: row.created_at,
      ownerId: row.owner_id,
      customerId: row.customer_id,
    };
  });

  return [...fromBookings, ...fromTasks].sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
}

export interface PersonalPlaceAddressInput {
  streetAddress: string;
  apartment?: string | null;
  city: string;
  state: string;
  zipCode: string;
  /** Defaults to house. */
  kind?: PlaceKind;
  /** Property nickname. Defaults to the street line for a new place; an existing name is kept when omitted. */
  name?: string;
}

/**
 * Create or update a My Places row from a personal signup/profile address.
 * Dedupes by street + ZIP so finish-setup and address edits do not create duplicates.
 */
export async function ensurePersonalPlaceFromAddress(
  userId: string,
  input: PersonalPlaceAddressInput
): Promise<string | null> {
  const street = joinMailLine(input.streetAddress.trim(), (input.apartment || '').trim()).slice(0, 160);
  const city = input.city.trim();
  const state = input.state.trim().toUpperCase();
  const zipCode = input.zipCode.trim();
  if (!street || !city || state.length !== 2 || !ZIP_RE.test(zipCode)) return null;

  const admin = createServiceRoleClient();
  const { data: places } = await admin
    .from('customer_places')
    .select('id, street, zip_code')
    .eq('user_id', userId);

  const streetKey = mailStreetKey(street);
  const zipKey = norm(zipCode);
  const match = (places ?? []).find(
    (place) => mailStreetKey(place.street) === streetKey && norm(place.zip_code) === zipKey
  );

  const name = (input.name?.trim() || street).slice(0, 120);
  const kind: PlaceKind = input.kind ?? 'house';
  const payload = {
    kind,
    name,
    street,
    city,
    state,
    zip_code: zipCode,
  };

  if (match) {
    const { name: _defaultName, ...withoutName } = payload;
    const { error } = await admin
      .from('customer_places')
      .update(input.name?.trim() ? payload : withoutName)
      .eq('id', match.id);
    if (error) {
      console.error('ensurePersonalPlaceFromAddress update', error.message);
      return null;
    }
    return match.id;
  }

  const { data: created, error } = await admin
    .from('customer_places')
    .insert({ user_id: userId, ...payload })
    .select('id')
    .single();
  if (error || !created) {
    console.error('ensurePersonalPlaceFromAddress insert', error?.message);
    return null;
  }
  await recordPlaceEntered(created.id, name);
  return created.id;
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
    return mailStreetKey(place.street) === mailStreetKey(row.street_address) && norm(place.zip_code) === zip;
  });
  if (match) return match.id;

  const kind: PlaceKind = row.portal_kind ?? 'house';
  const { data: created, error } = await admin
    .from('customer_places')
    .insert({
      user_id: userId,
      kind,
      name: placeName(row),
      street: joinMailLine(row.street_address ?? '', row.apartment ?? '').slice(0, 160) || row.street_address,
      city: row.city,
      state: row.state,
      zip_code: row.zip_code,
    })
    .select('id')
    .single();
  if (error || !created) throw new Error(error?.message || 'Could not create the place');
  await recordPlaceEntered(created.id, placeName(row));
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
      const { data: linked } = await admin
        .from('pro_crm_customers')
        .update({ portal_user_id: user.id, place_id: placeId })
        .eq('id', row.id)
        .is('portal_user_id', null)
        .select('id, owner_id')
        .maybeSingle();
      if (linked) {
        await recordProLinked({
          placeId,
          customerId: linked.id,
          ownerId: linked.owner_id,
        });
      }
    }
  }

  await relinkPortalPlaces(user.id);
}

/**
 * Point this person's CRM records at a place with the same street and ZIP.
 * Removing a place clears the link. Adding that address again runs this, so
 * the professional's documents, projects, and invoices show up as before.
 */
export async function relinkPortalPlaces(userId: string): Promise<void> {
  const admin = createServiceRoleClient();
  const { data: unplaced } = await admin
    .from('pro_crm_customers')
    .select(CUSTOMER_FIELDS)
    .eq('portal_user_id', userId)
    .is('place_id', null);

  for (const row of unplaced ?? []) {
    const placeId = await ensurePlace(admin, userId, row);
    const { data: linked } = await admin
      .from('pro_crm_customers')
      .update({ place_id: placeId })
      .eq('id', row.id)
      .select('id, owner_id')
      .maybeSingle();
    if (linked) {
      await recordProLinked({
        placeId,
        customerId: linked.id,
        ownerId: linked.owner_id,
      });
    }
  }
}

export async function portalBriefForUser(userId: string): Promise<string> {
  const admin = createServiceRoleClient();
  const { data: places } = await admin
    .from('customer_places')
    .select('id, kind, name, street, city, state, zip_code')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (!places?.length) return '';

  const { data: customers } = await admin
    .from('pro_crm_customers')
    .select('id, place_id, owner_id')
    .eq('portal_user_id', userId);
  const customerIds = (customers ?? []).map((row) => row.id);
  const aloneOnAccount = places.length <= 1;

  if (customerIds.length === 0) {
    const lines: string[] = [];
    for (const place of places) {
      const visits = await listPlaceAppointments(
        admin,
        userId,
        null,
        { street: place.street, zip_code: place.zip_code },
        aloneOnAccount,
        []
      );
      if (visits.length === 0) {
        lines.push(`${place.kind} "${place.name}"${place.city ? `, ${place.city}` : ''}: no work published yet.`);
        continue;
      }
      lines.push(`${place.kind} "${place.name}"${place.city ? `, ${place.city}` : ''}`);
      for (const visit of visits) {
        lines.push(
          `  Appointment with ${visit.proName}: ${visit.status}. ${visit.startAt}.${visit.serviceName ? ` ${visit.serviceName}.` : ''}`
        );
      }
    }
    return lines.join('\n').slice(0, 3500);
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
    const placeCustomerIds = (customers ?? [])
      .filter((row) => row.place_id === place.id)
      .map((row) => row.id);
    const visits = await listPlaceAppointments(
      admin,
      userId,
      null,
      { street: place.street, zip_code: place.zip_code },
      aloneOnAccount,
      placeCustomerIds
    );
    for (const visit of visits) {
      lines.push(
        `  Appointment with ${visit.proName}: ${visit.status}. ${visit.startAt}.${visit.serviceName ? ` ${visit.serviceName}.` : ''}`
      );
    }
  }

  return lines.join('\n').slice(0, 3500);
}

export function placePhotoUrl(path: string | null | undefined, version?: string | null): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  if (!base) return null;
  const url = `${base}/storage/v1/object/public/place-photos/${path}`;
  return version ? `${url}?v=${encodeURIComponent(version)}` : url;
}

export interface PlaceCard {
  id: string;
  kind: PlaceKind;
  name: string;
  street: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  photoUrl: string | null;
  projectCount: number;
  maintenanceCount: number;
}

export async function listPortalPlaces(userId: string): Promise<PlaceCard[]> {
  const admin = createServiceRoleClient();
  const { data: places, error } = await admin
    .from('customer_places')
    .select('id, kind, name, street, city, state, zip_code, photo_path, updated_at')
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
      photoUrl: placePhotoUrl(place.photo_path, place.updated_at),
      projectCount: (projects ?? []).filter((row) => ids.includes(row.customer_id)).length,
      maintenanceCount: (plans ?? []).filter((row) => ids.includes(row.customer_id)).length,
    };
  });
}

export interface PlaceBundle {
  place: PlaceCard & { createdAt: string };
  timeline: PlaceTimelineEvent[];
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
    proName: string;
    receivedAt: string;
  }>;
  invoices: Array<{
    id: string;
    number: string;
    status: string;
    amountCents: number;
    appliedCents: number;
    dueDate: string | null;
    invoiceDate: string;
    proName: string;
    receivedAt: string;
  }>;
  estimates: Array<{
    id: string;
    number: string;
    status: string;
    amountCents: number;
    depositCents: number;
    dueDate: string | null;
    proName: string;
    jobArea: string | null;
    agreementKind: string;
    maintenanceFrequency: string | null;
    signedAt: string | null;
    receivedAt: string;
  }>;
  appointments: PlaceAppointment[];
}

export async function loadPlaceBundle(
  userId: string,
  placeId: string,
  email?: string | null
): Promise<PlaceBundle | null> {
  await relinkPortalPlaces(userId);
  const admin = createServiceRoleClient();
  const { data: place } = await admin
    .from('customer_places')
    .select('id, kind, name, street, city, state, zip_code, photo_path, updated_at, created_at')
    .eq('id', placeId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!place) return null;

  await recordPlaceEntered(place.id, place.name, place.created_at);

  const [{ data: customers }, { count: placeCount }] = await Promise.all([
    admin
      .from('pro_crm_customers')
      .select('id, owner_id')
      .eq('portal_user_id', userId)
      .eq('place_id', placeId),
    admin
      .from('customer_places')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
  ]);
  const rows = customers ?? [];
  const customerIds = rows.map((row) => row.id);
  const aloneOnAccount = (placeCount ?? 0) <= 1;
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

  const emptyPlace = {
    id: place.id,
    kind: place.kind,
    name: place.name,
    street: place.street,
    city: place.city,
    state: place.state,
    zipCode: place.zip_code,
    photoUrl: placePhotoUrl(place.photo_path, place.updated_at),
    projectCount: 0,
    maintenanceCount: 0,
    createdAt: place.created_at,
  };

  const appointments = await listPlaceAppointments(
    admin,
    userId,
    email,
    { street: place.street, zip_code: place.zip_code },
    aloneOnAccount,
    customerIds
  );

  if (customerIds.length === 0) {
    await syncPlaceAppointmentTimeline(
      placeId,
      appointments.map((visit) => ({
        id: visit.id,
        source: visit.source,
        serviceName: visit.serviceName,
        status: visit.status,
        startAt: visit.startAt,
        createdAt: visit.createdAt,
        proName: visit.proName,
        ownerId: visit.ownerId,
        customerId: visit.customerId,
      }))
    );
    const timeline = await listPlaceTimeline(placeId);
    return {
      place: emptyPlace,
      timeline,
      projects: [],
      maintenance: [],
      documents: [],
      invoices: [],
      estimates: [],
      appointments,
    };
  }

  await syncPlaceTimelineFromCrm(placeId, customerIds);
  await syncPlaceAppointmentTimeline(
    placeId,
    appointments.map((visit) => ({
      id: visit.id,
      source: visit.source,
      serviceName: visit.serviceName,
      status: visit.status,
      startAt: visit.startAt,
      createdAt: visit.createdAt,
      proName: visit.proName,
      ownerId: visit.ownerId,
      customerId: visit.customerId,
    }))
  );

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
      .select('id, customer_id, title, kind, file_name, project_id, created_at')
      .in('customer_id', customerIds)
      .eq('visible_to_customer', true)
      .order('created_at', { ascending: false }),
    admin
      .from('pro_crm_invoices')
      .select('id, customer_id, invoice_number, status, amount_cents, payment_applied_cents, due_date, invoice_date, created_at')
      .in('customer_id', customerIds)
      .neq('status', 'draft')
      .order('invoice_date', { ascending: false }),
    admin
      .from('pro_crm_estimates')
      .select(
        'id, customer_id, display_id, status, amount_cents, deposit_cents, due_date, job_area, agreement_kind, maintenance_frequency, signed_at, created_at'
      )
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

  const timeline = await listPlaceTimeline(placeId);

  return {
    place: {
      ...emptyPlace,
      projectCount: projects?.length ?? 0,
      maintenanceCount: plans?.length ?? 0,
    },
    timeline,
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
      proName: proForCustomer(doc.customer_id),
      receivedAt: doc.created_at,
    })),
    invoices: (invoices ?? []).map((invoice) => ({
      id: invoice.id,
      number: invoice.invoice_number,
      status: invoice.status,
      amountCents: invoice.amount_cents,
      appliedCents: invoice.payment_applied_cents,
      dueDate: invoice.due_date,
      invoiceDate: invoice.invoice_date,
      proName: proForCustomer(invoice.customer_id),
      receivedAt: invoice.created_at,
    })),
    estimates: (estimates ?? []).map((estimate) => ({
      id: estimate.id,
      number: String(estimate.display_id ?? estimate.id.slice(0, 8)),
      status: estimate.status,
      amountCents: estimate.amount_cents,
      depositCents: estimate.deposit_cents ?? 0,
      dueDate: estimate.due_date,
      proName: proForCustomer(estimate.customer_id),
      jobArea: estimate.job_area?.trim() || null,
      agreementKind: estimate.agreement_kind ?? 'project',
      maintenanceFrequency: estimate.maintenance_frequency ?? null,
      signedAt: estimate.signed_at ?? null,
      receivedAt: estimate.created_at,
    })),
    appointments,
  };
}
