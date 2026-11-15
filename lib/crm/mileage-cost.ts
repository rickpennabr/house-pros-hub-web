/** Turns the numbers stored on a vehicle into a cost per mile and an average trip. */

const YEARLY_CENTS_CAP = 100_000_000;
const FUEL_CENTS_CAP = 9_900;
const NAME_CAP = 80;
const NOTE_CAP = 500;
const LABEL_CAP = 200;

const VEHICLE_COST_CATEGORIES = new Set([
  'fuel',
  'vehicle',
  'insurance',
  'repairs',
  'maintenance',
  'registration',
  'tires',
  'depreciation',
]);

export const TRIP_PURPOSES = ['job', 'estimate', 'supply_run', 'other'] as const;
export type TripPurpose = (typeof TRIP_PURPOSES)[number];

export interface VehicleCostInput {
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
}

export interface VehicleCostBreakdown {
  fixedPerYearCents: number;
  fuelPerMileCents: number | null;
  fixedPerMileCents: number | null;
  costPerMileCents: number | null;
  gallonsPerTrip: number | null;
  fuelPerTripCents: number | null;
  fixedPerTripCents: number | null;
  averageTripCents: number | null;
  /** Gas price and yearly costs can both be turned into a per-mile rate. */
  ready: boolean;
  missing: Array<'mpg' | 'fuelPrice' | 'annualMiles' | 'averageTripMiles'>;
}

export interface VehicleWrite {
  name: string;
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
  note: string | null;
}

export interface TripWrite {
  vehicleId: string;
  customerId: string | null;
  estimateId: string | null;
  projectId: string | null;
  tripDate: string;
  purpose: TripPurpose;
  origin: string | null;
  destination: string | null;
  miles: number;
  note: string | null;
}

export interface ActualVehicleCost {
  expenseCents: number;
  byCategory: Record<string, number>;
  loggedMiles: number;
  miles: number | null;
  milesSource: 'trips' | 'yearly' | 'none';
  costPerMileCents: number | null;
  averageTripCents: number | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Fuel and ownership costs that feed the vehicle. Mileage is the result, so it is not an input. */
export function isVehicleCostCategory(category: string): boolean {
  return VEHICLE_COST_CATEGORIES.has(category.trim().toLowerCase());
}

/** An expense can be tagged to a vehicle when it is an input, or a posted trip. */
export function categoryUsesVehicle(category: string): boolean {
  const key = category.trim().toLowerCase();
  return key === 'mileage' || isVehicleCostCategory(category);
}

function positive(value: number | null): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

function yearlyCents(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value);
}

export function vehicleCost(input: VehicleCostInput): VehicleCostBreakdown {
  const insuranceCents = yearlyCents(input.insuranceCents);
  const maintenanceCents = yearlyCents(input.maintenanceCents);
  const registrationCents = yearlyCents(input.registrationCents);
  const tiresCents = yearlyCents(input.tiresCents);
  const depreciationCents = yearlyCents(input.depreciationCents);
  const otherCents = yearlyCents(input.otherCents);
  const fixedPerYearCents = insuranceCents + maintenanceCents + registrationCents + tiresCents + depreciationCents + otherCents;

  const mpg = positive(input.mpg);
  const annualMiles = positive(input.annualMiles);
  const tripMiles = input.averageTripMiles != null && Number.isFinite(input.averageTripMiles) && input.averageTripMiles >= 0
    ? input.averageTripMiles
    : null;
  const fuelPrice = input.fuelPriceCents != null && Number.isFinite(input.fuelPriceCents) && input.fuelPriceCents >= 0
    ? input.fuelPriceCents
    : null;

  const missing: VehicleCostBreakdown['missing'] = [];
  if (mpg == null) missing.push('mpg');
  if (fuelPrice == null) missing.push('fuelPrice');
  if (fixedPerYearCents > 0 && annualMiles == null) missing.push('annualMiles');
  if (tripMiles == null) missing.push('averageTripMiles');

  const fuelPerMileCents = mpg != null && fuelPrice != null ? fuelPrice / mpg : null;
  const fixedPerMileCents = fixedPerYearCents === 0 ? 0 : annualMiles != null ? fixedPerYearCents / annualMiles : null;
  const costPerMileCents = fuelPerMileCents != null && fixedPerMileCents != null
    ? fuelPerMileCents + fixedPerMileCents
    : null;
  const gallonsPerTrip = mpg != null && tripMiles != null ? tripMiles / mpg : null;
  const fuelPerTripCents = gallonsPerTrip != null && fuelPrice != null ? gallonsPerTrip * fuelPrice : null;
  const fixedPerTripCents = fixedPerMileCents != null && tripMiles != null ? fixedPerMileCents * tripMiles : null;
  const averageTripCents = costPerMileCents != null && tripMiles != null
    ? Math.round(costPerMileCents * tripMiles)
    : null;

  return {
    fixedPerYearCents,
    fuelPerMileCents,
    fixedPerMileCents,
    costPerMileCents,
    gallonsPerTrip,
    fuelPerTripCents,
    fixedPerTripCents,
    averageTripCents,
    ready: costPerMileCents != null,
    missing,
  };
}

export function tripAmountCents(miles: number, costPerMileCents: number): number {
  if (!Number.isFinite(miles) || miles <= 0) return 0;
  if (!Number.isFinite(costPerMileCents) || costPerMileCents < 0) return 0;
  return Math.round(miles * costPerMileCents);
}

export function tripRateError(cost: VehicleCostBreakdown): string | null {
  if (cost.costPerMileCents != null) return null;
  if (cost.missing.includes('mpg') || cost.missing.includes('fuelPrice')) {
    return 'Add miles per gallon and a gas price on this vehicle. Use 0 for the gas price if you are not counting fuel.';
  }
  if (cost.missing.includes('annualMiles')) {
    return 'Add how many miles this vehicle drives in a year so insurance and the other yearly costs can be split per mile.';
  }
  return 'This vehicle does not have a cost per mile yet.';
}

export function actualVehicleCost(
  input: VehicleCostInput,
  expenses: { category: string; amountCents: number }[],
  loggedMiles: number
): ActualVehicleCost {
  const byCategory: Record<string, number> = {};
  let expenseCents = 0;
  for (const expense of expenses) {
    if (!isVehicleCostCategory(expense.category)) continue;
    if (!Number.isFinite(expense.amountCents) || expense.amountCents === 0) continue;
    const key = expense.category.trim().toLowerCase();
    byCategory[key] = (byCategory[key] ?? 0) + expense.amountCents;
    expenseCents += expense.amountCents;
  }

  const trips = Number.isFinite(loggedMiles) && loggedMiles > 0 ? loggedMiles : 0;
  const yearly = positive(input.annualMiles);
  const miles = trips > 0 ? trips : yearly;
  const milesSource: ActualVehicleCost['milesSource'] = trips > 0 ? 'trips' : yearly != null ? 'yearly' : 'none';
  const costPerMileCents = miles != null && miles > 0 ? expenseCents / miles : null;
  const tripMiles = input.averageTripMiles != null && Number.isFinite(input.averageTripMiles) && input.averageTripMiles >= 0
    ? input.averageTripMiles
    : null;
  const averageTripCents = costPerMileCents != null && tripMiles != null
    ? Math.round(costPerMileCents * tripMiles)
    : null;

  return {
    expenseCents,
    byCategory,
    loggedMiles: trips,
    miles,
    milesSource,
    costPerMileCents,
    averageTripCents,
  };
}

/** Copy tagged expenses into the yearly fields. Gas stays in miles per gallon and price per gallon. */
export function yearlyDraftFromExpenses(byCategory: Record<string, number>): {
  insuranceCents: number;
  maintenanceCents: number;
  registrationCents: number;
  tiresCents: number;
  depreciationCents: number;
  otherCents: number;
} {
  const amount = (key: string) => (Number.isFinite(byCategory[key]) ? byCategory[key] : 0);
  return {
    insuranceCents: amount('insurance'),
    maintenanceCents: amount('maintenance') + amount('repairs'),
    registrationCents: amount('registration'),
    tiresCents: amount('tires'),
    depreciationCents: amount('depreciation'),
    otherCents: amount('vehicle'),
  };
}

function text(value: unknown, cap: number): string | null | 'bad' {
  if (value == null) return null;
  if (typeof value !== 'string') return 'bad';
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > cap) return 'bad';
  return trimmed;
}

function isIdError(value: string | null | { error: string }): value is { error: string } {
  return value != null && typeof value === 'object';
}

function optionalUuid(value: unknown): string | null | { error: string } {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || !UUID.test(value)) return { error: 'invalid' };
  return value;
}

function optionalNumber(value: unknown): number | null | 'bad' {
  if (value == null || value === '') return null;
  const amount = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : Number.NaN;
  if (!Number.isFinite(amount)) return 'bad';
  return amount;
}

function centsField(value: unknown, label: string): { ok: true; value: number } | { ok: false; error: string } {
  const amount = optionalNumber(value);
  if (amount === 'bad' || (amount != null && amount < 0)) return { ok: false, error: `${label} must be a positive amount.` };
  const cents = amount == null ? 0 : Math.round(amount);
  if (cents > YEARLY_CENTS_CAP) return { ok: false, error: `${label} is too large.` };
  return { ok: true, value: cents };
}

export function parseVehicleWrite(body: unknown): { ok: true; value: VehicleWrite } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Vehicle details are required.' };
  const record = body as Record<string, unknown>;
  const name = text(record.name, NAME_CAP);
  if (name === 'bad') return { ok: false, error: 'Vehicle name is too long.' };
  if (!name) return { ok: false, error: 'Name the vehicle.' };

  const mpg = optionalNumber(record.mpg);
  if (mpg === 'bad' || (mpg != null && (mpg <= 0 || mpg > 200))) {
    return { ok: false, error: 'Miles per gallon must be greater than 0 and at most 200.' };
  }
  const fuelPriceCents = optionalNumber(record.fuelPriceCents);
  if (fuelPriceCents === 'bad' || (fuelPriceCents != null && (fuelPriceCents < 0 || fuelPriceCents > FUEL_CENTS_CAP))) {
    return { ok: false, error: 'Gas price must be between $0 and $99 per gallon.' };
  }
  const annualMiles = optionalNumber(record.annualMiles);
  if (annualMiles === 'bad' || (annualMiles != null && (annualMiles <= 0 || annualMiles > 500_000))) {
    return { ok: false, error: 'Yearly miles must be between 1 and 500,000.' };
  }
  const averageTripMiles = optionalNumber(record.averageTripMiles);
  if (averageTripMiles === 'bad' || (averageTripMiles != null && (averageTripMiles < 0 || averageTripMiles > 5_000))) {
    return { ok: false, error: 'Average trip miles must be between 0 and 5,000.' };
  }

  const insurance = centsField(record.insuranceCents, 'Insurance');
  if (!insurance.ok) return insurance;
  const maintenance = centsField(record.maintenanceCents, 'Maintenance');
  if (!maintenance.ok) return maintenance;
  const registration = centsField(record.registrationCents, 'Registration');
  if (!registration.ok) return registration;
  const tires = centsField(record.tiresCents, 'Tires');
  if (!tires.ok) return tires;
  const depreciation = centsField(record.depreciationCents, 'Depreciation');
  if (!depreciation.ok) return depreciation;
  const other = centsField(record.otherCents, 'Other vehicle costs');
  if (!other.ok) return other;

  const note = text(record.note, NOTE_CAP);
  if (note === 'bad') return { ok: false, error: 'Note is too long.' };

  return {
    ok: true,
    value: {
      name,
      mpg,
      fuelPriceCents: fuelPriceCents == null ? null : Math.round(fuelPriceCents),
      annualMiles,
      averageTripMiles,
      insuranceCents: insurance.value,
      maintenanceCents: maintenance.value,
      registrationCents: registration.value,
      tiresCents: tires.value,
      depreciationCents: depreciation.value,
      otherCents: other.value,
      note,
    },
  };
}

export function parseTripWrite(body: unknown): { ok: true; value: TripWrite } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Trip details are required.' };
  const record = body as Record<string, unknown>;
  const vehicleId = typeof record.vehicleId === 'string' ? record.vehicleId : '';
  if (!UUID.test(vehicleId)) return { ok: false, error: 'Choose a vehicle for this trip.' };

  const projectId = optionalUuid(record.projectId);
  if (isIdError(projectId)) return { ok: false, error: 'Project not found.' };
  const customerId = optionalUuid(record.customerId);
  if (isIdError(customerId)) return { ok: false, error: 'Customer not found.' };
  const estimateId = optionalUuid(record.estimateId);
  if (isIdError(estimateId)) return { ok: false, error: 'Estimate not found.' };

  const tripDate = typeof record.tripDate === 'string' ? record.tripDate : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tripDate)) return { ok: false, error: 'Choose a trip date.' };

  const purpose = record.purpose;
  if (typeof purpose !== 'string' || !TRIP_PURPOSES.includes(purpose as TripPurpose)) {
    return { ok: false, error: 'Choose why this trip was driven.' };
  }

  const origin = text(record.origin, LABEL_CAP);
  if (origin === 'bad') return { ok: false, error: 'Starting place is too long.' };
  const destination = text(record.destination, LABEL_CAP);
  if (destination === 'bad') return { ok: false, error: 'Destination is too long.' };

  const milesRaw = optionalNumber(record.miles);
  if (milesRaw === 'bad' || milesRaw == null || milesRaw <= 0 || milesRaw > 5_000) {
    return { ok: false, error: 'Miles must be between 0 and 5,000.' };
  }
  const miles = Math.round(milesRaw * 10) / 10;

  const note = text(record.note, NOTE_CAP);
  if (note === 'bad') return { ok: false, error: 'Note is too long.' };

  return {
    ok: true,
    value: {
      vehicleId,
      customerId,
      estimateId,
      projectId,
      tripDate,
      purpose: purpose as TripPurpose,
      origin,
      destination,
      miles,
      note,
    },
  };
}

export function costInputOf(value: VehicleWrite | VehicleCostInput): VehicleCostInput {
  return {
    mpg: value.mpg,
    fuelPriceCents: value.fuelPriceCents,
    annualMiles: value.annualMiles,
    averageTripMiles: value.averageTripMiles,
    insuranceCents: value.insuranceCents,
    maintenanceCents: value.maintenanceCents,
    registrationCents: value.registrationCents,
    tiresCents: value.tiresCents,
    depreciationCents: value.depreciationCents,
    otherCents: value.otherCents,
  };
}
