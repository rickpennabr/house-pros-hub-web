import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

export type CrmActivityKind = 'estimate_sent' | 'estimate_viewed' | 'invoice_viewed' | 'statement_sent';

/** A customer opening the same link again within this window counts once. */
const VIEW_WINDOW_MS = 30 * 60 * 1000;

/**
 * Log CRM activity that has no other record (migration 166). Never throws: a missing table or a
 * failed insert only logs, so sending and viewing keep working.
 */
export async function logCrmActivity(input: {
  ownerId: string;
  customerId?: string | null;
  kind: CrmActivityKind;
  estimateId?: string | null;
  invoiceId?: string | null;
  detail?: string | null;
}): Promise<void> {
  try {
    const admin = createServiceRoleClient() as unknown as {
      from: (table: string) => {
        select: (columns: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
        insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
      };
    };
    const isView = input.kind === 'estimate_viewed' || input.kind === 'invoice_viewed';
    if (isView) {
      // The pro opening their own link is not a customer view.
      const { data } = await (await createClient()).auth.getUser().catch(() => ({ data: { user: null } }));
      if (data.user?.id === input.ownerId) return;
      const since = new Date(Date.now() - VIEW_WINDOW_MS).toISOString();
      const column = input.kind === 'estimate_viewed' ? 'estimate_id' : 'invoice_id';
      const { data: recent } = await admin
        .from('pro_crm_activity')
        .select('id')
        .eq('kind', input.kind)
        .eq(column, input.estimateId ?? input.invoiceId)
        .gte('occurred_at', since)
        .limit(1);
      if (Array.isArray(recent) && recent.length > 0) return;
    }
    const { error } = await admin.from('pro_crm_activity').insert({
      owner_id: input.ownerId,
      customer_id: input.customerId ?? null,
      kind: input.kind,
      estimate_id: input.estimateId ?? null,
      invoice_id: input.invoiceId ?? null,
      detail: input.detail?.slice(0, 300) ?? null,
    });
    if (error) console.error('[logCrmActivity]', input.kind, error.message);
  } catch (err) {
    console.error('[logCrmActivity]', input.kind, err);
  }
}
