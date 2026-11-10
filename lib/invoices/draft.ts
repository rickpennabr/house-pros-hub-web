import { DEFAULT_UNIT } from '@/lib/constants/unitOptions';
import type { CompanyDisplayOverride } from '@/lib/invoices/companyDisplay';

export interface InvoicePendingAttachment {
  id: string;
  file: File;
}

export interface InvoiceLineItem {
  product_or_service: string;
  description: string;
  unit: string;
  qty: number;
  rate_cents: number;
  amount_cents: number;
}

export interface InvoiceBusinessShape {
  id: string;
  business_name: string;
  business_logo: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  company_tagline?: string | null;
  website?: string;
}

export interface InvoiceCustomerOption {
  id: string;
  first_name: string;
  last_name: string;
  display_name?: string | null;
  company_name?: string | null;
}

export interface InvoiceLinePayload {
  product_or_service: string | null;
  description: string | null;
  unit: string | null;
  qty: number;
  rate_cents: number;
  amount_cents: number;
}

/** Values the invoice editor owns. Pages turn this into a create or update request. */
export interface InvoiceEditorDraft {
  customerId: string;
  lineItems: InvoiceLineItem[];
  invoiceDate: string;
  dueDate: string;
  paymentTerms: string;
  note: string;
  companyOverride: CompanyDisplayOverride | null;
  pendingAttachments: InvoicePendingAttachment[];
}

export const EMPTY_INVOICE_BUSINESS: InvoiceBusinessShape = {
  id: '',
  business_name: 'My Business',
  business_logo: null,
  email: null,
  phone: null,
  address: null,
  company_tagline: null,
  website: undefined,
};

export function emptyInvoiceLine(): InvoiceLineItem {
  return {
    product_or_service: '',
    description: '',
    unit: DEFAULT_UNIT,
    qty: 1,
    rate_cents: 0,
    amount_cents: 0,
  };
}

export function invoiceLineItemsPayload(lines: InvoiceLineItem[]): InvoiceLinePayload[] {
  return lines
    .filter((line) => line.description || line.product_or_service || line.amount_cents > 0)
    .map((line) => ({
      product_or_service: line.product_or_service || null,
      description: line.description || null,
      unit: line.unit || null,
      qty: line.qty,
      rate_cents: line.rate_cents,
      amount_cents: line.amount_cents,
    }));
}

export function invoiceTotalCents(lines: InvoiceLinePayload[]): number {
  if (lines.length === 0) return 0;
  return lines.reduce((sum, line) => sum + line.amount_cents, 0);
}
