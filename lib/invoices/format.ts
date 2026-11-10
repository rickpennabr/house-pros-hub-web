/** USD display shared by invoice and estimate document forms. */
export function formatAmount(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(cents / 100);
}

/** Calendar date in UTC, matching the invoice form's existing date default. */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
