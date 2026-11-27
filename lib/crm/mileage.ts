import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/supabase';
import { contactDisplayName } from '@/lib/crm/contact-name';
import {
  actualVehicleCost,
  categoryUsesVehicle,
  costInputOf,
  tripAmountCents,
  tripRateError,
  vehicleCost,
  type TripPurpose,
  type TripWrite,
  type VehicleCostBreakdown,
  type VehicleWrite,
} from '@/lib/crm/mileage-cost';

type Client = SupabaseClient<Database>;
type VehicleRow = Database['public']['Tables']['pro_crm_vehicles']['Row'];
type TripRow = Database['public']['Tables']['pro_crm_mileage_trips']['Row'];

export const MILEAGE_SETUP_ERROR = 'Run the mileage database update before saving vehicles or trips.';

export function mileageSchemaMissing(message: string): boolean {
  const text = message.toLowerCase();
  return text.includes('pro_crm_vehicles') || text.includes('pro_crm_mileage_trips') || text.includes('vehicle_id') || text.includes('customer_id') || text.includes('estimate_id') || text.includes('schema cache');
}

export function asNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null;
  const amount = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(amount) ? amount : null;
}

export function trailingYear(today = new Date()): { from: string; to: string } {
  const to = today.toISOString().slice(0, 10);
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - 365);
  return { from: start.toISOString().slice(0, 10), to };
}

export function vehicleFromRow(row: VehicleRow): VehicleWrite & { id: string } {
  return {
    id: row.id,
    name: row.name,
    mpg: asNumber(row.mpg),
    fuelPriceCents: row.fuel_price_cents,
    annualMiles: asNumber(row.annual_miles),
    averageTripMiles: asNumber(row.average_trip_miles),
    insuranceCents: row.insurance_cents ?? 0,
    maintenanceCents: row.maintenance_cents ?? 0,
    registrationCents: row.registration_cents ?? 0,
    tiresCents: row.tires_cents ?? 0,
    depreciationCents: row.depreciation_cents ?? 0,
    otherCents: row.other_cents ?? 0,
    note: row.note,
  };
}

export async function resolveVehicleId(
  supabase: Client,
  ownerId: string,
  category: string,
  vehicleId: unknown
): Promise<{ id: string | null; error: string | null; status: number }> {
  if (!categoryUsesVehicle(category) || vehicleId == null || vehicleId === '') {
    return { id: null, error: null, status: 200 };
  }
  if (typeof vehicleId !== 'string') return { id: null, error: 'Vehicle not found', status: 400 };
  const { data, error } = await supabase.from('pro_crm_vehicles').select('id').eq('id', vehicleId).eq('owner_id', ownerId).maybeSingle();
  if (error) {
    if (mileageSchemaMissing(error.message)) return { id: null, error: MILEAGE_SETUP_ERROR, status: 400 };
    return { id: null, error: error.message, status: 500 };
  }
  if (!data) return { id: null, error: 'Vehicle not found', status: 404 };
  return { id: data.id, error: null, status: 200 };
}

export function vehicleColumns(value: VehicleWrite) {
  return {
    name: value.name,
    mpg: value.mpg,
    fuel_price_cents: value.fuelPriceCents,
    annual_miles: value.annualMiles,
    average_trip_miles: value.averageTripMiles,
    insurance_cents: value.insuranceCents,
    maintenance_cents: value.maintenanceCents,
    registration_cents: value.registrationCents,
    tires_cents: value.tiresCents,
    depreciation_cents: value.depreciationCents,
    other_cents: value.otherCents,
    note: value.note,
  };
}

export interface VehicleView {
  id: string;
  name: string;
  note: string | null;
  mpg: number | null;
  fuelPriceCents: number | null;
  annualMiles: number | null;
  averageTripMiles: number | null;
  insuranceCents: number;
  maintenanceCents: number;
  registrationCents: number;
  tiresCents: number;
  depreciationCents: number;
  otherCents: number;
  cost: VehicleCostBreakdown;
  actual: ReturnType<typeof actualVehicleCost>;
}

export function presentVehicle(
  row: VehicleRow,
  expenses: { vehicleId: string | null; category: string; amountCents: number }[],
  loggedMilesByVehicle: Map<string, number>
): VehicleView {
  const vehicle = vehicleFromRow(row);
  const mine = expenses.filter((expense) => expense.vehicleId === row.id);
  const input = costInputOf(vehicle);
  return {
    ...vehicle,
    cost: vehicleCost(input),
    actual: actualVehicleCost(input, mine, loggedMilesByVehicle.get(row.id) ?? 0),
  };
}

export interface TripView {
  id: string;
  vehicleId: string | null;
  vehicleName: string;
  customerId: string | null;
  customerName: string | null;
  estimateId: string | null;
  estimateLabel: string | null;
  projectId: string | null;
  tripDate: string;
  purpose: TripPurpose;
  origin: string | null;
  destination: string | null;
  miles: number;
  costPerMileCents: number;
  amountCents: number;
  note: string | null;
  expenseId: string | null;
  billed: boolean;
  /** Recorded live with GPS (has a route map). */
  tracked: boolean;
  tripTypeId: string | null;
}

export function presentTrip(row: TripRow, billed: boolean): TripView {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    vehicleName: row.vehicle_name,
    customerId: row.customer_id ?? null,
    customerName: null,
    estimateId: row.estimate_id ?? null,
    estimateLabel: null,
    projectId: row.project_id,
    tripDate: row.trip_date,
    purpose: row.purpose,
    origin: row.origin_label,
    destination: row.destination_label,
    miles: asNumber(row.miles) ?? 0,
    costPerMileCents: asNumber(row.cost_per_mile_cents) ?? 0,
    amountCents: row.amount_cents,
    note: row.note,
    expenseId: row.expense_id,
    billed,
    // Columns from migration 188 (absent before it runs).
    tracked: Boolean((row as { tracked?: boolean | null }).tracked),
    tripTypeId: (row as { trip_type_id?: string | null }).trip_type_id ?? null,
  };
}

export function priceTrip(vehicle: VehicleWrite, miles: number): { costPerMileCents: number; amountCents: number } | { error: string } {
  const cost = vehicleCost(costInputOf(vehicle));
  const error = tripRateError(cost);
  if (error || cost.costPerMileCents == null) return { error: error || 'This vehicle does not have a cost per mile yet.' };
  return {
    costPerMileCents: Math.round(cost.costPerMileCents * 10000) / 10000,
    amountCents: tripAmountCents(miles, cost.costPerMileCents),
  };
}

/** Confirm the project, customer, and estimate belong to this contractor. An estimate sets the customer. */
export async function resolveTripLinks(
  supabase: Client,
  ownerId: string,
  write: Pick<TripWrite, 'projectId' | 'customerId' | 'estimateId'>
): Promise<{ projectId: string | null; customerId: string | null; estimateId: string | null } | { error: string; status: number }> {
  if (write.projectId) {
    const { data, error } = await supabase.from('pro_crm_projects').select('id').eq('id', write.projectId).eq('owner_id', ownerId).maybeSingle();
    if (error) return { error: error.message, status: 500 };
    if (!data) return { error: 'Project not found', status: 404 };
  }

  let customerId = write.customerId;
  if (write.estimateId) {
    const { data, error } = await supabase
      .from('pro_crm_estimates')
      .select('id, customer_id')
      .eq('id', write.estimateId)
      .eq('owner_id', ownerId)
      .maybeSingle();
    if (error) return { error: error.message, status: 500 };
    if (!data) return { error: 'Estimate not found', status: 404 };
    if (customerId && customerId !== data.customer_id) {
      return { error: 'That estimate is for a different customer.', status: 400 };
    }
    customerId = data.customer_id;
  } else if (customerId) {
    const { data, error } = await supabase.from('pro_crm_customers').select('id').eq('id', customerId).eq('owner_id', ownerId).maybeSingle();
    if (error) return { error: error.message, status: 500 };
    if (!data) return { error: 'Customer not found', status: 404 };
  }

  return { projectId: write.projectId, customerId, estimateId: write.estimateId };
}

export async function tripListNames(
  supabase: Client,
  ownerId: string,
  trips: TripView[]
): Promise<TripView[]> {
  const customerIds = [...new Set(trips.map((trip) => trip.customerId).filter((id): id is string => Boolean(id)))];
  const estimateIds = [...new Set(trips.map((trip) => trip.estimateId).filter((id): id is string => Boolean(id)))];
  const customerNames = new Map<string, string>();
  const estimateLabels = new Map<string, string>();

  if (customerIds.length > 0) {
    const { data } = await supabase
      .from('pro_crm_customers')
      .select('id, display_name, company_name, first_name, last_name')
      .eq('owner_id', ownerId)
      .in('id', customerIds);
    for (const customer of data ?? []) customerNames.set(customer.id, contactDisplayName(customer));
  }
  if (estimateIds.length > 0) {
    const { data } = await supabase
      .from('pro_crm_estimates')
      .select('id, display_id')
      .eq('owner_id', ownerId)
      .in('id', estimateIds);
    for (const estimate of data ?? []) estimateLabels.set(estimate.id, estimate.display_id);
  }

  return trips.map((trip) => ({
    ...trip,
    customerName: trip.customerId ? customerNames.get(trip.customerId) ?? null : null,
    estimateLabel: trip.estimateId ? estimateLabels.get(trip.estimateId) ?? null : null,
  }));
}

export function tripColumns(ownerId: string, write: TripWrite, vehicleName: string, priced: { costPerMileCents: number; amountCents: number }) {
  return {
    owner_id: ownerId,
    vehicle_id: write.vehicleId,
    vehicle_name: vehicleName,
    customer_id: write.customerId,
    estimate_id: write.estimateId,
    project_id: write.projectId,
    trip_date: write.tripDate,
    purpose: write.purpose,
    origin_label: write.origin,
    destination_label: write.destination,
    miles: write.miles,
    cost_per_mile_cents: priced.costPerMileCents,
    amount_cents: priced.amountCents,
    note: write.note,
  };
}
