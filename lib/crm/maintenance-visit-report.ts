import type { CrmScope } from '@/lib/crm/crm-scope';
import { contactDisplayName } from '@/lib/crm/contact-name';
import { PRO_DRIVE_BUCKET, PRO_DRIVE_SIGNED_URL_SECONDS } from '@/lib/drive/constants';
import { listPlants } from '@/lib/crm/maintenance-plants-db';
import {
  CONTACT_SELECT,
  contactAddress,
  houseLocation,
  housePlaceIds,
  loadPlaces,
  PLAN_SELECT,
  type ContactRow,
  type PlanRow,
} from '@/lib/crm/maintenance-houses';
import type { MaintenanceVisitRow } from '@/lib/crm/maintenance-visits-db';

export interface VisitReportMedia {
  id: string;
  phase: 'before' | 'after';
  kind: 'photo' | 'video';
  caption: string | null;
  orientation: string | null;
  mimeType: string;
  url: string | null;
  createdAt: string;
}

export interface VisitReport {
  visit: {
    id: string;
    status: MaintenanceVisitRow['status'];
    startedAt: string;
    endedAt: string | null;
    /** Time on site without breaks. */
    activeSeconds: number | null;
    breakSeconds: number;
    workerCount: number;
    laborSeconds: number | null;
    notes: string | null;
    workSummary: string | null;
  };
  property: {
    customerId: string;
    customerName: string;
    phone: string | null;
    email: string | null;
    placeName: string | null;
    address: string;
    houseId: string | null;
    agreementName: string | null;
    frequency: string | null;
    nextVisitDate: string | null;
    scopeOfWork: string | null;
    accessNotes: string | null;
  };
  responsible: string | null;
  crew: string[];
  project: { id: string; name: string } | null;
  services: { name: string; description: string | null }[];
  media: VisitReportMedia[];
  plants: { name: string; quantity: number; area: string | null; notes: string | null; photoCount: number }[];
}

/** Everything the visit report shows: the visit, the house, who worked, what was done, and before/after media. */
export async function loadVisitReport(scope: CrmScope, visitId: string): Promise<VisitReport | null> {
  const db = scope.supabase;
  const { data: visitData } = await db
    .from('pro_crm_maintenance_visits')
    .select('*')
    .eq('id', visitId)
    .eq('owner_id', scope.ownerId)
    .maybeSingle();
  if (!visitData) return null;
  const visit = visitData as MaintenanceVisitRow;

  const [contactRes, planRes, servicesRes, mediaRes, crewRes, projectRes] = await Promise.all([
    db.from('pro_crm_customers').select(CONTACT_SELECT).eq('id', visit.customer_id).maybeSingle(),
    visit.maintenance_plan_id
      ? db.from('pro_crm_maintenance_plans').select(PLAN_SELECT).eq('id', visit.maintenance_plan_id).maybeSingle()
      : Promise.resolve({ data: null }),
    db
      .from('pro_crm_maintenance_visit_services')
      .select('name, description, sort_order')
      .eq('visit_id', visitId)
      .order('sort_order', { ascending: true }),
    db
      .from('pro_crm_maintenance_visit_media')
      .select('id, phase, kind, drive_file_id, caption, orientation, sort_order, created_at')
      .eq('visit_id', visitId)
      .order('sort_order', { ascending: true }),
    db.from('pro_crm_maintenance_visit_crew').select('crew_member_id, contact_id, is_responsible').eq('visit_id', visitId),
    visit.project_id
      ? db.from('pro_crm_projects').select('id, name').eq('id', visit.project_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const contact = (contactRes.data as ContactRow | null) ?? undefined;
  const plan = (planRes.data as PlanRow | null) ?? null;
  const location = plan
    ? houseLocation(plan, contact, await loadPlaces(housePlaceIds([plan], [contact])))
    : contact
      ? contactAddress(contact)
      : { placeName: null, address: '', city: null };

  // People: the responsible one, then everyone else on the visit.
  const crewRows = (crewRes.data ?? []) as Array<{ crew_member_id: string | null; contact_id: string | null; is_responsible: boolean }>;
  const crewIds = [...new Set([visit.responsible_crew_id, ...crewRows.map((row) => row.crew_member_id)].filter(Boolean))] as string[];
  const contactIds = [...new Set([visit.responsible_contact_id, ...crewRows.map((row) => row.contact_id)].filter(Boolean))] as string[];
  const [{ data: crewMembers }, { data: crewContacts }] = await Promise.all([
    crewIds.length
      ? db.from('business_crew_members').select('id, display_name, email').in('id', crewIds)
      : Promise.resolve({ data: [] }),
    contactIds.length
      ? db.from('pro_crm_customers').select('id, first_name, last_name, display_name, company_name').in('id', contactIds)
      : Promise.resolve({ data: [] }),
  ]);
  const nameOf = new Map<string, string>();
  for (const member of (crewMembers ?? []) as Array<{ id: string; display_name: string | null; email: string | null }>) {
    nameOf.set(member.id, member.display_name || member.email || 'Crew member');
  }
  for (const person of (crewContacts ?? []) as Array<{ id: string; first_name: string | null; last_name: string | null; display_name: string | null; company_name: string | null }>) {
    nameOf.set(person.id, contactDisplayName(person));
  }
  const responsibleId = visit.responsible_crew_id ?? visit.responsible_contact_id;
  const responsible = responsibleId ? nameOf.get(responsibleId) ?? null : null;
  const crew = [...new Set(crewRows.map((row) => nameOf.get((row.crew_member_id ?? row.contact_id) as string)).filter(Boolean))] as string[];

  // Media with short-lived links.
  const mediaRows = (mediaRes.data ?? []) as Array<{
    id: string;
    phase: 'before' | 'after';
    kind: 'photo' | 'video';
    drive_file_id: string;
    caption: string | null;
    orientation: string | null;
    created_at: string;
  }>;
  const fileIds = mediaRows.map((row) => row.drive_file_id);
  const { data: files } = fileIds.length
    ? await db.from('pro_drive_files').select('id, mime_type, storage_path').in('id', fileIds)
    : { data: [] };
  const fileById = new Map(((files ?? []) as Array<{ id: string; mime_type: string | null; storage_path: string | null }>).map((file) => [file.id, file]));
  const paths = mediaRows.map((row) => fileById.get(row.drive_file_id)?.storage_path).filter((path): path is string => Boolean(path));
  const signedByPath = new Map<string, string | null>();
  if (paths.length > 0) {
    const { data: signed } = await db.storage.from(PRO_DRIVE_BUCKET).createSignedUrls(paths, PRO_DRIVE_SIGNED_URL_SECONDS);
    (signed ?? []).forEach((entry: { path: string | null; signedUrl: string | null }) => {
      if (entry.path) signedByPath.set(entry.path, entry.signedUrl);
    });
  }
  const media: VisitReportMedia[] = mediaRows.map((row) => {
    const file = fileById.get(row.drive_file_id);
    return {
      id: row.id,
      phase: row.phase,
      kind: row.kind,
      caption: row.caption,
      orientation: row.orientation,
      mimeType: file?.mime_type ?? '',
      url: file?.storage_path ? signedByPath.get(file.storage_path) ?? null : null,
      createdAt: row.created_at,
    };
  });

  const plants = await listPlants(db, scope.ownerId, visit.customer_id, {
    withImageUrls: false,
    planId: visit.maintenance_plan_id,
  }).catch(() => []);

  return {
    visit: {
      id: visit.id,
      status: visit.status,
      startedAt: visit.started_at,
      endedAt: visit.ended_at,
      activeSeconds: visit.duration_seconds,
      breakSeconds: visit.break_seconds ?? 0,
      workerCount: visit.worker_count ?? 1,
      laborSeconds: visit.labor_seconds,
      notes: visit.notes,
      workSummary: visit.generated_description,
    },
    property: {
      customerId: visit.customer_id,
      customerName: contact ? contactDisplayName(contact) : 'Customer',
      phone: contact?.phone ?? null,
      email: contact?.email ?? null,
      placeName: location.placeName,
      address: location.address,
      houseId: plan?.id ?? null,
      agreementName: plan?.name ?? null,
      frequency: plan?.frequency ?? null,
      nextVisitDate: plan?.next_visit_date ?? null,
      scopeOfWork: plan?.scope_of_work ?? null,
      accessNotes: plan?.access_notes ?? null,
    },
    responsible,
    crew,
    project: (projectRes.data as { id: string; name: string } | null) ?? null,
    services: ((servicesRes.data ?? []) as Array<{ name: string; description: string | null }>).map((service) => ({
      name: service.name,
      description: service.description,
    })),
    media,
    plants: plants.map((plant) => ({
      name: plant.name,
      quantity: plant.quantity,
      area: plant.area,
      notes: plant.notes,
      photoCount: plant.images.length,
    })),
  };
}
