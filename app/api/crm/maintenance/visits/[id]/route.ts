import { recordCustomerPlaceEvent } from '@/lib/places/timeline';
import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { requireCrmScope } from '@/lib/crm/crm-scope';
import { recomputeDayTotals } from '@/lib/crm/maintenance-day-db';
import { buildVisitDescription } from '@/lib/crm/maintenance-defaults';
import { computeActiveSeconds, computeLaborSeconds } from '@/lib/crm/maintenance-time';
import { mapVisit, type MaintenanceVisitRow } from '@/lib/crm/maintenance-visits-db';
import { contactDisplayName } from '@/lib/crm/contact-name';

const patchSchema = z.object({
  notes: z.string().max(4000).nullable().optional(),
  serviceOptionIds: z.array(z.string().uuid()).optional(),
  workerCount: z.number().int().min(1).max(50).optional(),
  /** Only cancelling is allowed here; breaks use /timer and completion uses finish. */
  status: z.enum(['cancelled']).optional(),
  finish: z.boolean().optional(),
});

async function loadVisitBundle(supabase: SupabaseClient, ownerId: string, visitId: string) {
  const { data: visit } = await supabase
    .from('pro_crm_maintenance_visits')
    .select('*')
    .eq('id', visitId)
    .eq('owner_id', ownerId)
    .maybeSingle();
  if (!visit) return null;

  const [{ data: services }, { data: media }, { data: crew }, { data: customer }] = await Promise.all([
    supabase
      .from('pro_crm_maintenance_visit_services')
      .select('id, service_option_id, name, description, sort_order')
      .eq('visit_id', visitId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('pro_crm_maintenance_visit_media')
      .select('id, phase, kind, drive_file_id, caption, orientation, sort_order, created_at')
      .eq('visit_id', visitId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('pro_crm_maintenance_visit_crew')
      .select('crew_member_id, contact_id, is_responsible')
      .eq('visit_id', visitId),
    supabase
      .from('pro_crm_customers')
      .select('id, first_name, last_name, display_name, company_name, street_address, city, state, zip_code')
      .eq('id', visit.customer_id)
      .maybeSingle(),
  ]);

  return {
    visit: visit as MaintenanceVisitRow,
    services: services ?? [],
    media: media ?? [],
    crew: crew ?? [],
    customer,
  };
}

/**
 * GET /api/crm/maintenance/visits/[id]
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { error, scope } = await requireCrmScope();
    if (error || !scope) return error!;
    const { id } = await context.params;

    const bundle = await loadVisitBundle(scope.supabase, scope.ownerId, id);
    if (!bundle) return NextResponse.json({ error: 'Visit not found' }, { status: 404 });

    return NextResponse.json({
      visit: {
        ...mapVisit(bundle.visit),
        customerName: bundle.customer ? contactDisplayName(bundle.customer) : 'Customer',
        customer: bundle.customer,
      },
      services: bundle.services.map((row) => ({
        id: row.id,
        serviceOptionId: row.service_option_id,
        name: row.name,
        description: row.description,
        sortOrder: row.sort_order,
      })),
      media: bundle.media.map((row) => ({
        id: row.id,
        phase: row.phase,
        kind: row.kind,
        driveFileId: row.drive_file_id,
        caption: row.caption,
        orientation: row.orientation,
        sortOrder: row.sort_order,
        createdAt: row.created_at,
      })),
      crew: bundle.crew.map((row) => ({
        crewMemberId: row.crew_member_id,
        contactId: row.contact_id,
        isResponsible: row.is_responsible,
      })),
    });
  } catch (error) {
    console.error('GET /api/crm/maintenance/visits/[id]', error);
    return NextResponse.json({ error: 'Failed to load visit' }, { status: 500 });
  }
}

/**
 * PATCH /api/crm/maintenance/visits/[id]
 * Save notes/services, or finish the visit (stop clock + generate description).
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { error, scope } = await requireCrmScope();
    if (error || !scope) return error!;
    const { id } = await context.params;

    const parsed = patchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid update' }, { status: 400 });
    }

    const bundle = await loadVisitBundle(scope.supabase, scope.ownerId, id);
    if (!bundle) return NextResponse.json({ error: 'Visit not found' }, { status: 404 });
    if (
      parsed.data.finish &&
      bundle.visit.status !== 'in_progress' &&
      bundle.visit.status !== 'on_break'
    ) {
      return NextResponse.json({ error: 'Visit is already closed' }, { status: 400 });
    }

    if (parsed.data.serviceOptionIds) {
      const optionIds = parsed.data.serviceOptionIds;
      const { data: options } = optionIds.length
        ? await scope.supabase
            .from('pro_crm_maintenance_service_options')
            .select('id, name, description_template')
            .eq('owner_id', scope.ownerId)
            .in('id', optionIds)
        : { data: [] };

      await scope.supabase.from('pro_crm_maintenance_visit_services').delete().eq('visit_id', id);

      if ((options ?? []).length > 0) {
        await scope.supabase.from('pro_crm_maintenance_visit_services').insert(
          (options ?? []).map((option, index) => ({
            visit_id: id,
            service_option_id: option.id,
            name: option.name,
            description: option.description_template,
            sort_order: index,
          }))
        );
      }
    }

    const updates: Record<string, unknown> = {};
    if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes;
    if (parsed.data.workerCount !== undefined) updates.worker_count = parsed.data.workerCount;
    if (
      parsed.data.status === 'cancelled' &&
      !parsed.data.finish &&
      (bundle.visit.status === 'in_progress' || bundle.visit.status === 'on_break')
    ) {
      updates.status = 'cancelled';
      updates.ended_at = new Date().toISOString();
      updates.pause_started_at = null;
    }

    if (parsed.data.finish) {
      const endedAt = new Date();
      let breakSeconds = bundle.visit.break_seconds ?? 0;

      // Closing while on break folds the open pause into break time.
      if (bundle.visit.status === 'on_break' && bundle.visit.pause_started_at) {
        const openBreakSeconds = Math.max(
          0,
          Math.floor((endedAt.getTime() - new Date(bundle.visit.pause_started_at).getTime()) / 1000)
        );
        breakSeconds += openBreakSeconds;

        const { data: openBreak } = await scope.supabase
          .from('pro_crm_maintenance_visit_breaks')
          .select('id')
          .eq('visit_id', id)
          .is('ended_at', null)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (openBreak) {
          await scope.supabase
            .from('pro_crm_maintenance_visit_breaks')
            .update({
              ended_at: endedAt.toISOString(),
              duration_seconds: openBreakSeconds,
            })
            .eq('id', openBreak.id);
        }
      }

      const durationSeconds = computeActiveSeconds({
        startedAt: bundle.visit.started_at,
        endedAt,
        breakSeconds,
        pauseStartedAt: null,
      });
      const workerCount = parsed.data.workerCount ?? bundle.visit.worker_count ?? 1;
      const laborSeconds = computeLaborSeconds(durationSeconds, workerCount);

      const refreshed = await loadVisitBundle(scope.supabase, scope.ownerId, id);
      const services = refreshed?.services ?? [];
      const notes = parsed.data.notes !== undefined ? parsed.data.notes : bundle.visit.notes;

      updates.status = 'completed';
      updates.ended_at = endedAt.toISOString();
      updates.pause_started_at = null;
      updates.break_seconds = breakSeconds;
      updates.duration_seconds = durationSeconds;
      updates.worker_count = workerCount;
      updates.labor_seconds = laborSeconds;
      updates.notes = notes;
      updates.generated_description = buildVisitDescription({
        serviceNames: services.map((service) => service.name),
        serviceDescriptions: services.map((service) => service.description),
        notes,
        durationSeconds,
        breakSeconds,
        workerCount,
        laborSeconds,
        customerName: bundle.customer ? contactDisplayName(bundle.customer) : null,
      });

      if (bundle.visit.maintenance_plan_id) {
        await scope.supabase
          .from('pro_crm_maintenance_plans')
          .update({ last_visit_date: endedAt.toISOString().slice(0, 10) })
          .eq('id', bundle.visit.maintenance_plan_id)
          .eq('owner_id', scope.ownerId);
      }
    }

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await scope.supabase
        .from('pro_crm_maintenance_visits')
        .update(updates)
        .eq('id', id)
        .eq('owner_id', scope.ownerId);
      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    }

    const next = await loadVisitBundle(scope.supabase, scope.ownerId, id);
    if (!next) return NextResponse.json({ error: 'Visit not found' }, { status: 404 });

    const visitCustomerId = (next.visit as { customer_id?: string | null }).customer_id;
    if (parsed.data.finish && next.visit.status === 'completed' && visitCustomerId) {
      const seconds = (next.visit as { labor_seconds?: number | null }).labor_seconds ?? 0;
      await recordCustomerPlaceEvent(visitCustomerId, {
        kind: 'visit_completed',
        title: 'Maintenance visit done',
        detail: seconds > 0 ? `${(seconds / 3600).toFixed(1)}h of work` : null,
        ownerId: scope.ownerId,
      }).catch(() => null);
    }

    if ((parsed.data.finish || parsed.data.status === 'cancelled') && next.visit.day_id) {
      await recomputeDayTotals(scope.supabase, next.visit.day_id, scope.ownerId);
    }

    return NextResponse.json({
      visit: {
        ...mapVisit(next.visit),
        customerName: next.customer ? contactDisplayName(next.customer) : 'Customer',
      },
      services: next.services.map((row) => ({
        id: row.id,
        serviceOptionId: row.service_option_id,
        name: row.name,
        description: row.description,
        sortOrder: row.sort_order,
      })),
    });
  } catch (error) {
    console.error('PATCH /api/crm/maintenance/visits/[id]', error);
    return NextResponse.json({ error: 'Failed to update visit' }, { status: 500 });
  }
}

/**
 * DELETE /api/crm/maintenance/visits/[id]
 * Remove a visit with its services, crew and photo links. The photo files stay in Drive.
 * The day's totals are recomputed. Business owner only.
 */
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { error, scope } = await requireCrmScope();
    if (error || !scope) return error!;
    if (scope.isCrew) {
      return NextResponse.json({ error: 'Only the business owner can delete a visit.' }, { status: 403 });
    }
    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: 'Visit not found' }, { status: 404 });
    }

    const { data: visit } = await scope.supabase
      .from('pro_crm_maintenance_visits')
      .select('id, day_id')
      .eq('id', id)
      .eq('owner_id', scope.ownerId)
      .maybeSingle();
    if (!visit) return NextResponse.json({ error: 'Visit not found' }, { status: 404 });

    const { error: deleteError } = await scope.supabase
      .from('pro_crm_maintenance_visits')
      .delete()
      .eq('id', id)
      .eq('owner_id', scope.ownerId);
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

    if (visit.day_id) await recomputeDayTotals(scope.supabase, visit.day_id, scope.ownerId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/crm/maintenance/visits/[id]', err);
    return NextResponse.json({ error: 'Failed to delete the visit' }, { status: 500 });
  }
}
