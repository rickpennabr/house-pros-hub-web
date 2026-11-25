import { recordCustomerPlaceEvent } from '@/lib/places/timeline';
import { NextRequest, NextResponse } from 'next/server';
import { requireContractor } from '@/lib/crm/require-contractor';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { contactDisplayName } from '@/lib/crm/contact-name';

async function validateEstimateLink(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string,
  customerId: string,
  estimateId: string | null
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!estimateId) return { ok: true };
  const { data: estimate } = await supabase
    .from('pro_crm_estimates')
    .select('id, customer_id')
    .eq('id', estimateId)
    .eq('owner_id', ownerId)
    .single();
  if (!estimate) return { ok: false, message: 'Estimate not found' };
  if (estimate.customer_id !== customerId) {
    return { ok: false, message: 'Estimate must belong to the same customer' };
  }
  return { ok: true };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error: authError, user } = await requireContractor();
    if (authError || !user) return authError!;
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Project ID required' }, { status: 400 });

    const supabase = await createClient();
    const { data: row, error } = await supabase.from('pro_crm_projects').select('*').eq('id', id).eq('owner_id', user.id).single();
    if (error || !row) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const { data: customer } = await supabase.from('pro_crm_customers').select('id, first_name, last_name, display_name, company_name, email, phone').eq('id', row.customer_id).single();
    // Header of the project page: where the job is and what it was sold for.
    const placeId = (row as { place_id?: string | null }).place_id ?? null;
    const [{ data: place }, { data: estimate }] = await Promise.all([
      placeId
        ? createServiceRoleClient().from('customer_places').select('name, street, city, state, zip_code').eq('id', placeId).maybeSingle()
        : Promise.resolve({ data: null }),
      row.estimate_id
        ? supabase.from('pro_crm_estimates').select('display_id, amount_cents, status').eq('id', row.estimate_id).eq('owner_id', user.id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const placeRow = place as { name?: string | null; street?: string | null; city?: string | null; state?: string | null; zip_code?: string | null } | null;
    return NextResponse.json({
      displayId: (row as { display_id?: string | null }).display_id ?? null,
      customerEmail: customer?.email ?? null,
      customerPhone: customer?.phone ?? null,
      customerCompany: customer?.company_name ?? null,
      place: placeRow
        ? {
            name: placeRow.name ?? null,
            address: [placeRow.street, [placeRow.city, [placeRow.state, placeRow.zip_code].filter(Boolean).join(' ')].filter(Boolean).join(', ')]
              .filter(Boolean)
              .join(', '),
          }
        : null,
      estimate: estimate
        ? { displayId: (estimate as { display_id?: string | null }).display_id ?? null, amountCents: (estimate as { amount_cents?: number | null }).amount_cents ?? null, status: (estimate as { status?: string }).status ?? null }
        : null,
      id: row.id,
      customerId: row.customer_id,
      customerFirstName: customer?.first_name ?? null,
      customerLastName: customer?.last_name ?? null,
      customerDisplayName: customer ? contactDisplayName(customer) : null,
      estimateId: row.estimate_id,
      name: row.name,
      status: row.status,
      startDate: row.start_date,
      endDate: row.end_date,
      note: row.note ?? '',
    });
  } catch (err) {
    console.error('GET /api/crm/projects/[id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error: authError, user } = await requireContractor();
    if (authError || !user) return authError!;
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Project ID required' }, { status: 400 });

    const body = await request.json();
    const supabase = await createClient();
    const { data: currentProject } = await supabase
      .from('pro_crm_projects')
      .select('customer_id, estimate_id, status, name, place_id')
      .eq('id', id)
      .eq('owner_id', user.id)
      .single();
    if (!currentProject) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    let targetCustomerId = currentProject.customer_id;
    if (body.name !== undefined) updates.name = typeof body.name === 'string' ? body.name.trim() : undefined;
    if (body.customerId !== undefined) {
      const { data: c } = await supabase.from('pro_crm_customers').select('id').eq('id', body.customerId).eq('owner_id', user.id).single();
      if (c) {
        updates.customer_id = body.customerId;
        targetCustomerId = body.customerId;
      }
    }
    if (body.estimateId !== undefined) {
      const estimateValidation = await validateEstimateLink(supabase, user.id, targetCustomerId, body.estimateId || null);
      if (!estimateValidation.ok) {
        return NextResponse.json({ error: estimateValidation.message }, { status: 400 });
      }
      updates.estimate_id = body.estimateId || null;
    }
    if (body.status !== undefined && ['planned', 'in_progress', 'on_hold', 'completed', 'cancelled'].includes(body.status)) updates.status = body.status;
    if (body.startDate !== undefined) updates.start_date = body.startDate || null;
    if (body.endDate !== undefined) updates.end_date = body.endDate || null;
    if (body.note !== undefined) updates.note = typeof body.note === 'string' ? body.note.trim() || null : null;

    const { error } = await supabase.from('pro_crm_projects').update(updates).eq('id', id).eq('owner_id', user.id);
    if (error) return NextResponse.json({ error: error.message || 'Failed to update project' }, { status: 500 });
    if (updates.status === 'completed' && currentProject.status !== 'completed' && targetCustomerId) {
      await recordCustomerPlaceEvent(targetCustomerId, {
        placeId: currentProject.place_id || undefined,
        kind: 'project_completed',
        title: `Project finished · ${(updates.name as string | undefined) || currentProject.name}`,
        projectId: id,
        ownerId: user.id,
      }).catch(() => null);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PUT /api/crm/projects/[id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error: authError, user } = await requireContractor();
    if (authError || !user) return authError!;
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Project ID required' }, { status: 400 });

    const supabase = await createClient();
    const { error } = await supabase.from('pro_crm_projects').delete().eq('id', id).eq('owner_id', user.id);
    if (error) return NextResponse.json({ error: error.message || 'Failed to delete project' }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/crm/projects/[id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
