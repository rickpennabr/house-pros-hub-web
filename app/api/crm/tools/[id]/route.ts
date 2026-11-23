import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrmScope, type CrmScope } from '@/lib/crm/crm-scope';
import { safeTimeZone, todayKeyInZone } from '@/lib/crm/estimate-chart';
import { PRO_DRIVE_BUCKET, PRO_DRIVE_SIGNED_URL_SECONDS } from '@/lib/drive/constants';
import {
  TOOL_SELECT,
  TOOL_STATUSES,
  toolColumns,
  toolInputSchema,
  toolYearlyDepreciationCents,
  type ToolRow,
} from '@/lib/crm/pro-tools';
import {
  checkToolLinks,
  loadToolNames,
  PURCHASE_NOTE,
  recordToolEvent,
  toListItem,
  TOOLS_SETUP_ERROR,
  toolsSchemaMissing,
} from '@/lib/crm/pro-tools-db';

type Params = { params: Promise<{ id: string }> };

async function loadTool(scope: CrmScope, id: string): Promise<ToolRow | null | 'missing-schema'> {
  if (!z.string().uuid().safeParse(id).success) return null;
  const { data, error } = await scope.supabase
    .from('pro_crm_tools')
    .select(TOOL_SELECT)
    .eq('id', id)
    .eq('owner_id', scope.ownerId)
    .maybeSingle();
  if (error && toolsSchemaMissing(error.message)) return 'missing-schema';
  return (data as ToolRow | null) ?? null;
}

/**
 * GET /api/crm/tools/[id]
 * One item: details, value, every expense filed on it, and where it has been.
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { error, scope } = await requireCrmScope();
    if (error || !scope) return error!;
    const { id } = await params;
    const tool = await loadTool(scope, id);
    if (tool === 'missing-schema') return NextResponse.json({ error: TOOLS_SETUP_ERROR }, { status: 503 });
    if (!tool) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

    const [{ data: expenses }, { data: events }] = await Promise.all([
      scope.supabase
        .from('pro_crm_expenses')
        .select('id, amount_cents, category, expense_date, description, note, project_id')
        .eq('owner_id', scope.ownerId)
        .eq('tool_id', tool.id)
        .order('expense_date', { ascending: false }),
      scope.supabase
        .from('pro_crm_tool_events')
        .select('id, status, assigned_crew_id, project_id, maintenance_plan_id, note, created_at')
        .eq('tool_id', tool.id)
        .order('created_at', { ascending: false })
        .limit(100),
    ]);
    const expenseRows = (expenses ?? []) as Array<{
      id: string;
      amount_cents: number;
      category: string;
      expense_date: string;
      description: string | null;
      note: string | null;
      project_id: string | null;
    }>;
    const eventRows = (events ?? []) as Array<{
      id: string;
      status: string | null;
      assigned_crew_id: string | null;
      project_id: string | null;
      maintenance_plan_id: string | null;
      note: string | null;
      created_at: string;
    }>;
    const names = await loadToolNames(scope, [tool, ...eventRows]);

    let photoUrl: string | null = null;
    if (tool.photo_drive_file_id) {
      const { data: file } = await scope.supabase
        .from('pro_drive_files')
        .select('storage_path')
        .eq('id', tool.photo_drive_file_id)
        .maybeSingle();
      if (file?.storage_path) {
        const { data: signed } = await scope.supabase.storage
          .from(PRO_DRIVE_BUCKET)
          .createSignedUrl(file.storage_path, PRO_DRIVE_SIGNED_URL_SECONDS);
        photoUrl = signed?.signedUrl ?? null;
      }
    }

    const upkeepCents = expenseRows.filter((row) => row.note !== PURCHASE_NOTE).reduce((sum, row) => sum + row.amount_cents, 0);
    const today = todayKeyInZone(safeTimeZone(request.nextUrl.searchParams.get('timeZone')));
    return NextResponse.json({
      tool: {
        ...toListItem(tool, names, today, upkeepCents, photoUrl),
        usefulLifeYears: Number(tool.useful_life_years),
        salvageCents: tool.salvage_cents,
        dailyRateCents: tool.daily_rate_cents ?? null,
        yearlyDepreciationCents: toolYearlyDepreciationCents(tool),
        upkeepCents,
        note: tool.note,
        photoDriveFileId: tool.photo_drive_file_id,
        createdAt: tool.created_at,
      },
      expenses: expenseRows.map((row) => ({
        id: row.id,
        amountCents: row.amount_cents,
        category: row.category,
        date: row.expense_date,
        description: row.description,
        isPurchase: row.note === PURCHASE_NOTE,
      })),
      history: eventRows.map((row) => ({
        id: row.id,
        status: row.status,
        assignedTo: row.assigned_crew_id ? names.crew.get(row.assigned_crew_id) ?? null : null,
        projectName: row.project_id ? names.projects.get(row.project_id) ?? null : null,
        houseName: row.maintenance_plan_id ? names.houses.get(row.maintenance_plan_id) ?? null : null,
        note: row.note,
        at: row.created_at,
      })),
      canEdit: !scope.isCrew,
    });
  } catch (error) {
    console.error('GET /api/crm/tools/[id]', error);
    return NextResponse.json({ error: 'Failed to load the item' }, { status: 500 });
  }
}

/** Crew can check items in and out: who has it, where it is, and its status. */
const crewPatchSchema = z.object({
  status: z.enum(TOOL_STATUSES).optional(),
  assignedCrewId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  maintenancePlanId: z.string().uuid().nullable().optional(),
  location: z.string().trim().max(120).nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
});

/**
 * PATCH /api/crm/tools/[id]
 * Owner: full edit (send every field). Crew, or the owner with checkout=true: move the item.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { error, scope } = await requireCrmScope();
    if (error || !scope) return error!;
    const { id } = await params;
    const tool = await loadTool(scope, id);
    if (tool === 'missing-schema') return NextResponse.json({ error: TOOLS_SETUP_ERROR }, { status: 503 });
    if (!tool) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

    const body = await request.json().catch(() => null);
    const checkout = scope.isCrew || (body && typeof body === 'object' && body.checkout === true);

    let update: Record<string, unknown>;
    let eventNote: string | null = null;
    if (checkout) {
      const parsed = crewPatchSchema.safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid change' }, { status: 400 });
      const move = parsed.data;
      if (move.status === 'retired' && scope.isCrew) {
        return NextResponse.json({ error: 'Only the business owner can retire an item.' }, { status: 403 });
      }
      const linkError = await checkToolLinks(scope, move);
      if (linkError) return NextResponse.json({ error: linkError }, { status: 400 });
      update = {
        ...(move.status !== undefined ? { status: move.status } : {}),
        ...(move.assignedCrewId !== undefined ? { assigned_crew_id: move.assignedCrewId } : {}),
        ...(move.projectId !== undefined ? { project_id: move.projectId } : {}),
        ...(move.maintenancePlanId !== undefined ? { maintenance_plan_id: move.maintenancePlanId } : {}),
        ...(move.location !== undefined ? { location: move.location || null } : {}),
      };
      eventNote = move.note || null;
    } else {
      const parsed = toolInputSchema.safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid item' }, { status: 400 });
      const linkError = await checkToolLinks(scope, parsed.data);
      if (linkError) return NextResponse.json({ error: linkError }, { status: 400 });
      update = toolColumns(parsed.data);
      // Keep the first retirement date.
      if (tool.retired_at && update.retired_at) update.retired_at = tool.retired_at;
    }

    const { data: saved, error: updateError } = await scope.supabase
      .from('pro_crm_tools')
      .update(update)
      .eq('id', tool.id)
      .eq('owner_id', scope.ownerId)
      .select(TOOL_SELECT)
      .single();
    if (updateError || !saved) return NextResponse.json({ error: updateError?.message ?? 'Could not save' }, { status: 500 });
    const after = saved as ToolRow;

    const moved =
      after.status !== tool.status ||
      after.assigned_crew_id !== tool.assigned_crew_id ||
      after.project_id !== tool.project_id ||
      after.maintenance_plan_id !== tool.maintenance_plan_id;
    if (moved || eventNote) {
      await recordToolEvent(scope, tool.id, {
        status: after.status,
        assigned_crew_id: after.assigned_crew_id,
        project_id: after.project_id,
        maintenance_plan_id: after.maintenance_plan_id,
        note: eventNote,
      });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('PATCH /api/crm/tools/[id]', error);
    return NextResponse.json({ error: 'Failed to save the item' }, { status: 500 });
  }
}

/**
 * DELETE /api/crm/tools/[id]
 * Removes the item. Its expenses stay in Expenses, unlinked. Owner only.
 * (Retire instead to keep it in the valuation history.)
 */
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { error, scope } = await requireCrmScope();
    if (error || !scope) return error!;
    if (scope.isCrew) return NextResponse.json({ error: 'Only the business owner can delete items.' }, { status: 403 });
    const { id } = await params;
    const tool = await loadTool(scope, id);
    if (tool === 'missing-schema') return NextResponse.json({ error: TOOLS_SETUP_ERROR }, { status: 503 });
    if (!tool) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    const { error: deleteError } = await scope.supabase.from('pro_crm_tools').delete().eq('id', tool.id).eq('owner_id', scope.ownerId);
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/crm/tools/[id]', error);
    return NextResponse.json({ error: 'Failed to delete the item' }, { status: 500 });
  }
}
