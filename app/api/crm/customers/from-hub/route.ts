import { NextRequest, NextResponse } from 'next/server';
import { importHubCustomer } from '@/lib/crm/hub-customer';
import { requireContractor } from '@/lib/crm/require-contractor';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { hubCustomerLookupSchema } from '@/lib/schemas/crm';

/**
 * POST /api/crm/customers/from-hub
 * Copy one confirmed customer's own name, phone, and address into the signed-in pro's contacts.
 * The pro must already know the exact email. This does not list customers or read another pro's CRM.
 * `fillOnly` returns the fields for a form and does not create a contact.
 */
export async function POST(request: NextRequest) {
  try {
    const { error: authError, user, supabase } = await requireContractor();
    if (authError || !user || !supabase) return authError!;

    const rateLimitRes = await checkRateLimit(request, 'hubCustomerLookup', user.id);
    if (rateLimitRes) return rateLimitRes;

    const parsed = hubCustomerLookupSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Enter a valid email.' }, { status: 400 });
    }

    const result = await importHubCustomer(supabase, user.id, parsed.data.email, parsed.data.fillOnly === true);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    if ('fill' in result) {
      return NextResponse.json({ fill: true, contact: result.contact });
    }
    return NextResponse.json({ created: result.created, customer: result.customer }, { status: result.created ? 201 : 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (message === 'DISPLAY_NAME') {
      return NextResponse.json(
        { error: 'That display name is already used. Each contact needs a unique display name.' },
        { status: 409 }
      );
    }
    console.error('POST /api/crm/customers/from-hub', message || err);
    return NextResponse.json({ error: 'Could not look up that account.' }, { status: 500 });
  }
}
