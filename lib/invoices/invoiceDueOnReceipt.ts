/**
 * Whether the invoice is treated as due when received (not net terms).
 * Null/empty terms are common for invoices converted from estimates.
 */
export function isInvoiceDueOnReceipt(
  paymentTerms: string | null | undefined,
  invoiceDate: string | null | undefined,
  dueDate: string | null | undefined
): boolean {
  const terms = (paymentTerms ?? '').trim().toLowerCase();
  if (
    terms === '' ||
    terms.includes('due on receipt') ||
    terms.includes('upon receipt') ||
    terms.includes('on receipt')
  ) {
    return true;
  }
  const inv = invoiceDate?.slice(0, 10) ?? '';
  const due = dueDate?.slice(0, 10) ?? '';
  if (inv && due && inv === due) return true;
  return false;
}

/** Persisted due_date may be stale; align with invoice date when policy is due on receipt. */
export function resolveInvoiceDueDate(
  invoiceDate: string | null | undefined,
  dueDate: string | null | undefined,
  paymentTerms: string | null | undefined
): string | null {
  const inv = invoiceDate?.slice(0, 10) ?? null;
  if (!inv) return dueDate ?? null;
  if (isInvoiceDueOnReceipt(paymentTerms, invoiceDate, dueDate)) {
    return inv;
  }
  return dueDate ?? null;
}

/** Screen / PDF / list: show phrase instead of a future calendar date when due on receipt. */
export function formatInvoiceDueDisplay(
  invoiceDate: string | null | undefined,
  dueDate: string | null | undefined,
  paymentTerms: string | null | undefined,
  formatDate: (iso: string | null) => string
): string {
  if (isInvoiceDueOnReceipt(paymentTerms, invoiceDate, dueDate)) {
    return 'Due upon receipt';
  }
  return formatDate(dueDate ?? null);
}
