import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrmScope } from '@/lib/crm/crm-scope';
import { mapVisit, type MaintenanceVisitRow } from '@/lib/crm/maintenance-visits-db';
import { computeActiveSeconds } from '@/lib/crm/maintenance-time';

const timerSchema = z.object({
  action: z.enum(['break', 'resume']),
});

/**
 * POST /api/crm/maintenance/visits/[id]/timer
 * Pause (break) or resume the visit clock.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { error, scope } = await requireCrmScope();
    if (error || !scope) return error!;
    const { id } = await context.params;

    const parsed = timerSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid timer action' }, { status: 400 });
    }

    const { data: visit } = await scope.supabase
      .from('pro_crm_maintenance_visits')
      .select('*')
      .eq('id', id)
      .eq('owner_id', scope.ownerId)
      .maybeSingle();

    if (!visit) return NextResponse.json({ error: 'Visit not found' }, { status: 404 });
    const row = visit as MaintenanceVisitRow;

    if (parsed.data.action === 'break') {
      if (row.status !== 'in_progress') {
        return NextResponse.json({ error: 'Visit is not running' }, { status: 400 });
      }

      const pauseStartedAt = new Date().toISOString();
      const { data: updated, error: updateError } = await scope.supabase
        .from('pro_crm_maintenance_visits')
        .update({
          status: 'on_break',
          pause_started_at: pauseStartedAt,
        })
        .eq('id', id)
        .select('*')
        .single();

      if (updateError || !updated) {
        return NextResponse.json({ error: updateError?.message ?? 'Could not start break' }, { status: 500 });
      }

      await scope.supabase.from('pro_crm_maintenance_visit_breaks').insert({
        visit_id: id,
        started_at: pauseStartedAt,
      });

      return NextResponse.json({
        visit: mapVisit(updated as MaintenanceVisitRow),
        activeSeconds: computeActiveSeconds({
          startedAt: updated.started_at,
          breakSeconds: updated.break_seconds,
          pauseStartedAt: updated.pause_started_at,
        }),
      });
    }

    // resume
    if (row.status !== 'on_break' || !row.pause_started_at) {
      return NextResponse.json({ error: 'Visit is not on break' }, { status: 400 });
    }

    const resumedAt = new Date();
    const pauseSeconds = Math.max(
      0,
      Math.floor((resumedAt.getTime() - new Date(row.pause_started_at).getTime()) / 1000)
    );
    const breakSeconds = (row.break_seconds ?? 0) + pauseSeconds;

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
          ended_at: resumedAt.toISOString(),
          duration_seconds: pauseSeconds,
        })
        .eq('id', openBreak.id);
    }

    const { data: updated, error: updateError } = await scope.supabase
      .from('pro_crm_maintenance_visits')
      .update({
        status: 'in_progress',
        pause_started_at: null,
        break_seconds: breakSeconds,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (updateError || !updated) {
      return NextResponse.json({ error: updateError?.message ?? 'Could not resume' }, { status: 500 });
    }

    return NextResponse.json({
      visit: mapVisit(updated as MaintenanceVisitRow),
      activeSeconds: computeActiveSeconds({
        startedAt: updated.started_at,
        breakSeconds: updated.break_seconds,
        pauseStartedAt: updated.pause_started_at,
      }),
    });
  } catch (error) {
    console.error('POST /api/crm/maintenance/visits/[id]/timer', error);
    return NextResponse.json({ error: 'Failed to update timer' }, { status: 500 });
  }
}
