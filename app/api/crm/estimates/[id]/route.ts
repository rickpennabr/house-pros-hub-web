import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasRole } from '@/lib/utils/roles';
import { contactDisplayName } from '@/lib/crm/contact-name';
import {
  crmEstimateUpdateSchema,
  depositWithinEstimate,
  isValidEstimateStatusTransition,
  normalizeEstimateAmountCents,
} from '@/lib/schemas/crmEstimate';
import { issueAcceptanceDeposit } from '@/lib/crm/estimate-deposit';

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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError, user } = await requireContractor();
    if (authError || !user) return authError!;

    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Estimate ID required' }, { status: 400 });

    const supabase = await createClient();
    const { data: row, error } = await supabase
      .from('pro_crm_estimates')
      .select('*')
      .eq('id', id)
      .eq('owner_id', user.id)
      .single();

    if (error || !row) return NextResponse.json({ error: 'Estimate not found' }, { status: 404 });

    const { data: customer } = await supabase
      .from('pro_crm_customers')
      .select('id, first_name, last_name, display_name, company_name, email')
      .eq('id', row.customer_id)
      .single();

    return NextResponse.json({
      id: row.id,
      displayId: row.display_id ?? null,
      display_id: row.display_id ?? null,
      customerId: row.customer_id,
      customerFirstName: customer?.first_name ?? null,
      customerLastName: customer?.last_name ?? null,
      customerDisplayName: customer ? contactDisplayName(customer) : null,
      customerEmail: customer?.email ?? null,
      amountCents: row.amount_cents,
      depositCents: row.deposit_cents ?? 0,
      lineItems: row.line_items,
      status: row.status,
      dueDate: row.due_date,
      validityDate: row.due_date,
      note: row.note ?? '',
      jobArea: row.job_area ?? null,
      agreementKind: row.agreement_kind ?? 'project',
      maintenanceFrequency: row.maintenance_frequency ?? null,
      signedAt: row.signed_at ?? null,
      signerName: row.signer_name ?? null,
    });
  } catch (err) {
    console.error('GET /api/crm/estimates/[id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError, user } = await requireContractor();
    if (authError || !user) return authError!;

    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Estimate ID required' }, { status: 400 });

    const bodyRaw = await request.json();
    const parsed = crmEstimateUpdateSchema.safeParse({
      customerId: bodyRaw.customerId ?? bodyRaw.customer_id,
      lineItems: bodyRaw.lineItems ?? bodyRaw.line_items,
      status: bodyRaw.status,
      dueDate: bodyRaw.dueDate ?? bodyRaw.due_date,
      validityDate: bodyRaw.validityDate ?? bodyRaw.validity_date ?? bodyRaw.valid_until,
      note: bodyRaw.note,
      depositCents: bodyRaw.depositCents ?? bodyRaw.deposit_cents,
      jobArea: bodyRaw.jobArea ?? bodyRaw.job_area,
      agreementKind: bodyRaw.agreementKind ?? bodyRaw.agreement_kind,
      maintenanceFrequency: bodyRaw.maintenanceFrequency ?? bodyRaw.maintenance_frequency,
    });
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message || 'Invalid estimate payload';
      return NextResponse.json({ error: message }, { status: 400 });
    }
    const body = parsed.data;

    const supabase = await createClient();
    const { data: currentEstimate, error: currentEstimateError } = await supabase
      .from('pro_crm_estimates')
      .select('status, amount_cents, deposit_cents, agreement_kind, maintenance_frequency')
      .eq('id', id)
      .eq('owner_id', user.id)
      .single();
    if (currentEstimateError || !currentEstimate) {
      return NextResponse.json({ error: 'Estimate not found' }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    if (body.lineItems !== undefined) {
      updates.line_items = body.lineItems;
      updates.amount_cents = normalizeEstimateAmountCents(body.lineItems);
    }
    if (body.status !== undefined) {
      if (!isValidEstimateStatusTransition(currentEstimate.status, body.status)) {
        return NextResponse.json(
          { error: `Invalid status transition from ${currentEstimate.status} to ${body.status}` },
          { status: 400 }
        );
      }
      updates.status = body.status;
    }
    if (body.dueDate !== undefined || body.validityDate !== undefined) {
      updates.due_date = body.validityDate ?? body.dueDate ?? null;
    }
    if (body.note !== undefined) updates.note = typeof body.note === 'string' ? body.note.trim() || null : null;
    if (body.depositCents !== undefined) updates.deposit_cents = body.depositCents;
    if (body.jobArea !== undefined) {
      updates.job_area = typeof body.jobArea === 'string' ? body.jobArea.trim() || null : null;
    }
    if (body.agreementKind !== undefined) updates.agreement_kind = body.agreementKind;
    const nextKind =
      typeof updates.agreement_kind === 'string' ? updates.agreement_kind : currentEstimate.agreement_kind;
    if (body.maintenanceFrequency !== undefined || body.agreementKind !== undefined) {
      updates.maintenance_frequency =
        nextKind === 'maintenance'
          ? body.maintenanceFrequency !== undefined
            ? body.maintenanceFrequency
            : currentEstimate.maintenance_frequency
          : null;
    }
    if (nextKind === 'maintenance' && !updates.maintenance_frequency && !currentEstimate.maintenance_frequency) {
      return NextResponse.json({ error: 'Choose how often maintenance visits run' }, { status: 400 });
    }
    const nextAmount = typeof updates.amount_cents === 'number' ? updates.amount_cents : currentEstimate.amount_cents;
    const nextDeposit = typeof updates.deposit_cents === 'number' ? updates.deposit_cents : currentEstimate.deposit_cents ?? 0;
    const depositError = depositWithinEstimate(nextDeposit, nextAmount);
    if (depositError) return NextResponse.json({ error: depositError }, { status: 400 });
    if (body.customerId !== undefined) {
      const { data: customer } = await supabase
        .from('pro_crm_customers')
        .select('id')
        .eq('id', body.customerId)
        .eq('owner_id', user.id)
        .single();
      if (customer) updates.customer_id = body.customerId;
    }

    const { error } = await supabase
      .from('pro_crm_estimates')
      .update(updates)
      .eq('id', id)
      .eq('owner_id', user.id);

    if (error) return NextResponse.json({ error: error.message || 'Failed to update estimate' }, { status: 500 });
    let depositInvoiceError: string | undefined;
    if (body.status === 'accepted' && currentEstimate.status !== 'accepted') {
      const deposit = await issueAcceptanceDeposit(supabase, id, user.id);
      if (deposit.error) depositInvoiceError = deposit.error;
    }
    return NextResponse.json({ ok: true, depositError: depositInvoiceError ?? null });
  } catch (err) {
    console.error('PUT /api/crm/estimates/[id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError, user } = await requireContractor();
    if (authError || !user) return authError!;

    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Estimate ID required' }, { status: 400 });

    const supabase = await createClient();
    const { error } = await supabase
      .from('pro_crm_estimates')
      .delete()
      .eq('id', id)
      .eq('owner_id', user.id);

    if (error) return NextResponse.json({ error: error.message || 'Failed to delete estimate' }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/crm/estimates/[id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
