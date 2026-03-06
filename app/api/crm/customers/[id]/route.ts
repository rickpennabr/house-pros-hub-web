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

    return NextResponse.json({
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email ?? '',
      phone: row.phone ?? '',
      streetAddress: row.street_address ?? '',
      apartment: row.apartment ?? '',
      city: row.city ?? '',
      state: row.state ?? '',
      zipCode: row.zip_code ?? '',
      note: row.note ?? '',
    });
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
    const trim = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

    const supabase = await createClient();
    const { error: updateError } = await supabase
      .from('pro_crm_customers')
      .update({
        first_name: trim(body.firstName) ?? undefined,
        last_name: trim(body.lastName) ?? undefined,
        email: trim(body.email) || null,
        phone: trim(body.phone) || null,
        street_address: trim(body.streetAddress) || null,
        apartment: trim(body.apartment) || null,
        city: trim(body.city) || null,
        state: trim(body.state) || null,
        zip_code: trim(body.zipCode) || null,
        note: trim(body.note) || null,
      })
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
