/**
 * Tax-ready books: how a pro's expense categories land on IRS Schedule C (Form 1040), and the
 * yearly math (mileage, 1099s, self-employment tax). Pure functions, shared by the Tax summary
 * report and ProBot. This is preparation help, not tax advice: the pro reviews it with their
 * tax professional.
 */

export interface ScheduleCLine {
  /** Line on Schedule C, e.g. "8", "24b", "Part III". */
  line: string;
  label: string;
}

/** Schedule C lines used by house pros. */
export const SCHEDULE_C_LINES = {
  advertising: { line: '8', label: 'Advertising' },
  car: { line: '9', label: 'Car and truck expenses' },
  commissions: { line: '10', label: 'Commissions and fees' },
  contractLabor: { line: '11', label: 'Contract labor' },
  depreciation: { line: '13', label: 'Depreciation and section 179' },
  insurance: { line: '15', label: 'Insurance (other than health)' },
  legal: { line: '17', label: 'Legal and professional services' },
  office: { line: '18', label: 'Office expense' },
  rentEquipment: { line: '20a', label: 'Rent or lease: vehicles, machinery, equipment' },
  rentOther: { line: '20b', label: 'Rent or lease: other business property' },
  repairs: { line: '21', label: 'Repairs and maintenance' },
  supplies: { line: '22', label: 'Supplies' },
  taxes: { line: '23', label: 'Taxes and licenses' },
  travel: { line: '24a', label: 'Travel' },
  meals: { line: '24b', label: 'Deductible meals (50%)' },
  utilities: { line: '25', label: 'Utilities' },
  wages: { line: '26', label: 'Wages' },
  other: { line: '27a', label: 'Other expenses' },
  cogs: { line: 'Part III', label: 'Cost of goods sold (materials and job costs)' },
} as const satisfies Record<string, ScheduleCLine>;

export type ScheduleCKey = keyof typeof SCHEDULE_C_LINES;

/** Expense category (lib/crm/job-financials.ts) → Schedule C line. Unknown categories go to Other. */
const CATEGORY_LINE: Record<string, ScheduleCKey> = {
  materials: 'cogs',
  delivery: 'cogs',
  disposal: 'cogs',
  permits: 'taxes',
  labor: 'contractLabor',
  subcontractor: 'contractLabor',
  equipment: 'rentEquipment',
  tools: 'supplies',
  fuel: 'car',
  vehicle: 'car',
  mileage: 'car',
  insurance: 'insurance',
  'workers comp': 'insurance',
  advertising: 'advertising',
  marketing: 'advertising',
  signs: 'advertising',
  photography: 'advertising',
  staging: 'other',
  commissions: 'commissions',
  'card fees': 'commissions',
  office: 'office',
  software: 'office',
  phone: 'utilities',
  accounting: 'legal',
  rent: 'rentOther',
  utilities: 'utilities',
  licenses: 'taxes',
  taxes: 'taxes',
  supplies: 'supplies',
  meals: 'meals',
  payroll: 'wages',
  repairs: 'repairs',
  training: 'other',
  dues: 'other',
};

export function scheduleCKeyFor(category: string | null | undefined): ScheduleCKey {
  return CATEGORY_LINE[(category ?? '').trim().toLowerCase()] ?? 'other';
}

/** Share of an expense that is deductible: business meals are 50%. */
export function deductibleShare(key: ScheduleCKey): number {
  return key === 'meals' ? 0.5 : 1;
}

/** Categories that are the car and truck line (actual expense method). */
export function isVehicleCategory(category: string | null | undefined): boolean {
  return scheduleCKeyFor(category) === 'car';
}

/**
 * IRS standard mileage rate for business, in cents per mile, by tax year.
 * Check irs.gov each year (Notice "Standard mileage rates") and add the new year here.
 */
export const IRS_MILEAGE_CENTS: Record<number, number> = {
  2023: 65.5,
  2024: 67,
  2025: 70,
  2026: 72.5,
};

export function irsMileageCents(year: number): number {
  if (IRS_MILEAGE_CENTS[year]) return IRS_MILEAGE_CENTS[year];
  const known = Object.keys(IRS_MILEAGE_CENTS).map(Number).sort((a, b) => a - b);
  const latest = known.filter((y) => y <= year).pop() ?? known[0];
  return IRS_MILEAGE_CENTS[latest];
}

export interface MileageChoice {
  miles: number;
  rateCents: number;
  standardCents: number;
  actualCents: number;
  /** The method that gives the larger deduction. */
  best: 'standard' | 'actual';
  bestCents: number;
}

/**
 * Standard mileage (miles × IRS rate) against actual vehicle costs (fuel, repairs, insurance on the
 * vehicle). The larger one is suggested. Note for the pro: the standard rate must be chosen in the
 * first year a vehicle is used for business to switch between methods later.
 */
export function compareMileage(miles: number, actualCents: number, year: number): MileageChoice {
  const rateCents = irsMileageCents(year);
  const standardCents = Math.round(Math.max(0, miles) * rateCents);
  const actual = Math.max(0, Math.round(actualCents));
  const best = standardCents >= actual ? 'standard' : 'actual';
  return { miles, rateCents, standardCents, actualCents: actual, best, bestCents: Math.max(standardCents, actual) };
}

/** Form 1099-NEC: $600 or more paid to a non-employee by cash, check or bank transfer. */
export const FORM_1099_THRESHOLD_CENTS = 60_000;

/** Card and payment-app payments are reported by the card company (1099-K), not by the pro. */
export function countsFor1099(paymentMethod: string | null | undefined): boolean {
  const method = (paymentMethod ?? '').toLowerCase();
  return method !== 'card' && method !== 'credit_card';
}

/**
 * Self-employment tax estimate: 15.3% on 92.35% of net profit (Social Security part capped at the
 * yearly wage base). An estimate only; income tax comes on top.
 */
export const SS_WAGE_BASE_CENTS: Record<number, number> = {
  2024: 16_860_000,
  2025: 17_610_000,
  2026: 18_450_000,
};

export function selfEmploymentTaxCents(netProfitCents: number, year: number): number {
  if (netProfitCents <= 0) return 0;
  const base = Math.round(netProfitCents * 0.9235);
  if (base < 40_000) return 0; // under $400 of net earnings: no SE tax
  const known = Object.keys(SS_WAGE_BASE_CENTS).map(Number).sort((a, b) => a - b);
  const wageBase = SS_WAGE_BASE_CENTS[year] ?? SS_WAGE_BASE_CENTS[known.filter((y) => y <= year).pop() ?? known[0]];
  const socialSecurity = Math.round(Math.min(base, wageBase) * 0.124);
  const medicare = Math.round(base * 0.029);
  return socialSecurity + medicare;
}
