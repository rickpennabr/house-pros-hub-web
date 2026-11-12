import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/supabase';
import type { InvoiceLineItem } from '@/lib/invoices/draft';

type Client = SupabaseClient<Database>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface UnbilledExpense {
  id: string;
  amountCents: number;
  category: string;
  description: string | null;
  note: string | null;
  expenseDate: string;
  poNumber: string | null;
  quantity: number | null;
  unit: string | null;
  projectName: string | null;
}

export function markedUpCents(costCents: number, markupPercent: number): number {
  const markup = Number.isFinite(markupPercent) ? markupPercent : 0;
  return Math.max(0, Math.round(costCents * (1 + markup / 100)));
}

export function expenseIdsOnLines(lines: unknown): string[] {
  if (!Array.isArray(lines)) return [];
  const ids: string[] = [];
  for (const line of lines) {
    if (!line || typeof line !== 'object') continue;
    const id = (line as { expense_id?: unknown }).expense_id;
    if (typeof id === 'string' && UUID.test(id) && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

export function jobCostLine(expense: UnbilledExpense, markupPercent: number): InvoiceLineItem {
  const amount = markedUpCents(expense.amountCents, markupPercent);
  const detail = expense.description?.trim() || expense.note?.trim() || expense.category;
  const quantity =
    expense.quantity != null && expense.quantity > 0
      ? `${expense.quantity}${expense.unit ? ` ${expense.unit}` : ''}`
      : '';
  const project = expense.projectName ? `(${expense.projectName})` : '';
  return {
    product_or_service: expense.category,
    description: [detail, quantity, project].filter(Boolean).join(' · '),
    unit: expense.unit || 'each',
    qty: 1,
    rate_cents: amount,
    amount_cents: amount,
    expense_id: expense.id,
    cost_cents: expense.amountCents,
  };
}

/** Link the invoice to the job costs on its lines, and release any it no longer includes. */
export async function syncBilledExpenses(
  supabase: Client,
  ownerId: string,
  invoiceId: string,
  lines: unknown
): Promise<{ error?: string }> {
  const wanted = expenseIdsOnLines(lines);
  const { data: currently, error: currentError } = await supabase
    .from('pro_crm_expenses')
    .select('id')
    .eq('owner_id', ownerId)
    .eq('billed_invoice_id', invoiceId);
  if (currentError) {
    const missingColumn = currentError.message.includes('billed_invoice_id');
    if (missingColumn && wanted.length === 0) return {};
    if (missingColumn) {
      return { error: 'Run the progress billing database update before adding job costs to an invoice.' };
    }
    return { error: currentError.message };
  }

  if (wanted.length > 0) {
    const { data: rows, error } = await supabase
      .from('pro_crm_expenses')
      .select('id, billed_invoice_id')
      .eq('owner_id', ownerId)
      .in('id', wanted);
    if (error) return { error: error.message };
    if ((rows ?? []).length !== wanted.length) return { error: 'One of the job costs is no longer available' };
    const taken = (rows ?? []).find((row) => row.billed_invoice_id && row.billed_invoice_id !== invoiceId);
    if (taken) return { error: 'One of the job costs is already on another invoice' };

    const { error: billError } = await supabase
      .from('pro_crm_expenses')
      .update({ billed_invoice_id: invoiceId, billed_at: new Date().toISOString() })
      .eq('owner_id', ownerId)
      .in('id', wanted);
    if (billError) return { error: billError.message };
  }

  const release = (currently ?? []).map((row) => row.id).filter((id) => !wanted.includes(id));
  if (release.length > 0) {
    const { error: releaseError } = await supabase
      .from('pro_crm_expenses')
      .update({ billed_invoice_id: null, billed_at: null })
      .eq('owner_id', ownerId)
      .eq('billed_invoice_id', invoiceId)
      .in('id', release);
    if (releaseError) return { error: releaseError.message };
  }

  return {};
}

export async function releaseBilledExpenses(
  supabase: Client,
  ownerId: string,
  invoiceId: string
): Promise<void> {
  await supabase
    .from('pro_crm_expenses')
    .update({ billed_invoice_id: null, billed_at: null })
    .eq('owner_id', ownerId)
    .eq('billed_invoice_id', invoiceId);
}
