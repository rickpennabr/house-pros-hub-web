import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrmScope } from '@/lib/crm/crm-scope';
import { safeTimeZone, todayKeyInZone } from '@/lib/crm/estimate-chart';
import { PRO_DRIVE_BUCKET, PRO_DRIVE_SIGNED_URL_SECONDS } from '@/lib/drive/constants';
import { TOOL_KINDS, TOOL_SELECT, TOOL_STATUSES, toolColumns, toolInputSchema, type ToolRow } from '@/lib/crm/pro-tools';
import {
  checkToolLinks,
  loadToolNames,
  loadUpkeepByTool,
  PURCHASE_NOTE,
  recordToolEvent,
  summarizeTools,
  toListItem,
  TOOLS_SETUP_ERROR,
  toolsSchemaMissing,
} from '@/lib/crm/pro-tools-db';

const VALID_SORT = ['name', 'purchase_date', 'purchase_cents', 'book_value', 'status', 'updated_at'] as const;
type SortKey = (typeof VALID_SORT)[number];

/**
 * GET /api/crm/tools
 * Tools and equipment with book value, who has each one, and where it is working.
 * Filters: search, kind, status, category, projectId, maintenancePlanId. summary=1 adds totals.
 */
export async function GET(request: NextRequest) {
  try {
    const { error, scope } = await requireCrmScope();
    if (error || !scope) return error!;
    const params = request.nextUrl.searchParams;
    const today = todayKeyInZone(safeTimeZone(params.get('timeZone')));

    let query = scope.supabase.from('pro_crm_tools').select(TOOL_SELECT).eq('owner_id', scope.ownerId).limit(2000);
    const kind = params.get('kind');
    if (kind && (TOOL_KINDS as readonly string[]).includes(kind)) query = query.eq('kind', kind);
    const projectId = params.get('projectId');
    if (projectId && z.string().uuid().safeParse(projectId).success) query = query.eq('project_id', projectId);
    const planId = params.get('maintenancePlanId');
    if (planId && z.string().uuid().safeParse(planId).success) query = query.eq('maintenance_plan_id', planId);

    const { data, error: queryError } = await query;
    if (queryError) {
      if (toolsSchemaMissing(queryError.message)) return NextResponse.json({ error: TOOLS_SETUP_ERROR }, { status: 503 });
      return NextResponse.json({ error: queryError.message }, { status: 500 });
    }
    const allRows = (data ?? []) as ToolRow[];

    const [names, upkeep] = await Promise.all([
      loadToolNames(scope, allRows),
      loadUpkeepByTool(scope, allRows.map((row) => row.id)),
    ]);
    const summary = params.get('summary') === '1' ? summarizeTools(allRows, today, upkeep) : null;

    const status = params.get('status');
    const category = (params.get('category') || '').trim().toLowerCase();
    const search = (params.get('search') || '').trim().toLowerCase();
    let rows = allRows;
    if (status === 'service_due') {
      rows = rows.filter((row) => toListItem(row, names, today, 0, null).serviceDue);
    } else if (status && (TOOL_STATUSES as readonly string[]).includes(status)) {
      rows = rows.filter((row) => row.status === status);
    } else if (!status) {
      // Retired and lost items stay out of the everyday list; pick them by status.
      rows = rows.filter((row) => row.status !== 'retired' && row.status !== 'lost');
    }
    if (category) rows = rows.filter((row) => (row.category ?? '').toLowerCase() === category);

    // Photos: one signed link per item that has one.
    const photoIds = [...new Set(rows.map((row) => row.photo_drive_file_id).filter(Boolean))] as string[];
    const photoUrl = new Map<string, string | null>();
    if (photoIds.length) {
      const { data: files } = await scope.supabase.from('pro_drive_files').select('id, storage_path').in('id', photoIds);
      const withPath = ((files ?? []) as Array<{ id: string; storage_path: string | null }>).filter((file) => file.storage_path);
      if (withPath.length) {
        const { data: signed } = await scope.supabase.storage
          .from(PRO_DRIVE_BUCKET)
          .createSignedUrls(withPath.map((file) => file.storage_path as string), PRO_DRIVE_SIGNED_URL_SECONDS);
        withPath.forEach((file, index) => photoUrl.set(file.id, signed?.[index]?.signedUrl ?? null));
      }
    }

    let items = rows.map((row) =>
      toListItem(row, names, today, upkeep.get(row.id) ?? 0, row.photo_drive_file_id ? photoUrl.get(row.photo_drive_file_id) ?? null : null)
    );
    if (search) {
      items = items.filter((item) =>
        [item.name, item.category, item.brand, item.model, item.serialNumber, item.assignedTo, item.projectName, item.houseName, item.location]
          .some((value) => (value ?? '').toLowerCase().includes(search))
      );
    }

    const sortParam = params.get('sortBy') as SortKey | null;
    const sortBy: SortKey = sortParam && VALID_SORT.includes(sortParam) ? sortParam : 'name';
    const direction = params.get('sortDir') === 'desc' ? -1 : 1;
    items.sort((a, b) => {
      switch (sortBy) {
        case 'purchase_date':
          return ((a.purchaseDate ?? '') < (b.purchaseDate ?? '') ? -1 : 1) * direction;
        case 'purchase_cents':
          return (a.purchaseCents - b.purchaseCents) * direction;
        case 'book_value':
          return (a.bookValueCents - b.bookValueCents) * direction;
        case 'status':
          return a.status.localeCompare(b.status) * direction;
        case 'updated_at':
          return a.updatedAt.localeCompare(b.updatedAt) * direction;
        default:
          return a.name.localeCompare(b.name) * direction;
      }
    });

    const page = Math.max(1, parseInt(params.get('page') || '1', 10));
    const pageSize = Math.min(200, Math.max(1, parseInt(params.get('pageSize') || '50', 10)));
    const from = (page - 1) * pageSize;
    return NextResponse.json({
      tools: items.slice(from, from + pageSize),
      total: items.length,
      page,
      pageSize,
      summary,
      businessId: scope.businessId,
      canEdit: !scope.isCrew,
    });
  } catch (error) {
    console.error('GET /api/crm/tools', error);
    return NextResponse.json({ error: 'Failed to load tools' }, { status: 500 });
  }
}

const createSchema = toolInputSchema.extend({
  /** Also file the purchase in Expenses (job cost when a project is picked). */
  recordExpense: z.boolean().optional(),
});

/**
 * POST /api/crm/tools
 * Add a tool or piece of equipment. Owner only.
 */
export async function POST(request: NextRequest) {
  try {
    const { error, scope } = await requireCrmScope();
    if (error || !scope) return error!;
    if (scope.isCrew) {
      return NextResponse.json({ error: 'Only the business owner can add tools and equipment.' }, { status: 403 });
    }
    const parsed = createSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid item' }, { status: 400 });
    }
    const input = parsed.data;
    const linkError = await checkToolLinks(scope, input);
    if (linkError) return NextResponse.json({ error: linkError }, { status: 400 });

    const { data: tool, error: insertError } = await scope.supabase
      .from('pro_crm_tools')
      .insert({ owner_id: scope.ownerId, ...toolColumns(input) })
      .select('id')
      .single();
    if (insertError || !tool) {
      if (toolsSchemaMissing(insertError?.message)) return NextResponse.json({ error: TOOLS_SETUP_ERROR }, { status: 503 });
      return NextResponse.json({ error: insertError?.message ?? 'Could not add the item' }, { status: 500 });
    }

    await recordToolEvent(scope, tool.id, {
      status: input.status,
      assigned_crew_id: input.assignedCrewId ?? null,
      project_id: input.projectId ?? null,
      maintenance_plan_id: input.maintenancePlanId ?? null,
      note: 'Added',
    });

    let expenseId: string | null = null;
    let expenseError: string | null = null;
    if (input.recordExpense && input.purchaseCents > 0) {
      const { data: expense, error: expenseInsertError } = await scope.supabase
        .from('pro_crm_expenses')
        .insert({
          owner_id: scope.ownerId,
          tool_id: tool.id,
          project_id: input.projectId || null,
          amount_cents: input.purchaseCents,
          category: input.kind === 'equipment' ? 'Equipment' : 'Tools',
          expense_date: input.purchaseDate || new Date().toISOString().slice(0, 10),
          description: [input.name, input.brand, input.model].filter(Boolean).join(' ').slice(0, 500),
          quantity: input.quantity,
          note: PURCHASE_NOTE,
        })
        .select('id')
        .single();
      expenseId = expense?.id ?? null;
      // The item is saved either way; tell the pro if the expense did not go through.
      if (expenseInsertError) expenseError = 'The item was added, but its expense could not be saved.';
    }

    return NextResponse.json({ id: tool.id, expenseId, warning: expenseError }, { status: 201 });
  } catch (error) {
    console.error('POST /api/crm/tools', error);
    return NextResponse.json({ error: 'Failed to add the item' }, { status: 500 });
  }
}
