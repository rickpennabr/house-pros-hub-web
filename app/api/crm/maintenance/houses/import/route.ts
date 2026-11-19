import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrmScope } from '@/lib/crm/crm-scope';
import { contactDisplayName } from '@/lib/crm/contact-name';
import {
  datePlusDays,
  isMaintenanceFrequency,
  MAINTENANCE_FREQUENCY_LABELS,
  nextVisitOffsetDays,
  todayDateKey,
  type MaintenanceFrequency,
} from '@/lib/crm/estimate-agreement';

export interface ImportableEstimate {
  id: string;
  displayId: string;
  customerId: string;
  customerName: string;
  jobArea: string | null;
  status: string;
  agreementKind: string;
  frequency: string | null;
  amountCents: number;
  createdAt: string;
}

const ROW_CAP = 300;

/**
 * GET /api/crm/maintenance/houses/import
 * Estimates that can become a maintenance house: not declined and not already a house.
 * Maintenance agreements come first.
 */
export async function GET() {
  try {
    const { error, scope } = await requireCrmScope();
    if (error || !scope) return error!;
    const { supabase, ownerId } = scope;

    const [estimatesRes, plansRes] = await Promise.all([
      supabase
        .from('pro_crm_estimates')
        .select('id, display_id, customer_id, job_area, status, agreement_kind, maintenance_frequency, amount_cents, created_at')
        .eq('owner_id', ownerId)
        .neq('status', 'declined')
        .order('created_at', { ascending: false })
        .limit(ROW_CAP),
      supabase
        .from('pro_crm_maintenance_plans')
        .select('source_estimate_id')
        .eq('owner_id', ownerId)
        .not('source_estimate_id', 'is', null),
    ]);
    if (estimatesRes.error) return NextResponse.json({ error: estimatesRes.error.message }, { status: 500 });

    const used = new Set(((plansRes.data ?? []) as Array<{ source_estimate_id: string | null }>).map((row) => row.source_estimate_id));
    const estimates = ((estimatesRes.data ?? []) as Array<{
      id: string;
      display_id: string;
      customer_id: string;
      job_area: string | null;
      status: string;
      agreement_kind: string;
      maintenance_frequency: string | null;
      amount_cents: number;
      created_at: string;
    }>).filter((row) => !used.has(row.id));

    const customerIds = [...new Set(estimates.map((row) => row.customer_id))];
    const { data: contacts } = customerIds.length
      ? await supabase
          .from('pro_crm_customers')
          .select('id, first_name, last_name, display_name, company_name')
          .eq('owner_id', ownerId)
          .in('id', customerIds)
      : { data: [] };
    const nameOf = new Map(
      ((contacts ?? []) as Array<Parameters<typeof contactDisplayName>[0] & { id: string }>).map((row) => [
        row.id,
        contactDisplayName(row),
      ])
    );

    const rows: ImportableEstimate[] = estimates
      .map((row) => ({
        id: row.id,
        displayId: row.display_id,
        customerId: row.customer_id,
        customerName: nameOf.get(row.customer_id) || 'Contact',
        jobArea: row.job_area,
        status: row.status,
        agreementKind: row.agreement_kind,
        frequency: row.maintenance_frequency,
        amountCents: row.amount_cents,
        createdAt: row.created_at,
      }))
      .sort((a, b) => Number(b.agreementKind === 'maintenance') - Number(a.agreementKind === 'maintenance'));

    return NextResponse.json({ estimates: rows });
  } catch (err) {
    console.error('GET /api/crm/maintenance/houses/import', err);
    return NextResponse.json({ error: 'Failed to load estimates' }, { status: 500 });
  }
}

const importSchema = z.object({ estimateId: z.string().uuid() });

/**
 * POST /api/crm/maintenance/houses/import  { estimateId }
 * Make a maintenance house from the estimate: its contact and property, schedule (monthly when
 * the estimate has none), price, and the note as the job. Only the agreement is created; no
 * invoices are scheduled. Returns the existing house when the estimate already has one.
 */
export async function POST(request: NextRequest) {
  try {
    const { error, scope } = await requireCrmScope();
    if (error || !scope) return error!;
    if (scope.isCrew) {
      return NextResponse.json({ error: 'Only the business owner can add a house.' }, { status: 403 });
    }
    const { supabase, ownerId } = scope;

    const parsed = importSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Pick an estimate.' }, { status: 400 });

    const { data: estimate } = await supabase
      .from('pro_crm_estimates')
      .select('id, display_id, customer_id, place_id, amount_cents, deposit_cents, note, job_area, maintenance_frequency, status')
      .eq('id', parsed.data.estimateId)
      .eq('owner_id', ownerId)
      .maybeSingle();
    if (!estimate) return NextResponse.json({ error: 'Estimate not found' }, { status: 404 });
    if (estimate.status === 'declined') {
      return NextResponse.json({ error: 'That estimate was declined.' }, { status: 400 });
    }

    const { data: existing } = await supabase
      .from('pro_crm_maintenance_plans')
      .select('id')
      .eq('owner_id', ownerId)
      .eq('source_estimate_id', estimate.id)
      .maybeSingle();
    if (existing) return NextResponse.json({ id: existing.id, existing: true });

    // One active agreement per house, as on Add house.
    let duplicate = supabase
      .from('pro_crm_maintenance_plans')
      .select('id')
      .eq('owner_id', ownerId)
      .eq('customer_id', estimate.customer_id)
      .eq('is_active', true);
    duplicate = estimate.place_id ? duplicate.eq('place_id', estimate.place_id) : duplicate.is('place_id', null);
    const { data: sameHouse } = await duplicate.limit(1).maybeSingle();
    if (sameHouse) {
      return NextResponse.json(
        { error: 'This house already has an active maintenance agreement.', houseId: sameHouse.id },
        { status: 409 }
      );
    }

    const frequency: MaintenanceFrequency = isMaintenanceFrequency(estimate.maintenance_frequency)
      ? estimate.maintenance_frequency
      : 'monthly';
    const label = String(estimate.display_id ?? estimate.id.slice(0, 8));
    const area = estimate.job_area?.trim() || null;
    const amount = Number(estimate.amount_cents) || 0;
    const visitAmount = Math.max(0, amount - (Number(estimate.deposit_cents) || 0)) || amount;

    const { data: plan, error: insertError } = await supabase
      .from('pro_crm_maintenance_plans')
      .insert({
        owner_id: ownerId,
        customer_id: estimate.customer_id,
        place_id: estimate.place_id ?? null,
        name: (area ? `Maintenance · ${area}` : 'Maintenance agreement').slice(0, 120),
        summary: [`From estimate #${label}`, MAINTENANCE_FREQUENCY_LABELS[frequency]].join(' · '),
        scope_of_work: estimate.note?.trim() ? estimate.note.trim().slice(0, 4000) : null,
        frequency,
        next_visit_date: datePlusDays(todayDateKey(), nextVisitOffsetDays(frequency)),
        is_active: true,
        amount_cents: visitAmount > 0 ? visitAmount : null,
        source_estimate_id: estimate.id,
      })
      .select('id')
      .single();
    if (insertError || !plan) {
      return NextResponse.json({ error: insertError?.message || 'Could not add the house' }, { status: 500 });
    }
    return NextResponse.json({ id: plan.id }, { status: 201 });
  } catch (err) {
    console.error('POST /api/crm/maintenance/houses/import', err);
    return NextResponse.json({ error: 'Failed to import the estimate' }, { status: 500 });
  }
}
