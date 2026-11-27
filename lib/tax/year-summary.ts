/**
 * A pro's tax year in one object: gross receipts, expenses by Schedule C line, mileage (standard vs
 * actual), net profit, self-employment tax estimate, 1099s to send and what is missing.
 * `buildTaxYearSummary` is pure (tested); `loadTaxYearSummary` reads the pro's books.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  compareMileage,
  countsFor1099,
  deductibleShare,
  FORM_1099_THRESHOLD_CENTS,
  isVehicleCategory,
  SCHEDULE_C_LINES,
  scheduleCKeyFor,
  selfEmploymentTaxCents,
  type MileageChoice,
  type ScheduleCKey,
} from '@/lib/tax/schedule-c';

export interface TaxPaymentRow {
  amount_cents: number;
  payment_date: string;
  method?: string | null;
  voided_at?: string | null;
}

export interface TaxExpenseRow {
  id: string;
  amount_cents: number;
  category: string | null;
  expense_date: string;
  receipt_url?: string | null;
  supplier_id?: string | null;
  payment_method?: string | null;
  note?: string | null;
}

export interface TaxTripRow {
  miles: number | string;
  trip_date: string;
}

export interface TaxContactRow {
  id: string;
  display_name: string | null;
  w9_received_at?: string | null;
  tax_id_last4?: string | null;
}

export interface TaxLineTotal {
  key: ScheduleCKey;
  line: string;
  label: string;
  spentCents: number;
  deductibleCents: number;
  count: number;
}

export interface Tax1099Row {
  contactId: string;
  name: string;
  paidCents: number;
  hasW9: boolean;
}

export interface TaxYearSummary {
  year: number;
  grossReceiptsCents: number;
  paymentCount: number;
  lines: TaxLineTotal[];
  /** Deductible expenses before the vehicle choice (vehicle costs are left out here). */
  expensesCents: number;
  mileage: MileageChoice;
  totalDeductionsCents: number;
  netProfitCents: number;
  selfEmploymentTaxCents: number;
  /** One quarter of the SE tax estimate (income tax not included). */
  quarterlySeTaxCents: number;
  form1099: Tax1099Row[];
  missingReceipts: Array<{ id: string; amountCents: number; date: string; category: string }>;
  uncategorizedCount: number;
}

/** Expenses over this need a receipt kept (IRS asks for receipts of $75 and up). */
export const RECEIPT_REQUIRED_CENTS = 7_500;

export function buildTaxYearSummary(input: {
  year: number;
  payments: TaxPaymentRow[];
  expenses: TaxExpenseRow[];
  trips: TaxTripRow[];
  contacts: TaxContactRow[];
  /** Contacts with the subcontractor role (1099 candidates). */
  subcontractorIds: Set<string>;
}): TaxYearSummary {
  const { year } = input;
  const inYear = (date: string) => typeof date === 'string' && date.slice(0, 4) === String(year);

  const payments = input.payments.filter((p) => !p.voided_at && inYear(p.payment_date));
  const grossReceiptsCents = payments.reduce((sum, p) => sum + Math.max(0, p.amount_cents), 0);

  const expenses = input.expenses.filter((e) => inYear(e.expense_date));
  const byLine = new Map<ScheduleCKey, TaxLineTotal>();
  let vehicleActualCents = 0;
  let uncategorizedCount = 0;
  for (const expense of expenses) {
    const amount = Math.max(0, expense.amount_cents);
    if (!expense.category || expense.category.toLowerCase() === 'other') uncategorizedCount += 1;
    if (isVehicleCategory(expense.category)) {
      vehicleActualCents += amount;
      continue;
    }
    const key = scheduleCKeyFor(expense.category);
    const meta = SCHEDULE_C_LINES[key];
    const row = byLine.get(key) ?? { key, line: meta.line, label: meta.label, spentCents: 0, deductibleCents: 0, count: 0 };
    row.spentCents += amount;
    row.deductibleCents += Math.round(amount * deductibleShare(key));
    row.count += 1;
    byLine.set(key, row);
  }
  const lines = [...byLine.values()].sort((a, b) => b.deductibleCents - a.deductibleCents);
  const expensesCents = lines.reduce((sum, line) => sum + line.deductibleCents, 0);

  const miles = input.trips
    .filter((t) => inYear(t.trip_date))
    .reduce((sum, t) => sum + (Number(t.miles) || 0), 0);
  const mileage = compareMileage(Math.round(miles * 10) / 10, vehicleActualCents, year);

  const totalDeductionsCents = expensesCents + mileage.bestCents;
  const netProfitCents = grossReceiptsCents - totalDeductionsCents;
  const seTax = selfEmploymentTaxCents(netProfitCents, year);

  // 1099-NEC: subcontractors paid $600+ by cash, check or transfer.
  const paidBy = new Map<string, number>();
  for (const expense of expenses) {
    if (!expense.supplier_id || !input.subcontractorIds.has(expense.supplier_id)) continue;
    if (!countsFor1099(expense.payment_method)) continue;
    paidBy.set(expense.supplier_id, (paidBy.get(expense.supplier_id) ?? 0) + Math.max(0, expense.amount_cents));
  }
  const contactById = new Map(input.contacts.map((c) => [c.id, c]));
  const form1099 = [...paidBy.entries()]
    .filter(([, cents]) => cents >= FORM_1099_THRESHOLD_CENTS)
    .map(([contactId, paidCents]) => {
      const contact = contactById.get(contactId);
      return {
        contactId,
        name: contact?.display_name?.trim() || 'Unnamed contact',
        paidCents,
        hasW9: Boolean(contact?.w9_received_at),
      };
    })
    .sort((a, b) => b.paidCents - a.paidCents);

  const missingReceipts = expenses
    .filter((e) => e.amount_cents >= RECEIPT_REQUIRED_CENTS && !e.receipt_url)
    .map((e) => ({ id: e.id, amountCents: e.amount_cents, date: e.expense_date, category: e.category ?? 'Other' }))
    .sort((a, b) => b.amountCents - a.amountCents);

  return {
    year,
    grossReceiptsCents,
    paymentCount: payments.length,
    lines,
    expensesCents,
    mileage,
    totalDeductionsCents,
    netProfitCents,
    selfEmploymentTaxCents: seTax,
    quarterlySeTaxCents: Math.round(seTax / 4),
    form1099,
    missingReceipts,
    uncategorizedCount,
  };
}

/** Reads the pro's books for one year (RLS: owner only) and builds the summary. */
export async function loadTaxYearSummary(supabase: SupabaseClient, ownerId: string, year: number): Promise<TaxYearSummary> {
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const [payments, expenses, trips, subRoles] = await Promise.all([
    supabase
      .from('pro_crm_invoice_payments')
      .select('amount_cents, payment_date, method, voided_at')
      .eq('owner_id', ownerId)
      .gte('payment_date', from)
      .lte('payment_date', to),
    // '*': payment_method arrives with migration 187; older databases still work.
    supabase.from('pro_crm_expenses').select('*').eq('owner_id', ownerId).gte('expense_date', from).lte('expense_date', to),
    supabase.from('pro_crm_mileage_trips').select('miles, trip_date').eq('owner_id', ownerId).gte('trip_date', from).lte('trip_date', to),
    // The Subcontractor role (system role, or one the pro named that way).
    supabase.from('pro_crm_roles').select('id, slug, name').or(`owner_id.is.null,owner_id.eq.${ownerId}`),
  ]);
  const expenseRows = (expenses.data ?? []) as TaxExpenseRow[];
  const subRoleIds = ((subRoles.data ?? []) as Array<{ id: string; slug: string; name: string }>)
    .filter((role) => /subcontract/i.test(`${role.slug} ${role.name}`))
    .map((role) => role.id);
  const supplierIds = [...new Set(expenseRows.map((e) => e.supplier_id).filter((id): id is string => Boolean(id)))];
  const [contactsRes, linksRes] = supplierIds.length
    ? await Promise.all([
        supabase.from('pro_crm_customers').select('*').in('id', supplierIds).eq('owner_id', ownerId),
        subRoleIds.length
          ? supabase.from('pro_crm_contact_roles').select('contact_id').in('contact_id', supplierIds).in('role_id', subRoleIds)
          : Promise.resolve({ data: [] as Array<{ contact_id: string }> }),
      ])
    : [{ data: [] }, { data: [] }];
  const contacts = (contactsRes.data ?? []) as TaxContactRow[];
  const subcontractorIds = new Set(((linksRes.data ?? []) as Array<{ contact_id: string }>).map((row) => row.contact_id));
  return buildTaxYearSummary({
    year,
    payments: (payments.data ?? []) as TaxPaymentRow[],
    expenses: expenseRows,
    trips: (trips.data ?? []) as TaxTripRow[],
    contacts,
    subcontractorIds,
  });
}
