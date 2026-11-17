/** Commercial agreement kinds on CRM estimates (customer-facing documents). */
export const AGREEMENT_KINDS = [
  'project',
  'maintenance',
  'repair',
  'renovation',
  'remodel',
  'addition',
  'other',
] as const;

export type AgreementKind = (typeof AGREEMENT_KINDS)[number];

/** Visit cadence for maintenance agreements. */
export const MAINTENANCE_FREQUENCIES = [
  'weekly',
  'biweekly',
  'monthly',
  'quarterly',
  'yearly',
] as const;

export type MaintenanceFrequency = (typeof MAINTENANCE_FREQUENCIES)[number];

/** Recurring invoice schedule supports a subset; map close cadences. */
export type RecurringInvoiceFrequency = 'weekly' | 'biweekly' | 'monthly' | 'yearly';

export const AGREEMENT_KIND_LABELS: Record<AgreementKind, string> = {
  project: 'Project',
  maintenance: 'Maintenance agreement',
  repair: 'Repair',
  renovation: 'Renovation',
  remodel: 'Remodel',
  addition: 'Addition / extension',
  other: 'Other',
};

export const MAINTENANCE_FREQUENCY_LABELS: Record<MaintenanceFrequency, string> = {
  weekly: 'Every week',
  biweekly: 'Every two weeks',
  monthly: 'Every month',
  quarterly: 'Every quarter',
  yearly: 'Every year',
};

export function isAgreementKind(value: unknown): value is AgreementKind {
  return typeof value === 'string' && (AGREEMENT_KINDS as readonly string[]).includes(value);
}

export function isMaintenanceFrequency(value: unknown): value is MaintenanceFrequency {
  return typeof value === 'string' && (MAINTENANCE_FREQUENCIES as readonly string[]).includes(value);
}

export function normalizeAgreementKind(value: unknown): AgreementKind {
  return isAgreementKind(value) ? value : 'project';
}

export function normalizeMaintenanceFrequency(
  kind: AgreementKind,
  value: unknown
): MaintenanceFrequency | null {
  if (kind !== 'maintenance') return null;
  return isMaintenanceFrequency(value) ? value : null;
}

/** Days until the next planned visit after accept (best-effort). */
export function nextVisitOffsetDays(frequency: MaintenanceFrequency): number {
  switch (frequency) {
    case 'weekly':
      return 7;
    case 'biweekly':
      return 14;
    case 'monthly':
      return 30;
    case 'quarterly':
      return 90;
    case 'yearly':
      return 365;
  }
}

export function toRecurringInvoiceFrequency(
  frequency: MaintenanceFrequency
): RecurringInvoiceFrequency | null {
  switch (frequency) {
    case 'weekly':
      return 'weekly';
    case 'biweekly':
      return 'biweekly';
    case 'monthly':
      return 'monthly';
    case 'yearly':
      return 'yearly';
    case 'quarterly':
      return null;
  }
}

export function datePlusDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function todayDateKey(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
