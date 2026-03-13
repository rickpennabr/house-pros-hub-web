import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasRole } from '@/lib/utils/roles';

async function requireContractor() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null };
  }
  const isContractor = await hasRole(user.id, 'contractor');
  if (!isContractor) {
    return { error: NextResponse.json({ error: 'Forbidden - Contractor access required' }, { status: 403 }), user: null };
  }
  return { error: null, user };
}

/**
 * GET /api/crm/customers/[id]
 * Get one CRM customer. Contractor only; must own the customer.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError, user } = await requireContractor();
    if (authError || !user) return authError!;

    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Customer ID required' }, { status: 400 });

    const supabase = await createClient();
    const { data: row, error } = await supabase
      .from('pro_crm_customers')
      .select('*')
      .eq('id', id)
      .eq('owner_id', user.id)
      .single();

    if (error || !row) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    return NextResponse.json(row);
  } catch (err) {
    console.error('GET /api/crm/customers/[id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/crm/customers/[id]
 * Update a CRM customer. Contractor only; must own the customer.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError, user } = await requireContractor();
    if (authError || !user) return authError!;

    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Customer ID required' }, { status: 400 });

    const body = await request.json();
    const trim = (v: unknown) => (typeof v === 'string' ? v.trim() : v);
    const num = (v: unknown) => (typeof v === 'number' ? v : null);

    const updatePayload: Record<string, unknown> = {};
    const stringFields = [
      'first_name', 'last_name', 'email', 'phone', 'street_address', 'apartment', 'city', 'state', 'zip_code',
      'company_name', 'display_name', 'cc', 'bcc', 'mobile_number', 'fax', 'other',
      'website', 'billing_address_street_1', 'billing_address_street_2', 'billing_address_city',
      'billing_address_state', 'billing_address_zip_code', 'billing_address_country', 'shipping_address_street_1',
      'shipping_address_street_2', 'shipping_address_city', 'shipping_address_state', 'shipping_address_zip_code',
      'shipping_address_country', 'notes', 'primary_payment_method', 'payment_terms',
      'invoice_language',
    ] as const;
    for (const key of stringFields) {
      const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      const raw = body[key] ?? body[camel];
      if (raw !== undefined) {
        const val = trim(raw);
        updatePayload[key] = typeof val === 'string' ? (val || null) : null;
      }
    }
    if (body.shipping_same_as_billing !== undefined) updatePayload.shipping_same_as_billing = !!body.shipping_same_as_billing;
    if (body.opening_balance !== undefined) updatePayload.opening_balance = num(body.opening_balance) ?? body.opening_balance;

    const supabase = await createClient();
    const { error: updateError } = await supabase
      .from('pro_crm_customers')
      .update(updatePayload)
      .eq('id', id)
      .eq('owner_id', user.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message || 'Failed to update customer' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PUT /api/crm/customers/[id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/crm/customers/[id]
 * Delete a CRM customer. Contractor only; must own the customer.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError, user } = await requireContractor();
    if (authError || !user) return authError!;

    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Customer ID required' }, { status: 400 });

    const supabase = await createClient();
    const { error } = await supabase
      .from('pro_crm_customers')
      .delete()
      .eq('id', id)
      .eq('owner_id', user.id);

    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to delete customer' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/crm/customers/[id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
