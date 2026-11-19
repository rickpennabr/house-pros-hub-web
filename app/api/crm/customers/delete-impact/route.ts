import { NextRequest, NextResponse } from 'next/server';
import { requireContractor } from '@/lib/crm/require-contractor';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Records that are deleted along with a contact (their foreign keys cascade). */
const CASCADES = [
  ['estimates', 'pro_crm_estimates'],
  ['invoices', 'pro_crm_invoices'],
  ['recurringInvoices', 'pro_crm_recurring_invoices'],
  ['projects', 'pro_crm_projects'],
  ['maintenancePlans', 'pro_crm_maintenance_plans'],
  ['documents', 'pro_crm_customer_documents'],
  ['attachments', 'pro_crm_customer_attachments'],
] as const;

export type ContactDeleteImpact = Record<(typeof CASCADES)[number][0], number> & {
  /** Contacts linked to a customer's hub login: their documents also leave that customer's My Places. */
  linkedToHub: number;
};

/**
 * GET /api/crm/customers/delete-impact?ids=a,b
 * Counts what deleting these contacts would also delete, for the delete confirmation.
 */
export async function GET(request: NextRequest) {
  try {
    const { error: authError, user, supabase } = await requireContractor();
    if (authError || !user) return authError;

    const ids = [...new Set((request.nextUrl.searchParams.get('ids') ?? '').split(',').map((id) => id.trim()))]
      .filter((id) => UUID.test(id))
      .slice(0, 200);
    if (ids.length === 0) return NextResponse.json({ error: 'Contact IDs required' }, { status: 400 });

    // Only the caller's own contacts, matching the delete endpoint.
    const { data: contacts, error: contactsError } = await supabase
      .from('pro_crm_customers')
      .select('id, portal_user_id')
      .eq('owner_id', user.id)
      .in('id', ids);
    if (contactsError) return NextResponse.json({ error: contactsError.message }, { status: 500 });
    const owned = (contacts ?? []).map((row) => row.id);

    const impact = { linkedToHub: (contacts ?? []).filter((row) => row.portal_user_id).length } as ContactDeleteImpact;
    const counts = await Promise.all(
      CASCADES.map(async ([key, table]) => {
        if (owned.length === 0) return [key, 0] as const;
        const { count, error } = await supabase
          .from(table)
          .select('id', { count: 'exact', head: true })
          .in('customer_id', owned);
        if (error) throw new Error(`${table}: ${error.message}`);
        return [key, count ?? 0] as const;
      })
    );
    for (const [key, count] of counts) impact[key] = count;

    return NextResponse.json({ impact });
  } catch (err) {
    console.error('GET /api/crm/customers/delete-impact', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
