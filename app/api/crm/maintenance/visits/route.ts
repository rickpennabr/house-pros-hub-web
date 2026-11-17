import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrmScope } from '@/lib/crm/crm-scope';
import {
  closeOpenTripOnDay,
  ensureOpenMaintenanceDay,
} from '@/lib/crm/maintenance-day-db';
import { mapVisit, type MaintenanceVisitRow } from '@/lib/crm/maintenance-visits-db';
import { contactDisplayName } from '@/lib/crm/contact-name';

const startSchema = z.object({
  customerId: z.string().uuid(),
  maintenancePlanId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  responsibleCrewId: z.string().uuid().nullable().optional(),
  responsibleContactId: z.string().uuid().nullable().optional(),
  crewMemberIds: z.array(z.string().uuid()).optional(),
  contactIds: z.array(z.string().uuid()).optional(),
  /** Extra people on site who are not in the crew list (day labor, etc.). */
  extraWorkers: z.number().int().min(0).max(49).optional(),
});

/**
 * GET /api/crm/maintenance/visits
 * List recent maintenance visits for the business.
 */
export async function GET(request: NextRequest) {
  try {
    const { error, scope } = await requireCrmScope();
    if (error || !scope) return error!;

    const status = request.nextUrl.searchParams.get('status');
    let query = scope.supabase
      .from('pro_crm_maintenance_visits')
      .select('*')
      .eq('owner_id', scope.ownerId)
      .order('started_at', { ascending: false })
      .limit(100);

    if (
      status === 'in_progress' ||
      status === 'on_break' ||
      status === 'completed' ||
      status === 'cancelled'
    ) {
      query = query.eq('status', status);
    }

    const { data, error: queryError } = await query;
    if (queryError) {
      return NextResponse.json({ error: queryError.message }, { status: 500 });
    }

    const rows = (data ?? []) as MaintenanceVisitRow[];
    const customerIds = [...new Set(rows.map((row) => row.customer_id))];
    const { data: customers } = customerIds.length
      ? await scope.supabase
          .from('pro_crm_customers')
          .select('id, first_name, last_name, display_name, company_name')
          .in('id', customerIds)
      : { data: [] };

    const customerMap = new Map(
      (customers ?? []).map((customer) => [customer.id, contactDisplayName(customer)])
    );

    return NextResponse.json({
      visits: rows.map((row) => ({
        ...mapVisit(row),
        customerName: customerMap.get(row.customer_id) ?? 'Customer',
      })),
    });
  } catch (error) {
    console.error('GET /api/crm/maintenance/visits', error);
    return NextResponse.json({ error: 'Failed to load visits' }, { status: 500 });
  }
}

/**
 * POST /api/crm/maintenance/visits
 * Start a maintenance visit and begin the clock (opens the work day if needed).
 */
export async function POST(request: NextRequest) {
  try {
    const { error, scope } = await requireCrmScope();
    if (error || !scope) return error!;

    const parsed = startSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid visit' }, { status: 400 });
    }

    const { customerId, maintenancePlanId, projectId, responsibleCrewId, responsibleContactId } = parsed.data;
    const crewMemberIds = parsed.data.crewMemberIds ?? [];
    const contactIds = parsed.data.contactIds ?? [];
    const extraWorkers = parsed.data.extraWorkers ?? 0;

    const { data: openVisit } = await scope.supabase
      .from('pro_crm_maintenance_visits')
      .select('id, status')
      .eq('owner_id', scope.ownerId)
      .in('status', ['in_progress', 'on_break'])
      .limit(1)
      .maybeSingle();
    if (openVisit) {
      return NextResponse.json(
        { error: 'Finish or cancel the open maintenance visit before starting another' },
        { status: 400 }
      );
    }

    const { data: customer } = await scope.supabase
      .from('pro_crm_customers')
      .select('id')
      .eq('id', customerId)
      .eq('owner_id', scope.ownerId)
      .maybeSingle();
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    if (maintenancePlanId) {
      const { data: plan } = await scope.supabase
        .from('pro_crm_maintenance_plans')
        .select('id')
        .eq('id', maintenancePlanId)
        .eq('owner_id', scope.ownerId)
        .eq('customer_id', customerId)
        .maybeSingle();
      if (!plan) {
        return NextResponse.json({ error: 'Maintenance plan not found' }, { status: 404 });
      }
    }

    if (scope.isCrew && !responsibleCrewId && !responsibleContactId && !scope.crewMemberId) {
      return NextResponse.json(
        { error: 'Pick a responsible person for this maintenance visit' },
        { status: 400 }
      );
    }

    const day = await ensureOpenMaintenanceDay(scope.supabase, scope.ownerId, scope.businessId);
    const resolvedResponsibleCrewId = responsibleCrewId ?? (scope.isCrew ? scope.crewMemberId : null);

    const memberSet = new Set(crewMemberIds);
    if (resolvedResponsibleCrewId) memberSet.add(resolvedResponsibleCrewId);
    const contactSet = new Set(contactIds);
    if (responsibleContactId) contactSet.add(responsibleContactId);

    // Owner without crew assignment still counts as 1 worker.
    const assignedPeople = Math.max(memberSet.size + contactSet.size, 1);
    const workerCount = Math.min(50, assignedPeople + extraWorkers);

    await closeOpenTripOnDay(scope.supabase, day.id, scope.ownerId, {
      toCustomerId: customerId,
    });

    const { data: visit, error: insertError } = await scope.supabase
      .from('pro_crm_maintenance_visits')
      .insert({
        owner_id: scope.ownerId,
        business_id: scope.businessId,
        customer_id: customerId,
        maintenance_plan_id: maintenancePlanId ?? null,
        project_id: projectId ?? null,
        day_id: day.id,
        status: 'in_progress',
        started_at: new Date().toISOString(),
        break_seconds: 0,
        worker_count: workerCount,
        responsible_crew_id: resolvedResponsibleCrewId,
        responsible_contact_id: responsibleContactId ?? null,
        created_by: scope.actorId,
      })
      .select('*')
      .single();

    if (insertError || !visit) {
      return NextResponse.json({ error: insertError?.message ?? 'Could not start visit' }, { status: 500 });
    }

    // Attach the new visit to the trip that just closed (if any).
    const { data: lastTrip } = await scope.supabase
      .from('pro_crm_maintenance_day_trips')
      .select('id, to_visit_id')
      .eq('day_id', day.id)
      .eq('owner_id', scope.ownerId)
      .not('ended_at', 'is', null)
      .order('ended_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastTrip && !lastTrip.to_visit_id) {
      await scope.supabase
        .from('pro_crm_maintenance_day_trips')
        .update({ to_visit_id: visit.id, to_customer_id: customerId })
        .eq('id', lastTrip.id);
    }

    const crewRows: Array<{
      visit_id: string;
      crew_member_id?: string;
      contact_id?: string;
      is_responsible: boolean;
    }> = [];

    for (const memberId of memberSet) {
      crewRows.push({
        visit_id: visit.id,
        crew_member_id: memberId,
        is_responsible: memberId === resolvedResponsibleCrewId,
      });
    }
    for (const contactId of contactSet) {
      crewRows.push({
        visit_id: visit.id,
        contact_id: contactId,
        is_responsible: contactId === responsibleContactId && !resolvedResponsibleCrewId,
      });
    }

    if (crewRows.length > 0) {
      const { error: crewError } = await scope.supabase
        .from('pro_crm_maintenance_visit_crew')
        .insert(crewRows);
      if (crewError) console.error('visit crew insert', crewError);
    }

    return NextResponse.json(
      {
        visit: mapVisit(visit as MaintenanceVisitRow),
        dayId: day.id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/crm/maintenance/visits', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start visit' },
      { status: 500 }
    );
  }
}
