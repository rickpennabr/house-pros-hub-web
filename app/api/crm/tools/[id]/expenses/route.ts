import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrmScope } from '@/lib/crm/crm-scope';
import { recordToolEvent, TOOLS_SETUP_ERROR, toolsSchemaMissing } from '@/lib/crm/pro-tools-db';

const UPKEEP_KINDS = ['Repair', 'Parts', 'Service', 'Fuel', 'Rental', 'Other'] as const;

const schema = z.object({
  kind: z.enum(UPKEEP_KINDS),
  amountCents: z.number().int().min(1).max(100_000_000),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().trim().max(500).optional(),
  /** Bill it to a project as a job cost. */
  projectId: z.string().uuid().nullable().optional(),
  /** Set the next service date after a service or repair. */
  nextServiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

/**
 * POST /api/crm/tools/[id]/expenses
 * File a repair, parts, or service cost on an item. It also shows in Expenses. Owner only.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error, scope } = await requireCrmScope();
    if (error || !scope) return error!;
    if (scope.isCrew) return NextResponse.json({ error: 'Only the business owner can add expenses.' }, { status: 403 });
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid expense' }, { status: 400 });
    const input = parsed.data;

    const { data: tool, error: toolError } = await scope.supabase
      .from('pro_crm_tools')
      .select('id, name, kind')
      .eq('id', id)
      .eq('owner_id', scope.ownerId)
      .maybeSingle();
    if (toolError && toolsSchemaMissing(toolError.message)) return NextResponse.json({ error: TOOLS_SETUP_ERROR }, { status: 503 });
    if (!tool) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

    if (input.projectId) {
      const { data: project } = await scope.supabase
        .from('pro_crm_projects')
        .select('id')
        .eq('id', input.projectId)
        .eq('owner_id', scope.ownerId)
        .maybeSingle();
      if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 400 });
    }

    const { data: expense, error: insertError } = await scope.supabase
      .from('pro_crm_expenses')
      .insert({
        owner_id: scope.ownerId,
        tool_id: tool.id,
        project_id: input.projectId || null,
        amount_cents: input.amountCents,
        category: input.kind === 'Fuel' ? 'Fuel' : tool.kind === 'equipment' ? 'Equipment' : 'Tools',
        expense_date: input.date,
        description: `${input.kind}: ${input.description || tool.name}`.slice(0, 500),
      })
      .select('id')
      .single();
    if (insertError || !expense) return NextResponse.json({ error: insertError?.message ?? 'Could not save the expense' }, { status: 500 });

    if (input.nextServiceDate !== undefined) {
      await scope.supabase
        .from('pro_crm_tools')
        .update({ next_service_date: input.nextServiceDate })
        .eq('id', tool.id)
        .eq('owner_id', scope.ownerId);
    }
    if (input.kind === 'Repair' || input.kind === 'Service') {
      await recordToolEvent(scope, tool.id, { note: `${input.kind} recorded` });
    }
    return NextResponse.json({ id: expense.id }, { status: 201 });
  } catch (error) {
    console.error('POST /api/crm/tools/[id]/expenses', error);
    return NextResponse.json({ error: 'Failed to save the expense' }, { status: 500 });
  }
}
