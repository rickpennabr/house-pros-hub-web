import { z } from 'zod';
import type { CrmDb } from '@/lib/crm/crm-scope';
import { contactDisplayName } from '@/lib/crm/contact-name';
import { MAINTENANCE_FREQUENCIES } from '@/lib/crm/estimate-agreement';
import type { MaintenanceHouseStatus } from '@/lib/crm/list-charts';
import { createServiceRoleClient } from '@/lib/supabase/server';

/**
 * A maintenance house is one maintenance agreement (pro_crm_maintenance_plans row) on one of a
 * contact's houses: the place the customer shared (place_id), or the contact's own address.
 */

export const PLAN_SELECT =
  'id, customer_id, place_id, name, summary, scope_of_work, access_notes, frequency, next_visit_date, last_visit_date, end_date, is_active, amount_cents, source_estimate_id, created_at, updated_at';

export const CONTACT_SELECT =
  'id, first_name, last_name, display_name, company_name, phone, email, place_id, street_address, apartment, city, state, zip_code, billing_address_street_1, billing_address_city, billing_address_state, billing_address_zip_code';

export type PlanRow = {
  id: string;
  customer_id: string;
  place_id: string | null;
  name: string;
  summary: string | null;
  scope_of_work: string | null;
  access_notes: string | null;
  frequency: string;
  next_visit_date: string | null;
  last_visit_date: string | null;
  end_date: string | null;
  is_active: boolean;
  amount_cents: number | null;
  source_estimate_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ContactRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  company_name: string | null;
  phone: string | null;
  email: string | null;
  /** The contact's default house in My Places, when linked. */
  place_id: string | null;
  street_address: string | null;
  apartment: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  billing_address_street_1: string | null;
  billing_address_city: string | null;
  billing_address_state: string | null;
  billing_address_zip_code: string | null;
};

type PlaceRow = {
  id: string;
  name: string;
  street: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
};

export interface HouseLocation {
  /** House nickname from My Places, when the agreement names one. */
  placeName: string | null;
  address: string;
  city: string | null;
}

export function contactAddress(contact: ContactRow): HouseLocation {
  const home = [contact.street_address, contact.apartment, contact.city, contact.state, contact.zip_code]
    .filter(Boolean)
    .join(', ');
  const billing = [
    contact.billing_address_street_1,
    contact.billing_address_city,
    contact.billing_address_state,
    contact.billing_address_zip_code,
  ]
    .filter(Boolean)
    .join(', ');
  return { placeName: null, address: home || billing, city: contact.city || contact.billing_address_city || null };
}

/**
 * Customer places are the customer's own rows (RLS keeps pros out), so read them with the
 * service role. Callers only pass place ids taken from this owner's agreements.
 */
export async function loadPlaces(placeIds: string[]): Promise<Map<string, PlaceRow>> {
  const ids = [...new Set(placeIds.filter(Boolean))];
  if (ids.length === 0) return new Map();
  const { data } = await createServiceRoleClient()
    .from('customer_places')
    .select('id, name, street, city, state, zip_code')
    .in('id', ids);
  return new Map(((data ?? []) as PlaceRow[]).map((place) => [place.id, place]));
}

/** Place ids a house can take its address from: the agreement's place, then the contact's default house. */
export function housePlaceIds(plans: Array<Pick<PlanRow, 'place_id'>>, contacts: Array<ContactRow | undefined>): string[] {
  return [...plans.map((plan) => plan.place_id ?? ''), ...contacts.map((contact) => contact?.place_id ?? '')];
}

function placeAddress(place: PlaceRow) {
  return [place.street, place.city, place.state, place.zip_code].filter(Boolean).join(', ');
}

/**
 * Where the house is, so it can be listed and pinned on the map. Uses the first source that has
 * an address: the agreement's place, the contact's own address, then the contact's default place.
 */
export function houseLocation(plan: PlanRow, contact: ContactRow | undefined, places: Map<string, PlaceRow>): HouseLocation {
  const place = plan.place_id ? places.get(plan.place_id) : undefined;
  const own = contact ? contactAddress(contact) : { placeName: null, address: '', city: null };
  if (place && placeAddress(place)) {
    return { placeName: place.name, address: placeAddress(place), city: place.city };
  }
  if (own.address) return { ...own, placeName: place?.name ?? null };
  const fallback = contact?.place_id ? places.get(contact.place_id) : undefined;
  if (fallback && placeAddress(fallback)) {
    return { placeName: place?.name ?? fallback.name, address: placeAddress(fallback), city: fallback.city };
  }
  return { ...own, placeName: place?.name ?? null };
}

function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function houseStatus(plan: Pick<PlanRow, 'is_active' | 'end_date' | 'next_visit_date'>, today: string): MaintenanceHouseStatus {
  if (!plan.is_active || (plan.end_date && plan.end_date < today)) return 'ended';
  if (!plan.next_visit_date) return 'scheduled';
  if (plan.next_visit_date < today) return 'overdue';
  if (plan.next_visit_date <= addDays(today, 7)) return 'due_soon';
  return 'scheduled';
}

export function houseContactName(contact: ContactRow | undefined) {
  return contact ? contactDisplayName(contact) : 'Contact';
}

/** Visits filed on this agreement, plus older visits with no agreement when the contact has only this one. */
export function visitBelongsToHouse(
  visit: { customer_id: string; maintenance_plan_id: string | null },
  plan: Pick<PlanRow, 'id' | 'customer_id'>,
  plansForContact: number
) {
  if (visit.maintenance_plan_id) return visit.maintenance_plan_id === plan.id;
  return visit.customer_id === plan.customer_id && plansForContact === 1;
}

const dateKey = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date')
  .nullable()
  .optional();

/** Agreement fields shared by add and edit. */
export const houseAgreementSchema = z.object({
  placeId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1, 'Name the agreement').max(120),
  frequency: z.enum(MAINTENANCE_FREQUENCIES),
  amountCents: z.number().int().min(0).max(100_000_000).nullable().optional(),
  nextVisitDate: dateKey,
  endDate: dateKey,
  scopeOfWork: z.string().trim().max(4000).nullable().optional(),
  accessNotes: z.string().trim().max(1000).nullable().optional(),
  summary: z.string().trim().max(1000).nullable().optional(),
});

export type HouseAgreementInput = z.infer<typeof houseAgreementSchema>;

export function agreementColumns(input: HouseAgreementInput) {
  return {
    name: input.name,
    frequency: input.frequency,
    amount_cents: input.amountCents ?? null,
    next_visit_date: input.nextVisitDate || null,
    end_date: input.endDate || null,
    scope_of_work: input.scopeOfWork || null,
    access_notes: input.accessNotes || null,
    summary: input.summary || null,
  };
}

export type { CrmDb };
